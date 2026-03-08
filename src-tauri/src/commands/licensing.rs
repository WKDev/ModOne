use crate::{licensing, ModOneResult};
use serde_json::Value;

#[tauri::command]
pub async fn activate_license(key: String) -> Result<Value, String> {
    licensing::keygen::activate_license(&key).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn checkout_license(key: String) -> Result<Value, String> {
    let data = licensing::keygen::checkout_license(&key).await.map_err(|e| e.to_string())?;
    
    // Parse the token logic would go here. We save a mock for now.
    let lease = licensing::store::OfflineLease {
        payload: "mock_payload".to_string(),
        signature: "mock_signature".to_string(),
        expiry: "2099-12-31T23:59:59Z".to_string()
    };
    licensing::store::save_offline_lease(&lease).map_err(|e| e.to_string())?;
    licensing::crypto::save_license_key_securely(&key).map_err(|e| e.to_string())?;
    
    Ok(data)
}

#[tauri::command]
pub async fn deactivate_license() -> Result<(), String> {
    let key = licensing::crypto::load_license_key_securely().map_err(|e| e.to_string())?;
    if let Some(k) = key {
        licensing::keygen::deactivate_machine(&k).await.map_err(|e| e.to_string())?;
        licensing::crypto::delete_license_key_securely().map_err(|e| e.to_string())?;
        licensing::store::delete_offline_lease().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn get_license_info() -> Result<licensing::LicenseInfo, String> {
    let machine_id = licensing::keygen::get_machine_id().await;
    let status = if cfg!(debug_assertions) {
        licensing::LicenseStatus::Valid
    } else if let Ok(Some(_lease)) = licensing::store::load_offline_lease() {
        licensing::LicenseStatus::Valid
    } else {
        licensing::LicenseStatus::Unlicensed
    };
    
    Ok(licensing::LicenseInfo {
        status,
        machine_id,
        lease_expiry: None
    })
}
