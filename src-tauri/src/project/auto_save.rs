//! Auto-save functionality for projects
//!
//! This module provides automatic periodic saving of projects with backup file rotation.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;
use tokio::time::interval;

use super::{AutoSaveSettings, MopFileError, ProjectManager};

/// Manager for automatic project saving
pub struct AutoSaveManager {
    /// Auto-save interval
    interval: Duration,
    /// Whether auto-save is enabled
    enabled: bool,
    /// Number of backup files to keep
    backup_count: u32,
    /// Channel sender to cancel the auto-save loop
    cancel_tx: Option<mpsc::Sender<()>>,
    /// Whether the auto-save loop is currently running
    is_running: bool,
}

impl std::fmt::Debug for AutoSaveManager {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AutoSaveManager")
            .field("interval", &self.interval)
            .field("enabled", &self.enabled)
            .field("backup_count", &self.backup_count)
            .field("is_running", &self.is_running)
            .finish()
    }
}

impl AutoSaveManager {
    /// Create a new AutoSaveManager with the given settings
    pub fn new(settings: &AutoSaveSettings) -> Self {
        Self {
            interval: Duration::from_secs(settings.interval_secs),
            enabled: settings.enabled,
            backup_count: settings.backup_count,
            cancel_tx: None,
            is_running: false,
        }
    }

    /// Check if auto-save is currently running
    pub fn is_running(&self) -> bool {
        self.is_running
    }

    /// Check if auto-save is enabled
    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    /// Get the current interval
    pub fn get_interval(&self) -> Duration {
        self.interval
    }

    /// Get the backup count
    pub fn get_backup_count(&self) -> u32 {
        self.backup_count
    }

    /// Start the auto-save loop
    ///
    /// If already running, stops the current loop first.
    pub fn start(
        &mut self,
        project_manager: Arc<Mutex<ProjectManager>>,
        app_handle: AppHandle,
    ) {
        // Stop if already running
        if self.is_running {
            self.stop();
        }

        if !self.enabled {
            log::info!("Auto-save is disabled, not starting");
            return;
        }

        let (tx, rx) = mpsc::channel(1);
        self.cancel_tx = Some(tx);
        self.is_running = true;

        let interval_duration = self.interval;
        let backup_count = self.backup_count;

        log::info!(
            "Starting auto-save with interval {:?} and {} backups",
            interval_duration,
            backup_count
        );

        tokio::spawn(async move {
            Self::auto_save_loop(project_manager, interval_duration, rx, backup_count, app_handle)
                .await;
        });
    }

    /// Stop the auto-save loop
    pub fn stop(&mut self) {
        if let Some(tx) = self.cancel_tx.take() {
            // Send cancel signal (ignore error if receiver dropped)
            let _ = tx.try_send(());
        }
        self.is_running = false;
        log::info!("Auto-save stopped");
    }

    /// Update the enabled state
    pub fn update_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
        log::info!("Auto-save enabled: {}", enabled);
    }

    /// Update the interval and restart if running
    pub fn update_interval(
        &mut self,
        secs: u64,
        project_manager: Option<(Arc<Mutex<ProjectManager>>, AppHandle)>,
    ) {
        self.interval = Duration::from_secs(secs);
        log::info!("Auto-save interval updated to {} seconds", secs);

        // Restart if running
        if self.is_running {
            if let Some((manager, app_handle)) = project_manager {
                self.stop();
                self.start(manager, app_handle);
            }
        }
    }

    /// Update the backup count
    pub fn update_backup_count(&mut self, count: u32) {
        self.backup_count = count;
        log::info!("Auto-save backup count updated to {}", count);
    }

    /// The main auto-save loop
    async fn auto_save_loop(
        manager: Arc<Mutex<ProjectManager>>,
        interval_duration: Duration,
        mut cancel_rx: mpsc::Receiver<()>,
        backup_count: u32,
        app_handle: AppHandle,
    ) {
        let mut interval_timer = interval(interval_duration);
        // Skip the first immediate tick
        interval_timer.tick().await;

        loop {
            tokio::select! {
                _ = interval_timer.tick() => {
                    Self::perform_auto_save(&manager, backup_count, &app_handle).await;
                }
                _ = cancel_rx.recv() => {
                    log::info!("Auto-save loop cancelled");
                    break;
                }
            }
        }
    }

    /// Perform a single auto-save operation
    async fn perform_auto_save(
        manager: &Arc<Mutex<ProjectManager>>,
        backup_count: u32,
        app_handle: &AppHandle,
    ) {
        let mut manager_guard = match manager.lock() {
            Ok(guard) => guard,
            Err(e) => {
                log::error!("Failed to acquire project manager lock: {}", e);
                return;
            }
        };

        // Check if project is open and modified
        if !manager_guard.is_project_open() {
            return;
        }

        if !manager_guard.is_modified() {
            log::debug!("Project not modified, skipping auto-save");
            return;
        }

        // Get source path for backup
        let source_path = match manager_guard.get_current_project() {
            Some(project) => project.source_path().map(|p| p.to_path_buf()),
            None => return,
        };

        // Create backup before saving (only if file exists)
        if let Some(ref path) = source_path {
            if path.exists() {
                if let Err(e) = Self::create_backup(path, backup_count) {
                    log::warn!("Failed to create backup: {}", e);
                    // Continue with save anyway
                }
            }
        }

        // Perform save
        match manager_guard.save_project(None) {
            Ok(()) => {
                log::info!("Auto-save completed successfully");
                // Emit event to frontend
                let _ = app_handle.emit("auto-save-completed", ());
            }
            Err(e) => {
                log::error!("Auto-save failed: {}", e);
                let _ = app_handle.emit("auto-save-failed", e.to_string());
            }
        }
    }

    /// Create a backup of the project file
    ///
    /// Rotates existing backups: .bak -> .bak.1 -> .bak.2 -> deleted
    pub fn create_backup(project_path: &Path, backup_count: u32) -> Result<(), MopFileError> {
        if backup_count == 0 {
            return Ok(());
        }

        let base_path = project_path.to_string_lossy();

        // Delete oldest backup if it exists
        let oldest = format!("{}.bak.{}", base_path, backup_count);
        if Path::new(&oldest).exists() {
            fs::remove_file(&oldest)?;
        }

        // Rotate existing backups (from oldest to newest)
        for i in (1..backup_count).rev() {
            let old_path = if i == 1 {
                format!("{}.bak", base_path)
            } else {
                format!("{}.bak.{}", base_path, i - 1)
            };
            let new_path = format!("{}.bak.{}", base_path, i);

            if Path::new(&old_path).exists() {
                fs::rename(&old_path, &new_path)?;
            }
        }

        // Copy current file to .bak
        let backup_path = format!("{}.bak", base_path);
        if project_path.exists() {
            fs::copy(project_path, &backup_path)?;
            log::debug!("Created backup: {}", backup_path);
        }

        Ok(())
    }

    /// Restore from the most recent backup
    pub fn restore_from_backup(project_path: &Path) -> Result<PathBuf, MopFileError> {
        let base_path = project_path.to_string_lossy();
        let backup_path = PathBuf::from(format!("{}.bak", base_path));

        if !backup_path.exists() {
            return Err(MopFileError::InvalidStructure(
                "No backup file found".to_string(),
            ));
        }

        // Copy backup over original
        fs::copy(&backup_path, project_path)?;
        log::info!("Restored project from backup: {:?}", backup_path);

        Ok(backup_path)
    }
}

impl Default for AutoSaveManager {
    fn default() -> Self {
        Self::new(&AutoSaveSettings::default())
    }
}

impl Drop for AutoSaveManager {
    fn drop(&mut self) {
        self.stop();
    }
}

/// Type alias for thread-safe AutoSaveManager wrapped in Arc<Mutex>
pub type SharedAutoSaveManager = Arc<Mutex<AutoSaveManager>>;

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_auto_save_manager_new() {
        let settings = AutoSaveSettings::default();
        let manager = AutoSaveManager::new(&settings);

        assert!(manager.is_enabled());
        assert!(!manager.is_running());
        assert_eq!(manager.get_interval(), Duration::from_secs(300));
        assert_eq!(manager.get_backup_count(), 3);
    }

    #[test]
    fn test_update_settings() {
        let settings = AutoSaveSettings::default();
        let mut manager = AutoSaveManager::new(&settings);

        manager.update_enabled(false);
        assert!(!manager.is_enabled());

        manager.update_interval(60, None);
        assert_eq!(manager.get_interval(), Duration::from_secs(60));

        manager.update_backup_count(5);
        assert_eq!(manager.get_backup_count(), 5);
    }

    #[test]
    fn test_backup_rotation() {
        let temp_dir = tempdir().unwrap();
        let project_path = temp_dir.path().join("test.mop");

        // Create initial project file
        fs::write(&project_path, "version 1").unwrap();

        // Create first backup
        AutoSaveManager::create_backup(&project_path, 3).unwrap();
        assert!(temp_dir.path().join("test.mop.bak").exists());

        // Modify and create second backup
        fs::write(&project_path, "version 2").unwrap();
        AutoSaveManager::create_backup(&project_path, 3).unwrap();
        assert!(temp_dir.path().join("test.mop.bak").exists());
        assert!(temp_dir.path().join("test.mop.bak.1").exists());

        // Verify backup content
        let bak_content = fs::read_to_string(temp_dir.path().join("test.mop.bak")).unwrap();
        let bak1_content = fs::read_to_string(temp_dir.path().join("test.mop.bak.1")).unwrap();
        assert_eq!(bak_content, "version 2");
        assert_eq!(bak1_content, "version 1");
    }

    #[test]
    fn test_backup_count_limit() {
        let temp_dir = tempdir().unwrap();
        let project_path = temp_dir.path().join("test.mop");

        // Create several backups with count = 2
        for i in 0..5 {
            fs::write(&project_path, format!("version {}", i)).unwrap();
            AutoSaveManager::create_backup(&project_path, 2).unwrap();
        }

        // Should only have .bak and .bak.1
        assert!(temp_dir.path().join("test.mop.bak").exists());
        assert!(temp_dir.path().join("test.mop.bak.1").exists());
        assert!(!temp_dir.path().join("test.mop.bak.2").exists());
    }

    #[test]
    fn test_restore_from_backup() {
        let temp_dir = tempdir().unwrap();
        let project_path = temp_dir.path().join("test.mop");

        // Create initial file and backup
        fs::write(&project_path, "original").unwrap();
        AutoSaveManager::create_backup(&project_path, 1).unwrap();

        // Corrupt the original
        fs::write(&project_path, "corrupted").unwrap();

        // Restore from backup
        AutoSaveManager::restore_from_backup(&project_path).unwrap();

        let restored = fs::read_to_string(&project_path).unwrap();
        assert_eq!(restored, "original");
    }
}
