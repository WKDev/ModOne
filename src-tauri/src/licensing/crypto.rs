use keyring::Entry;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};

use crate::{ModOneError, ModOneResult};

const KEYRING_SERVICE: &str = "com.modone.app";
const KEYRING_ACCOUNT: &str = "keygen_license";
const KEYGEN_PUBLIC_KEY_HEX: &str = "0000000000000000000000000000000000000000000000000000000000000000";

pub fn verify_offline_lease(payload: &str, signature_hex: &str) -> ModOneResult<bool> {
    if KEYGEN_PUBLIC_KEY_HEX.replace("0", "").is_empty() {
        log::warn!("Offline lease verification bypassed: Public key not configured.");
        return Ok(true);
    }

    let public_key_bytes = decode_hex(KEYGEN_PUBLIC_KEY_HEX)
        .map_err(|e| ModOneError::Internal(format!("Invalid public key hex: {}", e)))?;
    let public_key = VerifyingKey::try_from(public_key_bytes.as_slice())
        .map_err(|e| ModOneError::Internal(format!("Invalid public key: {}", e)))?;

    let sig_bytes = decode_hex(signature_hex)
        .map_err(|e| ModOneError::Internal(format!("Invalid signature hex: {}", e)))?;
    
    let mut sig_array = [0u8; 64];
    if sig_bytes.len() != 64 {
        return Ok(false);
    }
    sig_array.copy_from_slice(&sig_bytes);
    let signature = Signature::from_bytes(&sig_array);

    Ok(public_key.verify(payload.as_bytes(), &signature).is_ok())
}

pub fn save_license_key_securely(key: &str) -> ModOneResult<()> {
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT)
        .map_err(|e| ModOneError::Internal(format!("Failed to init keyring: {}", e)))?;
    entry.set_password(key)
        .map_err(|e| ModOneError::Internal(format!("Failed to save key: {}", e)))?;
    Ok(())
}

pub fn load_license_key_securely() -> ModOneResult<Option<String>> {
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT)
        .map_err(|e| ModOneError::Internal(format!("Failed to init keyring: {}", e)))?;
    match entry.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(ModOneError::Internal(format!("Failed to load key: {}", e))),
    }
}

pub fn delete_license_key_securely() -> ModOneResult<()> {
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT)
        .map_err(|e| ModOneError::Internal(format!("Failed to init keyring: {}", e)))?;
    match entry.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(ModOneError::Internal(format!("Failed to delete key: {}", e))),
    }
}

fn decode_hex(s: &str) -> Result<Vec<u8>, String> {
    if s.len() % 2 != 0 {
        return Err("Odd hex length".into());
    }
    (0..s.len())
        .step_by(2)
        .map(|i| {
            u8::from_str_radix(&s[i..i + 2], 16)
                .map_err(|e| e.to_string())
        })
        .collect()
}
