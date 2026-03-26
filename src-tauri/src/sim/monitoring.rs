use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use parking_lot::{Mutex, RwLock};
use tauri::{AppHandle, Emitter};

use crate::plc_runtime::{
    CanonicalAddress, CanonicalMemoryEvent, CanonicalValue, CanonicalWriteSource,
};

use super::counter::CounterManager;
use super::debugger::SimDebugger;
use super::memory::CanonicalRuntimeFacade;
use super::tag_registry::SharedTagRegistry;
use super::timer::TimerManager;
use super::types::{ForcedDeviceValue, RuntimeBinding};

const MONITORING_EVENT_NAME: &str = "ladder:monitoring-update";
const MONITORING_ERROR_EVENT: &str = "ladder:monitoring-error";
const MONITORING_COALESCE_WINDOW: Duration = Duration::from_millis(100);
const MAX_TRACKED_VALUES: usize = 1024;

pub struct MonitoringService {
    active: Arc<AtomicBool>,
    refresh_requested: Arc<AtomicBool>,
    forced_devices: Arc<RwLock<HashMap<String, ForcedDeviceValue>>>,
    tracked_bindings: Arc<RwLock<HashMap<RuntimeBinding, String>>>,
    task: Mutex<Option<tokio::task::JoinHandle<()>>>,
}

impl Default for MonitoringService {
    fn default() -> Self {
        Self::new()
    }
}

impl MonitoringService {
    pub fn new() -> Self {
        Self {
            active: Arc::new(AtomicBool::new(false)),
            refresh_requested: Arc::new(AtomicBool::new(true)),
            forced_devices: Arc::new(RwLock::new(HashMap::new())),
            tracked_bindings: Arc::new(RwLock::new(HashMap::new())),
            task: Mutex::new(None),
        }
    }

    pub fn start(
        &self,
        app: AppHandle,
        runtime: Arc<CanonicalRuntimeFacade>,
        debugger: Arc<SimDebugger>,
        tag_registry: SharedTagRegistry,
        timer_mgr: Arc<TimerManager>,
        counter_mgr: Arc<CounterManager>,
    ) {
        self.stop();

        let active = Arc::clone(&self.active);
        let refresh_requested = Arc::clone(&self.refresh_requested);
        let forced_devices = Arc::clone(&self.forced_devices);
        let tracked_bindings = Arc::clone(&self.tracked_bindings);
        let mut rx = runtime.handle().read().bus().subscribe();
        let task = tokio::spawn(async move {
            let mut tracked_values: HashMap<CanonicalAddress, CanonicalValue> = HashMap::new();
            let mut dirty = true;
            let mut interval = tokio::time::interval(MONITORING_COALESCE_WINDOW);

            loop {
                tokio::select! {
                    recv = rx.recv() => {
                        match recv {
                            Ok(event) => {
                                track_event(&mut tracked_values, event);
                                dirty = true;
                            }
                            Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => {
                                dirty = true;
                            }
                            Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
                        }
                    }
                    _ = interval.tick() => {
                        let requested = refresh_requested.swap(false, Ordering::SeqCst);
                        if !active.load(Ordering::Relaxed) || (!dirty && !requested) {
                            continue;
                        }
                        dirty = false;
                        if let Err(err) = emit_snapshot(
                            &app,
                            &runtime,
                            &debugger,
                            &tag_registry,
                            &forced_devices,
                            &tracked_bindings,
                            &tracked_values,
                            &timer_mgr,
                            &counter_mgr,
                        ) {
                            let _ = app.emit(
                                MONITORING_ERROR_EVENT,
                                serde_json::json!({
                                    "message": err,
                                    "timestamp": chrono::Utc::now().to_rfc3339()
                                }),
                            );
                        }
                    }
                }
            }
        });

        *self.task.lock() = Some(task);
    }

    pub fn stop(&self) {
        if let Some(task) = self.task.lock().take() {
            task.abort();
        }
    }

    pub fn set_active(&self, active: bool) {
        self.active.store(active, Ordering::SeqCst);
        if active {
            self.refresh_requested.store(true, Ordering::SeqCst);
        }
    }

    pub fn is_active(&self) -> bool {
        self.active.load(Ordering::Relaxed)
    }

    pub fn force_device(&self, forced: ForcedDeviceValue) {
        self.register_binding(forced.binding.clone(), forced.display_address.clone());
        self.forced_devices
            .write()
            .insert(forced.display_address.clone(), forced);
        self.refresh_requested.store(true, Ordering::SeqCst);
    }

    pub fn release_force(&self, display_address: &str, binding: &RuntimeBinding) {
        self.forced_devices.write().remove(display_address);
        self.unregister_binding(binding);
        self.refresh_requested.store(true, Ordering::SeqCst);
    }

    pub fn clear_forces(&self) {
        self.forced_devices.write().clear();
        self.refresh_requested.store(true, Ordering::SeqCst);
    }

    pub fn apply_forced_values(
        &self,
        runtime: &CanonicalRuntimeFacade,
        tag_registry: &SharedTagRegistry,
    ) -> Result<(), String> {
        let forced = self.forced_devices.read();
        for forced_value in forced.values() {
            let canonical = tag_registry
                .resolve_binding(&forced_value.binding)
                .map_err(|e| e.to_string())?;

            if canonical.area.is_bit_area() || canonical.bit_index.is_some() {
                let Some(value) = forced_value.value.as_bool() else {
                    continue;
                };
                runtime
                    .write_bool(canonical, value, CanonicalWriteSource::Simulation)
                    .map_err(|e| e.to_string())?;
            } else {
                let Some(value) = forced_value.value.as_u64() else {
                    continue;
                };
                runtime
                    .write_word_value(canonical, value as u16, CanonicalWriteSource::Simulation)
                    .map_err(|e| e.to_string())?;
            }
        }

        Ok(())
    }

    pub fn active_handle(&self) -> Arc<std::sync::atomic::AtomicBool> {
        Arc::clone(&self.active)
    }

    pub fn forced_devices(&self) -> Arc<RwLock<HashMap<String, ForcedDeviceValue>>> {
        Arc::clone(&self.forced_devices)
    }

    pub fn register_binding(&self, binding: RuntimeBinding, display_address: String) {
        self.tracked_bindings
            .write()
            .insert(binding, display_address);
        self.refresh_requested.store(true, Ordering::SeqCst);
    }

    pub fn unregister_binding(&self, binding: &RuntimeBinding) {
        self.tracked_bindings.write().remove(binding);
        self.refresh_requested.store(true, Ordering::SeqCst);
    }
}

fn track_event(
    tracked_values: &mut HashMap<CanonicalAddress, CanonicalValue>,
    event: CanonicalMemoryEvent,
) {
    match event {
        CanonicalMemoryEvent::Single(change) => {
            if tracked_values.len() < MAX_TRACKED_VALUES
                || tracked_values.contains_key(&change.address)
            {
                tracked_values.insert(change.address, change.new_value);
            }
        }
        CanonicalMemoryEvent::Batch(batch) => {
            for change in batch.changes {
                if tracked_values.len() < MAX_TRACKED_VALUES
                    || tracked_values.contains_key(&change.address)
                {
                    tracked_values.insert(change.address, change.new_value);
                }
            }
        }
    }
}

fn emit_snapshot(
    app: &AppHandle,
    runtime: &CanonicalRuntimeFacade,
    debugger: &SimDebugger,
    tag_registry: &SharedTagRegistry,
    forced_devices: &RwLock<HashMap<String, ForcedDeviceValue>>,
    tracked_bindings: &RwLock<HashMap<RuntimeBinding, String>>,
    tracked_values: &HashMap<CanonicalAddress, CanonicalValue>,
    timer_mgr: &TimerManager,
    counter_mgr: &CounterManager,
) -> Result<(), String> {
    let mut devices = Vec::new();

    for watch in debugger.get_watches() {
        if let Some(address) = watch.binding.canonical_address() {
            let value = runtime.read(address).map_err(|e| e.to_string())?;
            devices.push(serde_json::json!({
                "address": watch.address,
                "binding": watch.binding,
                "value": canonical_json_value(value)
            }));
        }
    }

    for (binding, display_address) in tracked_bindings.read().iter() {
        let Ok(address) = tag_registry.resolve_binding(binding) else {
            continue;
        };
        if devices
            .iter()
            .any(|entry| entry["binding"] == serde_json::to_value(binding).unwrap_or_default())
        {
            continue;
        }
        let value = runtime.read(address).map_err(|e| e.to_string())?;
        devices.push(serde_json::json!({
            "address": display_address,
            "binding": binding,
            "value": canonical_json_value(value)
        }));
    }

    for (address, value) in tracked_values {
        let binding = RuntimeBinding::canonical(*address);
        if devices
            .iter()
            .any(|entry| entry["binding"] == serde_json::to_value(&binding).unwrap_or_default())
        {
            continue;
        }
        devices.push(serde_json::json!({
            "address": format!("{}:{}", area_label(address.area), address.index),
            "binding": binding,
            "value": canonical_json_value(*value)
        }));
    }

    let timers: Vec<_> = timer_mgr
        .get_all_states()
        .into_iter()
        .map(|(addr, state)| {
            serde_json::json!({
                "address": format!("T{}", addr),
                "binding": RuntimeBinding::canonical(CanonicalAddress::new(crate::plc_runtime::CanonicalAreaKind::TimerValueWord, addr.into())),
                "state": state
            })
        })
        .collect();

    let counters: Vec<_> = counter_mgr
        .get_all_states()
        .into_iter()
        .map(|(addr, state)| {
            serde_json::json!({
                "address": format!("C{}", addr),
                "binding": RuntimeBinding::canonical(CanonicalAddress::new(crate::plc_runtime::CanonicalAreaKind::CounterValueWord, addr.into())),
                "state": state
            })
        })
        .collect();

    let forced: Vec<_> = forced_devices
        .read()
        .values()
        .map(|forced| {
            serde_json::json!({
                "address": forced.display_address,
                "binding": forced.binding,
                "value": forced.value,
            })
        })
        .collect();

    app.emit(
        MONITORING_EVENT_NAME,
        serde_json::json!({
            "devices": devices,
            "timers": timers,
            "counters": counters,
            "forcedDevices": forced,
        }),
    )
    .map_err(|e| e.to_string())
}

fn canonical_json_value(value: CanonicalValue) -> serde_json::Value {
    match value {
        CanonicalValue::Bool(bit) => serde_json::json!(bit),
        CanonicalValue::U16(word) => serde_json::json!(word),
    }
}

fn area_label(area: crate::plc_runtime::CanonicalAreaKind) -> &'static str {
    use crate::plc_runtime::CanonicalAreaKind;

    match area {
        CanonicalAreaKind::InputBit => "InputBit",
        CanonicalAreaKind::OutputBit => "OutputBit",
        CanonicalAreaKind::InternalBit => "InternalBit",
        CanonicalAreaKind::RetentiveBit => "RetentiveBit",
        CanonicalAreaKind::SpecialBit => "SpecialBit",
        CanonicalAreaKind::DataWord => "DataWord",
        CanonicalAreaKind::RetentiveWord => "RetentiveWord",
        CanonicalAreaKind::IndexWord => "IndexWord",
        CanonicalAreaKind::TimerDoneBit => "TimerDoneBit",
        CanonicalAreaKind::TimerValueWord => "TimerValueWord",
        CanonicalAreaKind::CounterDoneBit => "CounterDoneBit",
        CanonicalAreaKind::CounterValueWord => "CounterValueWord",
        CanonicalAreaKind::SystemBit => "SystemBit",
        CanonicalAreaKind::SystemWord => "SystemWord",
    }
}
