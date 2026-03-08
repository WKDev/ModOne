use serde::{Deserialize, Serialize};

pub mod keygen;
pub mod crypto;
pub mod store;

use crate::{ModOneResult, ModOneError};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum LicenseStatus {
    Valid,
    Trial { days_left: u32 },
    Expired,
    Unlicensed,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LicenseInfo {
    pub status: LicenseStatus,
    pub machine_id: String,
    pub lease_expiry: Option<String>,
}

/// Initialize licensing checks, to be called during application startup.
/// Returns Ok(true) if the app is allowed to run, Ok(false) if blocked (unlicensed).
pub fn check_license_on_boot(is_dev: bool) -> ModOneResult<bool> {
    if is_dev {
        log::info!("Licensing bypassed running in Dev Mode.");
        return Ok(true);
    }
    
    // Fallback stub for now
    Ok(false)
}
