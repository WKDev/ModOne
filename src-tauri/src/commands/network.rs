//! Network management Tauri command handlers.
//!
//! Provides commands for managing PLC IP aliases and listing
//! network interfaces for the project settings UI.

use std::sync::Arc;

use tauri::State;
use tokio::sync::Mutex;

use crate::network::{
    is_ip_assigned, list_network_interfaces, NetworkInterfaceInfo, SimulatorNetworkManager,
};

/// Managed state for network IP alias lifecycle.
pub struct NetworkState {
    pub manager: Arc<Mutex<SimulatorNetworkManager>>,
}

impl Default for NetworkState {
    fn default() -> Self {
        Self {
            manager: Arc::new(Mutex::new(SimulatorNetworkManager::new())),
        }
    }
}

/// List available network interfaces on the host.
#[tauri::command]
pub async fn network_list_interfaces() -> Result<Vec<NetworkInterfaceInfo>, String> {
    list_network_interfaces().await.map_err(|e| e.to_string())
}

/// Check whether an IP address is currently assigned to a local interface.
#[tauri::command]
pub async fn network_check_ip(ip: String) -> Result<bool, String> {
    is_ip_assigned(&ip).await.map_err(|e| e.to_string())
}

/// Manually add an IP alias (for testing or manual setup).
#[tauri::command]
pub async fn network_add_alias(
    state: State<'_, NetworkState>,
    ip: String,
    interface_name: Option<String>,
    subnet_mask: Option<String>,
) -> Result<String, String> {
    let mut mgr = state.manager.lock().await;
    let result = mgr
        .ensure_alias(Some(&ip), interface_name.as_deref(), subnet_mask.as_deref())
        .await
        .map_err(|e| e.to_string())?;

    Ok(result.unwrap_or_default())
}

/// Remove a specific managed IP alias.
#[tauri::command]
pub async fn network_remove_alias(
    state: State<'_, NetworkState>,
    ip: String,
) -> Result<(), String> {
    let mut mgr = state.manager.lock().await;
    mgr.cleanup_alias(&ip).await.map_err(|e| e.to_string())
}

/// Get currently active IP aliases managed by the simulator.
#[tauri::command]
pub async fn network_get_active_aliases(
    state: State<'_, NetworkState>,
) -> Result<Vec<(String, String)>, String> {
    let mgr = state.manager.lock().await;
    Ok(mgr.active_aliases())
}

/// Clean up all managed IP aliases. Returns any warning messages.
#[tauri::command]
pub async fn network_cleanup_aliases(
    state: State<'_, NetworkState>,
) -> Result<Vec<String>, String> {
    let mut mgr = state.manager.lock().await;
    Ok(mgr.cleanup().await)
}
