//! ModbusMemory 변경 이벤트를 Tauri 이벤트 시스템으로 흘려보내는 native 싱크

use std::sync::Arc;

use tauri::Emitter;

use modbus_codec::{MemoryBatchChangeEvent, MemoryChangeEvent, MemoryEventSink};

// Event channel names
const EVENT_MEMORY_CHANGED: &str = "modbus:memory-changed";
const EVENT_MEMORY_BATCH_CHANGED: &str = "modbus:memory-batch-changed";

/// `MemoryEventSink` 의 Tauri 구현. `AppHandle` 을 감싸 메모리 변경 이벤트를
/// 프런트엔드로 emit 한다. wasm tier 에서는 이 싱크를 주입하지 않는다.
pub struct TauriEventSink {
    app_handle: Arc<tauri::AppHandle>,
}

impl TauriEventSink {
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        Self {
            app_handle: Arc::new(app_handle),
        }
    }
}

impl MemoryEventSink for TauriEventSink {
    fn emit_change(&self, event: &MemoryChangeEvent) {
        let _ = self.app_handle.emit(EVENT_MEMORY_CHANGED, event);
    }

    fn emit_batch(&self, event: &MemoryBatchChangeEvent) {
        let _ = self.app_handle.emit(EVENT_MEMORY_BATCH_CHANGED, event);
    }
}
