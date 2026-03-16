//! Tag Event Bridge
//!
//! Subscribes to `CanonicalMemoryBus` events, resolves changed addresses to
//! tag IDs via the reverse index, filters against the watched set, and emits
//! per-tag Tauri events to the frontend.

use std::collections::HashSet;
use std::sync::Arc;

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::sync::broadcast;

use crate::plc_runtime::{
    CanonicalMemoryBus, CanonicalMemoryChange, CanonicalMemoryEvent, CanonicalValue,
};

use super::tag_registry::SharedTagRegistry;

const TAG_VALUE_CHANGED_EVENT: &str = "tags:value-changed";

// ============================================================================
// Event payload types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TagTypedValue {
    #[serde(rename = "type")]
    pub value_type: String,
    pub data: serde_json::Value,
}

impl TagTypedValue {
    pub fn from_canonical(value: CanonicalValue) -> Self {
        match value {
            CanonicalValue::Bool(b) => Self {
                value_type: "bool".to_string(),
                data: serde_json::Value::Bool(b),
            },
            CanonicalValue::U16(n) => Self {
                value_type: "u16".to_string(),
                data: serde_json::json!(n),
            },
        }
    }

    pub fn to_canonical(&self) -> Result<CanonicalValue, String> {
        match self.value_type.as_str() {
            "bool" => self
                .data
                .as_bool()
                .map(CanonicalValue::Bool)
                .ok_or_else(|| "expected boolean data for bool type".to_string()),
            "u16" => {
                let n = self
                    .data
                    .as_u64()
                    .ok_or_else(|| "expected numeric data for u16 type".to_string())?;
                if n > u16::MAX as u64 {
                    return Err(format!("value {} exceeds u16 range", n));
                }
                Ok(CanonicalValue::U16(n as u16))
            }
            other => Err(format!("unknown value type: {}", other)),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TagValueChangedEvent {
    pub tag_id: String,
    pub value: TagTypedValue,
    pub timestamp: String,
}

// ============================================================================
// TagEventBridge
// ============================================================================

pub struct TagEventBridge {
    tag_registry: SharedTagRegistry,
    watched_tags: Arc<RwLock<HashSet<String>>>,
    app_handle: Arc<RwLock<Option<AppHandle>>>,
}

impl TagEventBridge {
    pub fn new(tag_registry: SharedTagRegistry) -> Self {
        Self {
            tag_registry,
            watched_tags: Arc::new(RwLock::new(HashSet::new())),
            app_handle: Arc::new(RwLock::new(None)),
        }
    }

    pub fn set_app_handle(&self, handle: AppHandle) {
        *self.app_handle.write() = Some(handle);
    }

    pub fn set_watched_tags(&self, tags: Vec<String>) {
        *self.watched_tags.write() = tags.into_iter().collect();
    }

    pub fn start(&self, bus: &CanonicalMemoryBus) {
        let rx = bus.subscribe();
        let tag_registry = Arc::clone(&self.tag_registry);
        let watched_tags = Arc::clone(&self.watched_tags);
        let app_handle = Arc::clone(&self.app_handle);

        tokio::spawn(async move {
            Self::subscriber_loop(rx, tag_registry, watched_tags, app_handle).await;
        });
    }

    async fn subscriber_loop(
        mut rx: broadcast::Receiver<CanonicalMemoryEvent>,
        tag_registry: SharedTagRegistry,
        watched_tags: Arc<RwLock<HashSet<String>>>,
        app_handle: Arc<RwLock<Option<AppHandle>>>,
    ) {
        loop {
            match rx.recv().await {
                Ok(event) => {
                    let changes: Vec<&CanonicalMemoryChange> = match &event {
                        CanonicalMemoryEvent::Single(change) => vec![change],
                        CanonicalMemoryEvent::Batch(batch) => batch.changes.iter().collect(),
                    };

                    let handle_guard = app_handle.read();
                    let Some(handle) = handle_guard.as_ref() else {
                        continue;
                    };

                    let watched = watched_tags.read();
                    if watched.is_empty() {
                        continue;
                    }

                    for change in changes {
                        let tag_ids = tag_registry.tags_for_address(&change.address);
                        for tag_id in tag_ids {
                            if watched.contains(&tag_id) {
                                let event = TagValueChangedEvent {
                                    tag_id,
                                    value: TagTypedValue::from_canonical(change.new_value),
                                    timestamp: change.timestamp.clone(),
                                };
                                let _ = handle.emit(TAG_VALUE_CHANGED_EVENT, event);
                            }
                        }
                    }
                }
                Err(broadcast::error::RecvError::Lagged(n)) => {
                    log::warn!("TagEventBridge lagged by {} events", n);
                }
                Err(broadcast::error::RecvError::Closed) => {
                    log::info!("TagEventBridge: bus closed, stopping subscriber");
                    break;
                }
            }
        }
    }
}
