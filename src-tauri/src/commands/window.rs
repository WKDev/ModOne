//! Floating Window Commands
//!
//! Tauri commands for creating, managing, and controlling floating windows
//! that can be detached from the main application window.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use uuid::Uuid;

/// Window bounds (position and size)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// Information about a floating window
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FloatingWindowInfo {
    pub window_id: String,
    pub panel_id: String,
    pub panel_type: String,
    pub bounds: WindowBounds,
}

/// State for tracking floating windows
#[derive(Default)]
pub struct FloatingWindowRegistry {
    /// Map of window_id to FloatingWindowInfo
    windows: HashMap<String, FloatingWindowInfo>,
}

impl FloatingWindowRegistry {
    pub fn new() -> Self {
        Self {
            windows: HashMap::new(),
        }
    }

    pub fn register(&mut self, info: FloatingWindowInfo) {
        self.windows.insert(info.window_id.clone(), info);
    }

    pub fn unregister(&mut self, window_id: &str) -> Option<FloatingWindowInfo> {
        self.windows.remove(window_id)
    }

    pub fn get(&self, window_id: &str) -> Option<&FloatingWindowInfo> {
        self.windows.get(window_id)
    }

    pub fn update_bounds(&mut self, window_id: &str, bounds: WindowBounds) -> bool {
        if let Some(info) = self.windows.get_mut(window_id) {
            info.bounds = bounds;
            true
        } else {
            false
        }
    }

    pub fn list(&self) -> Vec<FloatingWindowInfo> {
        self.windows.values().cloned().collect()
    }
}

/// Managed state type for floating window registry
pub type FloatingWindowState = Mutex<FloatingWindowRegistry>;

/// Create a new floating window for a panel
#[tauri::command]
pub async fn window_create_floating(
    app: AppHandle,
    state: tauri::State<'_, FloatingWindowState>,
    panel_id: String,
    panel_type: String,
    bounds: WindowBounds,
) -> Result<String, String> {
    // Generate unique window ID
    let window_id = format!("floating-{}", Uuid::new_v4().to_string().split('-').next().unwrap_or("0000"));

    // Create the URL for the floating window
    // The frontend will handle routing based on query params
    let url = format!("index.html?floating=true&windowId={}&panelId={}&panelType={}",
        window_id, panel_id, panel_type);

    // Build the new window
    let window = WebviewWindowBuilder::new(
        &app,
        &window_id,
        WebviewUrl::App(url.into()),
    )
    .title(format!("ModOne - {}", panel_type))
    .inner_size(bounds.width, bounds.height)
    .position(bounds.x, bounds.y)
    .resizable(true)
    .decorations(true)
    .visible(true)
    .focused(true)
    .build()
    .map_err(|e| format!("Failed to create floating window: {}", e))?;

    // Register the window in our state
    let info = FloatingWindowInfo {
        window_id: window_id.clone(),
        panel_id: panel_id.clone(),
        panel_type: panel_type.clone(),
        bounds,
    };

    {
        let mut registry = state.lock().map_err(|e| format!("Failed to lock state: {}", e))?;
        registry.register(info);
    }

    // Emit event to notify frontend
    app.emit("floating-window-created", &serde_json::json!({
        "windowId": window_id,
        "panelId": panel_id,
        "panelType": panel_type,
    })).map_err(|e| format!("Failed to emit event: {}", e))?;

    log::info!("Created floating window: {} for panel: {}", window_id, panel_id);

    Ok(window_id)
}

/// Close a floating window
#[tauri::command]
pub async fn window_close_floating(
    app: AppHandle,
    state: tauri::State<'_, FloatingWindowState>,
    window_id: String,
) -> Result<(), String> {
    // Get the window
    let window = app.get_webview_window(&window_id)
        .ok_or_else(|| format!("Window not found: {}", window_id))?;

    // Close the window
    window.close().map_err(|e| format!("Failed to close window: {}", e))?;

    // Unregister from state
    {
        let mut registry = state.lock().map_err(|e| format!("Failed to lock state: {}", e))?;
        registry.unregister(&window_id);
    }

    // Emit event
    app.emit("floating-window-closed", &serde_json::json!({
        "windowId": window_id,
    })).map_err(|e| format!("Failed to emit event: {}", e))?;

    log::info!("Closed floating window: {}", window_id);

    Ok(())
}

/// Update the bounds of a floating window
#[tauri::command]
pub async fn window_update_bounds(
    app: AppHandle,
    state: tauri::State<'_, FloatingWindowState>,
    window_id: String,
    bounds: WindowBounds,
) -> Result<(), String> {
    // Get the window
    let window = app.get_webview_window(&window_id)
        .ok_or_else(|| format!("Window not found: {}", window_id))?;

    // Update position and size
    window.set_position(tauri::PhysicalPosition::new(bounds.x as i32, bounds.y as i32))
        .map_err(|e| format!("Failed to set position: {}", e))?;

    window.set_size(tauri::PhysicalSize::new(bounds.width as u32, bounds.height as u32))
        .map_err(|e| format!("Failed to set size: {}", e))?;

    // Update state
    {
        let mut registry = state.lock().map_err(|e| format!("Failed to lock state: {}", e))?;
        registry.update_bounds(&window_id, bounds.clone());
    }

    Ok(())
}

/// Focus a floating window (bring to front)
#[tauri::command]
pub async fn window_focus_floating(
    app: AppHandle,
    window_id: String,
) -> Result<(), String> {
    let window = app.get_webview_window(&window_id)
        .ok_or_else(|| format!("Window not found: {}", window_id))?;

    window.set_focus().map_err(|e| format!("Failed to focus window: {}", e))?;

    // Emit event
    app.emit("floating-window-focused", &serde_json::json!({
        "windowId": window_id,
    })).map_err(|e| format!("Failed to emit event: {}", e))?;

    Ok(())
}

/// List all floating windows
#[tauri::command]
pub async fn window_list_floating(
    state: tauri::State<'_, FloatingWindowState>,
) -> Result<Vec<FloatingWindowInfo>, String> {
    let registry = state.lock().map_err(|e| format!("Failed to lock state: {}", e))?;
    Ok(registry.list())
}

/// Get information about a specific floating window
#[tauri::command]
pub async fn window_get_floating_info(
    app: AppHandle,
    state: tauri::State<'_, FloatingWindowState>,
    window_id: String,
) -> Result<Option<FloatingWindowInfo>, String> {
    // Try to get current bounds from the actual window
    if let Some(window) = app.get_webview_window(&window_id) {
        let position = window.outer_position().map_err(|e| format!("Failed to get position: {}", e))?;
        let size = window.outer_size().map_err(|e| format!("Failed to get size: {}", e))?;

        let mut registry = state.lock().map_err(|e| format!("Failed to lock state: {}", e))?;

        // Update bounds in registry
        let bounds = WindowBounds {
            x: position.x as f64,
            y: position.y as f64,
            width: size.width as f64,
            height: size.height as f64,
        };
        registry.update_bounds(&window_id, bounds);

        Ok(registry.get(&window_id).cloned())
    } else {
        Ok(None)
    }
}

/// Minimize a floating window
#[tauri::command]
pub async fn window_minimize_floating(
    app: AppHandle,
    window_id: String,
) -> Result<(), String> {
    let window = app.get_webview_window(&window_id)
        .ok_or_else(|| format!("Window not found: {}", window_id))?;

    window.minimize().map_err(|e| format!("Failed to minimize window: {}", e))?;

    Ok(())
}

/// Maximize/restore a floating window
#[tauri::command]
pub async fn window_maximize_floating(
    app: AppHandle,
    window_id: String,
) -> Result<(), String> {
    let window = app.get_webview_window(&window_id)
        .ok_or_else(|| format!("Window not found: {}", window_id))?;

    if window.is_maximized().unwrap_or(false) {
        window.unmaximize().map_err(|e| format!("Failed to unmaximize window: {}", e))?;
    } else {
        window.maximize().map_err(|e| format!("Failed to maximize window: {}", e))?;
    }

    Ok(())
}

/// Check if a floating window exists
#[tauri::command]
pub async fn window_floating_exists(
    app: AppHandle,
    window_id: String,
) -> Result<bool, String> {
    Ok(app.get_webview_window(&window_id).is_some())
}
