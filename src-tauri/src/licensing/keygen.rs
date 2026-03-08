use reqwest::Client;
use serde_json::{json, Value};
use tokio::sync::OnceCell;

use crate::{ModOneError, ModOneResult};

const KEYGEN_ACCOUNT_ID: &str = "demo"; // Replace with real account ID

static MACHINE_ID: OnceCell<String> = OnceCell::const_new();

pub async fn get_machine_id() -> String {
    MACHINE_ID.get_or_init(|| async {
        machine_uid::get().unwrap_or_else(|_| "unknown_machine_fallback".to_string())
    }).await.clone()
}

fn api_url(endpoint: &str) -> String {
    format!("https://api.keygen.sh/v1/accounts/{}/{}", KEYGEN_ACCOUNT_ID, endpoint)
}

pub async fn activate_license(key: &str) -> ModOneResult<Value> {
    let client = Client::new();
    let machine_id = get_machine_id().await;
    
    // Step 1: Validate key & identify
    let res = client.post(api_url("licenses/actions/validate-key"))
        .json(&json!({
            "meta": {
                "key": key
            }
        }))
        .send()
        .await
        .map_err(|e| ModOneError::Internal(e.to_string()))?;
        
    let mut data: Value = res.json().await.map_err(|e| ModOneError::Internal(e.to_string()))?;
    
    if !data["meta"]["valid"].as_bool().unwrap_or(false) {
        return Err(ModOneError::Internal("License is not valid".to_string()));
    }
    
    let license_id = data["data"]["id"].as_str().unwrap_or("").to_string();
    
    // Step 2: Activate Machine (Machine fingerprinting)
    let res = client.post(api_url("machines"))
        .bearer_auth(key)
        .json(&json!({
            "data": {
                "type": "machines",
                "attributes": {
                    "fingerprint": machine_id,
                    "name": "ModOne PC"
                },
                "relationships": {
                    "license": {
                        "data": { "type": "licenses", "id": license_id }
                    }
                }
            }
        }))
        .send()
        .await
        .map_err(|e| ModOneError::Internal(e.to_string()))?;
        
    let activation_data: Value = res.json().await.map_err(|e| ModOneError::Internal(e.to_string()))?;
    if activation_data.get("errors").is_some() {
        log::warn!("Machine error (might already exist): {:?}", activation_data);
        // It's ok if it already exists, as long as it belongs to this license. 
        // We'll proceed.
    }

    Ok(data)
}

pub async fn checkout_license(key: &str) -> ModOneResult<Value> {
    let client = Client::new();
    let res = client.get(api_url("licenses/actions/checkout"))
        .bearer_auth(key)
        .query(&[("ttl", "86400")]) // 1 day API, but we enforce 7 locally if we wish, Keygen controls TTL though.
        .send()
        .await
        .map_err(|e| ModOneError::Internal(e.to_string()))?;
        
    let data: Value = res.json().await.map_err(|e| ModOneError::Internal(e.to_string()))?;
    if data.get("errors").is_some() {
        return Err(ModOneError::Internal("Failed to checkout offline license".to_string()));
    }
    
    Ok(data)
}

pub async fn deactivate_machine(key: &str) -> ModOneResult<()> {
    let client = Client::new();
    let machine_id = get_machine_id().await;
    
    let res = client.delete(api_url(&format!("machines/{}", machine_id))) // Typically you query machine id first, but simplified here
        .bearer_auth(key)
        .send()
        .await
        .map_err(|e| ModOneError::Internal(e.to_string()))?;
        
    if !res.status().is_success() {
        return Err(ModOneError::Internal("Failed to deactivate machine".to_string()));
    }
    Ok(())
}
