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

pub struct ProtocolRuntime {
    adapter: Mutex<Option<Arc<dyn ProtocolAdapter>>>,
    task: Mutex<Option<tokio::task::JoinHandle<()>>>,
    flush_notify: Arc<Notify>,
}

impl Default for ProtocolRuntime {
    fn default() -> Self {
        Self::new()
    }
}

impl ProtocolRuntime {
    pub fn new() -> Self {
        Self {
            adapter: Mutex::new(None),
            task: Mutex::new(None),
            flush_notify: Arc::new(Notify::new()),
        }
    }

    pub fn attach_adapter(
        &self,
        runtime: Arc<CanonicalRuntimeFacade>,
        adapter: Arc<dyn ProtocolAdapter>,
    ) -> Result<(), String> {
        self.detach_adapter();
        adapter.full_sync().map_err(|e| e.to_string())?;
        *self.adapter.lock() = Some(Arc::clone(&adapter));

        let mut rx = runtime.handle().read().bus().subscribe();
        let flush_notify = Arc::clone(&self.flush_notify);
        let task = tokio::spawn(async move {
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
                                if adapter.full_sync().is_ok() {
                                    last_flush = Instant::now();
                                }
                            }
                            Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
                        }
                    }
                    _ = interval.tick() => {
                        if adapter.apply_external_writes().is_err() {
                            continue;
                        }
                        try_flush(adapter.as_ref(), &mut dirty_windows, &mut dirty_since, &mut last_flush);
                    }
                    _ = flush_notify.notified() => {
                        if adapter.apply_external_writes().is_ok() {
                            force_flush(adapter.as_ref(), &mut dirty_windows, &mut dirty_since, &mut last_flush);
                        }
                    }
                }
            }
        });

        *self.task.lock() = Some(task);
        Ok(())
    }

    pub fn detach_adapter(&self) {
        if let Some(task) = self.task.lock().take() {
            task.abort();
        }
        *self.adapter.lock() = None;
    }

    /// Backward-compatible alias for `detach_adapter`.
    pub fn detach_modbus(&self) {
        self.detach_adapter();
    }

    pub fn flush_now(&self) {
        self.flush_notify.notify_one();
    }

    pub fn has_adapter(&self) -> bool {
        self.adapter.lock().is_some()
    }

    /// Backward-compatible alias for `has_adapter`.
    pub fn has_modbus(&self) -> bool {
        self.has_adapter()
    }
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
    adapter: &dyn ProtocolAdapter,
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

    force_flush(adapter, dirty_windows, dirty_since, last_flush);
}

fn force_flush(
    adapter: &dyn ProtocolAdapter,
    dirty_windows: &mut HashMap<CanonicalAreaKind, DirtyPublishWindow>,
    dirty_since: &mut Option<Instant>,
    last_flush: &mut Instant,
) {
    if dirty_windows.is_empty() {
        *dirty_since = None;
        return;
    }

    let windows: Vec<_> = dirty_windows.values().copied().collect();
    if adapter.publish_dirty_state(&windows).is_ok() {
        dirty_windows.clear();
        *dirty_since = None;
        *last_flush = Instant::now();
    }
}
