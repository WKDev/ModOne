use tokio::sync::broadcast;

use super::types::CanonicalMemoryEvent;

const DEFAULT_EVENT_BUS_CAPACITY: usize = 1024;

/// Broadcast bus used by protocol adapters and runtime observers.
#[derive(Clone, Debug)]
pub struct CanonicalMemoryBus {
    tx: broadcast::Sender<CanonicalMemoryEvent>,
}

impl CanonicalMemoryBus {
    pub fn new(capacity: usize) -> Self {
        let (tx, _) = broadcast::channel(capacity.max(1));
        Self { tx }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<CanonicalMemoryEvent> {
        self.tx.subscribe()
    }

    pub(crate) fn emit(&self, event: CanonicalMemoryEvent) {
        let _ = self.tx.send(event);
    }
}

impl Default for CanonicalMemoryBus {
    fn default() -> Self {
        Self::new(DEFAULT_EVENT_BUS_CAPACITY)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plc_runtime::types::{
        CanonicalAddress, CanonicalAreaKind, CanonicalMemoryBatchChange, CanonicalMemoryChange,
        CanonicalMemoryEvent, CanonicalValue, CanonicalWriteSource,
    };

    #[tokio::test]
    async fn delivers_events_in_order() {
        let bus = CanonicalMemoryBus::new(8);
        let mut rx = bus.subscribe();

        bus.emit(CanonicalMemoryEvent::Single(CanonicalMemoryChange {
            address: CanonicalAddress::new(CanonicalAreaKind::InternalBit, 1),
            old_value: Some(CanonicalValue::Bool(false)),
            new_value: CanonicalValue::Bool(true),
            source: CanonicalWriteSource::Simulation,
            timestamp: "2026-03-12T00:00:00Z".to_string(),
            batch_id: None,
        }));

        bus.emit(CanonicalMemoryEvent::Batch(CanonicalMemoryBatchChange {
            batch_id: "batch-1".to_string(),
            timestamp: "2026-03-12T00:00:01Z".to_string(),
            changes: vec![CanonicalMemoryChange {
                address: CanonicalAddress::new(CanonicalAreaKind::DataWord, 3),
                old_value: Some(CanonicalValue::U16(0)),
                new_value: CanonicalValue::U16(7),
                source: CanonicalWriteSource::ExternalProtocol,
                timestamp: "2026-03-12T00:00:01Z".to_string(),
                batch_id: Some("batch-1".to_string()),
            }],
        }));

        let first = rx.recv().await.expect("first event");
        let second = rx.recv().await.expect("second event");

        assert!(matches!(first, CanonicalMemoryEvent::Single(_)));
        assert!(matches!(second, CanonicalMemoryEvent::Batch(_)));
    }
}
