//! Scenario Command Handlers
//!
//! Tauri commands for scenario file operations (load, save, import/export CSV)
//! and scenario execution control.

use std::path::Path;
use std::sync::Arc;

use tauri::{AppHandle, Emitter, State};
use tokio::sync::{mpsc, Mutex};

use crate::scenario::{
    CsvEventRow, ExecutorCommand, Scenario, ScenarioEvent, ScenarioExecutor, ScenarioState,
    ScenarioStatus,
};

/// Load a scenario from a JSON file
#[tauri::command]
pub async fn scenario_load(path: String) -> Result<Scenario, String> {
    let file_path = Path::new(&path);

    // Check if file exists
    if !file_path.exists() {
        return Err(format!("Scenario file not found: {}", path));
    }

    // Read file contents
    let contents = std::fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read scenario file: {}", e))?;

    // Parse JSON
    let scenario: Scenario = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse scenario JSON: {}", e))?;

    log::info!("Loaded scenario '{}' from {}", scenario.metadata.name, path);
    Ok(scenario)
}

/// Save a scenario to a JSON file
#[tauri::command]
pub async fn scenario_save(path: String, scenario: Scenario) -> Result<(), String> {
    let file_path = Path::new(&path);

    // Ensure parent directory exists
    if let Some(parent) = file_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    // Serialize to pretty JSON
    let json = serde_json::to_string_pretty(&scenario)
        .map_err(|e| format!("Failed to serialize scenario: {}", e))?;

    // Write to file
    std::fs::write(file_path, json)
        .map_err(|e| format!("Failed to write scenario file: {}", e))?;

    log::info!(
        "Saved scenario '{}' with {} events to {}",
        scenario.metadata.name,
        scenario.events.len(),
        path
    );
    Ok(())
}

/// Import scenario events from a CSV file
#[tauri::command]
pub async fn scenario_import_csv(path: String) -> Result<Vec<ScenarioEvent>, String> {
    let file_path = Path::new(&path);

    // Check if file exists
    if !file_path.exists() {
        return Err(format!("CSV file not found: {}", path));
    }

    // Open CSV reader
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(true)
        .flexible(true)
        .from_path(file_path)
        .map_err(|e| format!("Failed to open CSV file: {}", e))?;

    let mut events = Vec::new();
    let mut row_num = 1; // Start after header

    for result in reader.deserialize() {
        row_num += 1;
        let row: CsvEventRow = result.map_err(|e| {
            format!("Failed to parse CSV row {}: {}", row_num, e)
        })?;

        // Validate data
        if row.time < 0.0 {
            return Err(format!("Row {}: time cannot be negative", row_num));
        }

        // Convert to ScenarioEvent with generated UUID
        events.push(row.into_event());
    }

    log::info!("Imported {} events from CSV: {}", events.len(), path);
    Ok(events)
}

/// Export scenario events to a CSV file
#[tauri::command]
pub async fn scenario_export_csv(path: String, events: Vec<ScenarioEvent>) -> Result<(), String> {
    let file_path = Path::new(&path);

    // Ensure parent directory exists
    if let Some(parent) = file_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    // Create CSV writer
    let mut writer = csv::Writer::from_path(file_path)
        .map_err(|e| format!("Failed to create CSV file: {}", e))?;

    // Write events
    for event in &events {
        let row = CsvEventRow::from(event);
        writer.serialize(&row)
            .map_err(|e| format!("Failed to write CSV row: {}", e))?;
    }

    writer.flush()
        .map_err(|e| format!("Failed to flush CSV file: {}", e))?;

    log::info!("Exported {} events to CSV: {}", events.len(), path);
    Ok(())
}

/// Create a new empty scenario file
#[tauri::command]
pub async fn scenario_create(path: String, name: String) -> Result<Scenario, String> {
    let file_path = Path::new(&path);

    // Check if file already exists
    if file_path.exists() {
        return Err(format!("Scenario file already exists: {}", path));
    }

    // Create scenario with custom name
    let now = chrono::Utc::now().to_rfc3339();
    let scenario = Scenario {
        metadata: crate::scenario::ScenarioMetadata {
            name,
            description: String::new(),
            created_at: now.clone(),
            updated_at: now,
            author: String::new(),
        },
        settings: crate::scenario::ScenarioSettings::default(),
        events: Vec::new(),
    };

    // Save to file
    scenario_save(path.clone(), scenario.clone()).await?;

    log::info!("Created new scenario: {}", path);
    Ok(scenario)
}

/// List scenario files in a directory
#[tauri::command]
pub async fn scenario_list(directory: String) -> Result<Vec<String>, String> {
    let dir_path = Path::new(&directory);

    if !dir_path.exists() {
        return Ok(Vec::new());
    }

    if !dir_path.is_dir() {
        return Err(format!("Path is not a directory: {}", directory));
    }

    let mut scenarios = Vec::new();

    let entries = std::fs::read_dir(dir_path)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        // Check for .json files
        if path.is_file() {
            if let Some(ext) = path.extension() {
                if ext == "json" {
                    if let Some(name) = path.file_name() {
                        scenarios.push(name.to_string_lossy().to_string());
                    }
                }
            }
        }
    }

    scenarios.sort();
    Ok(scenarios)
}

/// Delete a scenario file
#[tauri::command]
pub async fn scenario_delete(path: String) -> Result<(), String> {
    let file_path = Path::new(&path);

    if !file_path.exists() {
        return Err(format!("Scenario file not found: {}", path));
    }

    std::fs::remove_file(file_path)
        .map_err(|e| format!("Failed to delete scenario file: {}", e))?;

    log::info!("Deleted scenario: {}", path);
    Ok(())
}

/// Check if a scenario file exists
#[tauri::command]
pub async fn scenario_exists(path: String) -> Result<bool, String> {
    let file_path = Path::new(&path);
    Ok(file_path.exists() && file_path.is_file())
}

// ============================================================================
// Scenario Execution State and Commands
// ============================================================================

/// Managed state for scenario execution
pub struct ScenarioExecutorState {
    /// The scenario executor (protected by async mutex for execution control)
    pub executor: Arc<Mutex<Option<ScenarioExecutor>>>,
    /// Reference to Modbus memory for executor initialization
    pub modbus_memory: Arc<crate::modbus::ModbusMemory>,
    /// Command channel sender for controlling execution
    pub command_tx: Mutex<Option<mpsc::Sender<ExecutorCommand>>>,
}

impl ScenarioExecutorState {
    /// Create a new executor state with the given Modbus memory
    pub fn new(modbus_memory: Arc<crate::modbus::ModbusMemory>) -> Self {
        Self {
            executor: Arc::new(Mutex::new(None)),
            modbus_memory,
            command_tx: Mutex::new(None),
        }
    }
}

/// Start scenario execution
///
/// Loads the scenario and begins executing events in order.
/// This command returns immediately after spawning the execution task.
#[tauri::command]
pub async fn scenario_run(
    scenario: Scenario,
    state: State<'_, ScenarioExecutorState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    log::info!("Starting scenario execution: {}", scenario.metadata.name);

    // Create a new executor with fresh state
    let mut executor = ScenarioExecutor::new(state.modbus_memory.clone());

    // Load the scenario
    executor.load(scenario)?;

    // Create command channel for controlling execution
    let command_tx = executor.create_command_channel();

    // Store the command sender
    {
        let mut tx_guard = state.command_tx.lock().await;
        *tx_guard = Some(command_tx);
    }

    // Store the executor
    {
        let mut guard = state.executor.lock().await;
        *guard = Some(executor);
    }

    // Clone the executor Arc for the spawned task
    let executor_arc = Arc::clone(&state.executor);
    let handle = app_handle.clone();

    // Spawn the execution task and return immediately
    tokio::spawn(async move {
        let mut guard = executor_arc.lock().await;
        if let Some(ref mut executor) = *guard {
            if let Err(e) = executor.run(handle.clone()).await {
                log::error!("Scenario execution error: {}", e);
                let _ = handle.emit(
                    "scenario:error",
                    serde_json::json!({ "message": e, "eventId": null }),
                );
            }
        }
        // Clear executor when done
        *guard = None;
    });

    Ok(())
}

/// Pause scenario execution
#[tauri::command]
pub async fn scenario_pause(state: State<'_, ScenarioExecutorState>) -> Result<(), String> {
    log::info!("Pausing scenario execution");

    let tx_guard = state.command_tx.lock().await;
    if let Some(ref tx) = *tx_guard {
        tx.send(ExecutorCommand::Pause)
            .await
            .map_err(|e| format!("Failed to send pause command: {}", e))?;
    } else {
        return Err("No scenario executor running".into());
    }

    Ok(())
}

/// Resume scenario execution from pause
#[tauri::command]
pub async fn scenario_resume(state: State<'_, ScenarioExecutorState>) -> Result<(), String> {
    log::info!("Resuming scenario execution");

    let tx_guard = state.command_tx.lock().await;
    if let Some(ref tx) = *tx_guard {
        tx.send(ExecutorCommand::Resume)
            .await
            .map_err(|e| format!("Failed to send resume command: {}", e))?;
    } else {
        return Err("No scenario executor running".into());
    }

    Ok(())
}

/// Stop scenario execution
#[tauri::command]
pub async fn scenario_stop(state: State<'_, ScenarioExecutorState>) -> Result<(), String> {
    log::info!("Stopping scenario execution");

    // Send stop command through the channel
    {
        let tx_guard = state.command_tx.lock().await;
        if let Some(ref tx) = *tx_guard {
            // Ignore send error - execution might have already stopped
            let _ = tx.send(ExecutorCommand::Stop).await;
        }
    }

    // Clear the command sender
    {
        let mut tx_guard = state.command_tx.lock().await;
        *tx_guard = None;
    }

    Ok(())
}

/// Get current scenario execution status
#[tauri::command]
pub async fn scenario_get_status(
    state: State<'_, ScenarioExecutorState>,
) -> Result<ScenarioStatus, String> {
    let guard = state.executor.lock().await;
    if let Some(ref executor) = *guard {
        Ok(executor.get_status())
    } else {
        // Return idle status when no executor
        Ok(ScenarioStatus::default())
    }
}

/// Get current scenario execution state
#[tauri::command]
pub async fn scenario_get_state(
    state: State<'_, ScenarioExecutorState>,
) -> Result<ScenarioState, String> {
    let guard = state.executor.lock().await;
    if let Some(ref executor) = *guard {
        Ok(executor.get_state())
    } else {
        Ok(ScenarioState::Idle)
    }
}

/// Seek to a specific time position in the scenario
///
/// This allows jumping to a specific point in the scenario timeline.
/// Events before the seek time are skipped, and execution continues
/// from the seek position.
#[tauri::command]
pub async fn scenario_seek(
    time_secs: f64,
    state: State<'_, ScenarioExecutorState>,
) -> Result<(), String> {
    log::info!("Seeking scenario to {:.2}s", time_secs);

    let mut guard = state.executor.lock().await;
    if let Some(ref mut executor) = *guard {
        executor.seek(time_secs)?;
    } else {
        return Err("No scenario loaded".into());
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn create_test_scenario() -> Scenario {
        Scenario {
            metadata: crate::scenario::ScenarioMetadata {
                name: "Test Scenario".to_string(),
                description: "A test scenario".to_string(),
                created_at: "2024-01-01T00:00:00Z".to_string(),
                updated_at: "2024-01-01T00:00:00Z".to_string(),
                author: "Test".to_string(),
            },
            settings: crate::scenario::ScenarioSettings {
                loop_enabled: true,
                loop_count: 3,
                loop_delay: 1000,
                auto_start: false,
            },
            events: vec![
                ScenarioEvent {
                    id: "event-1".to_string(),
                    time: 0.0,
                    address: "C:0x0001".to_string(),
                    value: 1,
                    persist: true,
                    persist_duration: None,
                    note: "Turn on coil".to_string(),
                    enabled: true,
                },
                ScenarioEvent {
                    id: "event-2".to_string(),
                    time: 1.5,
                    address: "H:0x0100".to_string(),
                    value: 1000,
                    persist: false,
                    persist_duration: Some(500),
                    note: "Write register".to_string(),
                    enabled: true,
                },
            ],
        }
    }

    #[tokio::test]
    async fn test_scenario_save_and_load() {
        let temp_dir = TempDir::new().unwrap();
        let path = temp_dir.path().join("test.json").to_string_lossy().to_string();

        let scenario = create_test_scenario();

        // Save
        scenario_save(path.clone(), scenario.clone()).await.unwrap();

        // Load
        let loaded = scenario_load(path).await.unwrap();

        assert_eq!(loaded.metadata.name, "Test Scenario");
        assert_eq!(loaded.events.len(), 2);
        assert_eq!(loaded.settings.loop_count, 3);
    }

    #[tokio::test]
    async fn test_csv_export_and_import() {
        let temp_dir = TempDir::new().unwrap();
        let path = temp_dir.path().join("events.csv").to_string_lossy().to_string();

        let scenario = create_test_scenario();

        // Export
        scenario_export_csv(path.clone(), scenario.events.clone()).await.unwrap();

        // Import
        let imported = scenario_import_csv(path).await.unwrap();

        assert_eq!(imported.len(), 2);
        assert_eq!(imported[0].address, "C:0x0001");
        assert_eq!(imported[1].value, 1000);
    }

    #[tokio::test]
    async fn test_scenario_create() {
        let temp_dir = TempDir::new().unwrap();
        let path = temp_dir.path().join("new.json").to_string_lossy().to_string();

        let scenario = scenario_create(path.clone(), "New Scenario".to_string()).await.unwrap();

        assert_eq!(scenario.metadata.name, "New Scenario");
        assert!(scenario.events.is_empty());

        // File should exist
        assert!(scenario_exists(path).await.unwrap());
    }

    #[tokio::test]
    async fn test_scenario_list() {
        let temp_dir = TempDir::new().unwrap();
        let dir = temp_dir.path().to_string_lossy().to_string();

        // Create some scenario files
        scenario_create(
            temp_dir.path().join("scenario1.json").to_string_lossy().to_string(),
            "Scenario 1".to_string(),
        ).await.unwrap();

        scenario_create(
            temp_dir.path().join("scenario2.json").to_string_lossy().to_string(),
            "Scenario 2".to_string(),
        ).await.unwrap();

        // List
        let list = scenario_list(dir).await.unwrap();

        assert_eq!(list.len(), 2);
        assert!(list.contains(&"scenario1.json".to_string()));
        assert!(list.contains(&"scenario2.json".to_string()));
    }

    #[tokio::test]
    async fn test_scenario_delete() {
        let temp_dir = TempDir::new().unwrap();
        let path = temp_dir.path().join("delete.json").to_string_lossy().to_string();

        // Create
        scenario_create(path.clone(), "To Delete".to_string()).await.unwrap();
        assert!(scenario_exists(path.clone()).await.unwrap());

        // Delete
        scenario_delete(path.clone()).await.unwrap();
        assert!(!scenario_exists(path).await.unwrap());
    }
}
