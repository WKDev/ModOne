use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs;

use crate::{ModOneError, ModOneResult};

#[derive(Debug, Serialize, Deserialize)]
pub struct OfflineLease {
    pub payload: String,
    pub signature: String,
    pub expiry: String, // ISO8601 string
}

pub fn get_license_dir() -> ModOneResult<PathBuf> {
    if let Some(mut path) = directories::ProjectDirs::from("com", "modone", "app") {
        let dir = path.config_dir().join("licensing");
        if !dir.exists() {
            fs::create_dir_all(&dir)
                .map_err(|e| ModOneError::Internal(format!("Failed to create license dir: {}", e)))?;
        }
        return Ok(dir);
    }
    Err(ModOneError::Internal("Could not determine local app data dir".into()))
}

pub fn save_offline_lease(lease: &OfflineLease) -> ModOneResult<()> {
    let dir = get_license_dir()?;
    let file_path = dir.join("lease.lic");
    
    let content = serde_json::to_string(lease)
        .map_err(|e| ModOneError::Internal(format!("Failed to serialize lease: {}", e)))?;
        
    fs::write(&file_path, content)
        .map_err(|e| ModOneError::Internal(format!("Failed to write lease file: {}", e)))?;
        
    Ok(())
}

pub fn load_offline_lease() -> ModOneResult<Option<OfflineLease>> {
    let dir = get_license_dir()?;
    let file_path = dir.join("lease.lic");
    
    if !file_path.exists() {
        return Ok(None);
    }
    
    let content = fs::read_to_string(&file_path)
        .map_err(|e| ModOneError::Internal(format!("Failed to read lease file: {}", e)))?;
        
    let lease: OfflineLease = serde_json::from_str(&content)
        .map_err(|e| ModOneError::Internal(format!("Failed to deserialize lease: {}", e)))?;
        
    Ok(Some(lease))
}

pub fn delete_offline_lease() -> ModOneResult<()> {
    let dir = get_license_dir()?;
    let file_path = dir.join("lease.lic");
    
    if file_path.exists() {
        fs::remove_file(&file_path)
            .map_err(|e| ModOneError::Internal(format!("Failed to delete lease file: {}", e)))?;
    }
    
    Ok(())
}
