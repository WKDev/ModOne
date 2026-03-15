use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use parking_lot::Mutex;
use tokio::sync::Notify;

use crate::modbus::{DirtyPublishWindow, ProtocolAdapter};
use crate::plc_runtime::{CanonicalAreaKind, CanonicalMemoryEvent};

use super::memory::CanonicalRuntimeFacade;

const PROTOCOL_COALESCE_WINDOW: Duration = Duration::from_millis(2);
const PROTOCOL_MAX_DEFERRED_FLUSH: Duration = Duration::from_millis(10);

struct NamedAdapter {
    id: &'static str,
    adapter: Arc<dyn ProtocolAdapter>,
}

/// Shared adapter list accessible from both the main thread and the background task.
type SharedAdapterList = Arc<Mutex<Vec<NamedAdapter>>>;

pub struct ProtocolRuntime {
    adapters: SharedAdapterList,
    task: Mutex<Option<tokio::task::JoinHandle<()>>>,
    flush_notify: Arc<Notify>,
    runtime_ref: Mutex<Option<Arc<CanonicalRuntimeFacade>>>,
}

impl Default for ProtocolRuntime {
    fn default() -> Self {
        Self::new()
    }
}

impl ProtocolRuntime {
    pub fn new() -> Self {
        Self {
            adapters: Arc::new(Mutex::new(Vec::new())),
            task: Mutex::new(None),
            flush_notify: Arc::new(Notify::new()),
            runtime_ref: Mutex::new(None),
        }
    }

    pub fn attach_adapter(
        &self,
        id: &'static str,
        runtime: Arc<CanonicalRuntimeFacade>,
        adapter: Arc<dyn ProtocolAdapter>,
    ) -> Result<(), String> {
        // Remove existing adapter with same id (if any), without stopping the task
        {
            let mut adapters = self.adapters.lock();
            adapters.retain(|a| a.id != id);
        }

        adapter.full_sync().map_err(|e| e.to_string())?;

        {
            let mut adapters = self.adapters.lock();
            adapters.push(NamedAdapter {
                id,
                adapter,
            });
        }

        *self.runtime_ref.lock() = Some(Arc::clone(&runtime));

        // Start the background task if not already running
        if self.task.lock().is_none() {
            self.spawn_task(runtime);
        }

        Ok(())
    }

    pub fn detach_adapter(&self, id: &'static str) {
        let is_empty = {
            let mut adapters = self.adapters.lock();
            adapters.retain(|a| a.id != id);
            adapters.is_empty()
        };
        if is_empty {
            self.stop_task();
        }
    }

    pub fn detach_all(&self) {
        self.adapters.lock().clear();
        self.stop_task();
    }

    /// Backward-compatible alias for detaching the modbus adapter.
    pub fn detach_modbus(&self) {
        self.detach_adapter("modbus");
    }

    pub fn flush_now(&self) {
        self.flush_notify.notify_one();
    }

    pub fn has_adapter(&self) -> bool {
        !self.adapters.lock().is_empty()
    }

    pub fn has_adapter_id(&self, id: &str) -> bool {
        self.adapters.lock().iter().any(|a| a.id == id)
    }

    /// Backward-compatible alias for `has_adapter_id("modbus")`.
    pub fn has_modbus(&self) -> bool {
        self.has_adapter_id("modbus")
    }

    fn spawn_task(&self, runtime: Arc<CanonicalRuntimeFacade>) {
        let mut rx = runtime.handle().read().bus().subscribe();
        let flush_notify = Arc::clone(&self.flush_notify);
        let shared_adapters = Arc::clone(&self.adapters);

        let task = tokio::spawn(async move {
            let adapters = shared_adapters;
            let mut dirty_windows: HashMap<CanonicalAreaKind, DirtyPublishWindow> = HashMap::new();
            let mut dirty_since: Option<Instant> = None;
            let mut last_flush = Instant::now();
            let mut interval = tokio::time::interval(PROTOCOL_COALESCE_WINDOW);

            loop {
                tokio::select! {
                    recv = rx.recv() => {
                        match recv {
                            Ok(event) => {
                                merge_event(&mut dirty_windows, event);
                                dirty_since.get_or_insert_with(Instant::now);
                            }
                            Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => {
                                dirty_windows.clear();
                                let snapshot = collect_adapters(&adapters);
                                for a in &snapshot {
                                    let _ = a.full_sync();
                                }
                                last_flush = Instant::now();
                            }
                            Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
                        }
                    }
                    _ = interval.tick() => {
                        let snapshot = collect_adapters(&adapters);
                        let mut writes_ok = true;
                        for a in &snapshot {
                            if a.apply_external_writes().is_err() {
                                writes_ok = false;
                            }
                        }
                        if writes_ok {
                            try_flush(&snapshot, &mut dirty_windows, &mut dirty_since, &mut last_flush);
                        }
                    }
                    _ = flush_notify.notified() => {
                        let snapshot = collect_adapters(&adapters);
                        let mut writes_ok = true;
                        for a in &snapshot {
                            if a.apply_external_writes().is_err() {
                                writes_ok = false;
                            }
                        }
                        if writes_ok {
                            force_flush(&snapshot, &mut dirty_windows, &mut dirty_since, &mut last_flush);
                        }
                    }
                }
            }
        });

        *self.task.lock() = Some(task);
    }

    fn stop_task(&self) {
        if let Some(task) = self.task.lock().take() {
            task.abort();
        }
        *self.runtime_ref.lock() = None;
    }
}

/// Collect current adapter Arc references from the shared list.
fn collect_adapters(adapters: &SharedAdapterList) -> Vec<Arc<dyn ProtocolAdapter>> {
    adapters.lock().iter().map(|a| Arc::clone(&a.adapter)).collect()
}

fn merge_event(
    dirty_windows: &mut HashMap<CanonicalAreaKind, DirtyPublishWindow>,
    event: CanonicalMemoryEvent,
) {
    match event {
        CanonicalMemoryEvent::Single(change) => merge_address(dirty_windows, change.address),
        CanonicalMemoryEvent::Batch(batch) => {
            for change in batch.changes {
                merge_address(dirty_windows, change.address);
            }
        }
    }
}

fn merge_address(
    dirty_windows: &mut HashMap<CanonicalAreaKind, DirtyPublishWindow>,
    address: crate::plc_runtime::CanonicalAddress,
) {
    dirty_windows
        .entry(address.area)
        .and_modify(|window| {
            window.start_index = window.start_index.min(address.index);
            window.end_index = window.end_index.max(address.index);
        })
        .or_insert_with(|| DirtyPublishWindow::single(address));
}

fn try_flush(
    adapters: &[Arc<dyn ProtocolAdapter>],
    dirty_windows: &mut HashMap<CanonicalAreaKind, DirtyPublishWindow>,
    dirty_since: &mut Option<Instant>,
    last_flush: &mut Instant,
) {
    let Some(dirty_start) = *dirty_since else {
        return;
    };

    let now = Instant::now();
    if now.duration_since(dirty_start) < PROTOCOL_COALESCE_WINDOW
        && now.duration_since(*last_flush) < PROTOCOL_MAX_DEFERRED_FLUSH
    {
        return;
    }

    force_flush(adapters, dirty_windows, dirty_since, last_flush);
}

fn force_flush(
    adapters: &[Arc<dyn ProtocolAdapter>],
    dirty_windows: &mut HashMap<CanonicalAreaKind, DirtyPublishWindow>,
    dirty_since: &mut Option<Instant>,
    last_flush: &mut Instant,
) {
    if dirty_windows.is_empty() {
        *dirty_since = None;
        return;
    }

    let windows: Vec<_> = dirty_windows.values().copied().collect();
    let mut all_ok = true;
    for adapter in adapters {
        if adapter.publish_dirty_state(&windows).is_err() {
            all_ok = false;
        }
    }
    if all_ok {
        dirty_windows.clear();
        *dirty_since = None;
        *last_flush = Instant::now();
    }
}
