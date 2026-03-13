use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use parking_lot::{Mutex, RwLock};
use tauri::{AppHandle, Emitter};

use crate::plc_runtime::{CanonicalAddress, CanonicalMemoryEvent, CanonicalValue, CanonicalWriteSource};

use super::debugger::SimDebugger;
use super::memory::CanonicalRuntimeFacade;
use super::timer::TimerManager;
use super::counter::CounterManager;
use super::types::{ForcedDeviceValue, RuntimeBinding};

const MONITORING_EVENT_NAME: &str = "ladder:monitoring-update";
const MONITORING_ERROR_EVENT: &str = "ladder:monitoring-error";
const MONITORING_COALESCE_WINDOW: Duration = Duration::from_millis(5);

pub struct MonitoringService {
    active: Arc<std::sync::atomic::AtomicBool>,
    forced_devices: Arc<RwLock<HashMap<String, ForcedDeviceValue>>>,
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
            active: Arc::new(std::sync::atomic::AtomicBool::new(false)),
            forced_devices: Arc::new(RwLock::new(HashMap::new())),
            task: Mutex::new(None),
        }
    }

    pub fn start(
        &self,
        app: AppHandle,
        runtime: Arc<CanonicalRuntimeFacade>,
        debugger: Arc<SimDebugger>,
        timer_mgr: Arc<TimerManager>,
        counter_mgr: Arc<CounterManager>,
    ) {
        self.stop();

        let active = Arc::clone(&self.active);
        let forced_devices = Arc::clone(&self.forced_devices);
        let mut rx = runtime.handle().read().bus().subscribe();
        let task = tokio::spawn(async move {
            let mut tracked_values: HashMap<CanonicalAddress, CanonicalValue> = HashMap::new();
            let mut dirty = false;
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
                        if !active.load(std::sync::atomic::Ordering::Relaxed) || !dirty {
                            continue;
                        }
                        dirty = false;
                        if let Err(err) = emit_snapshot(
                            &app,
                            &runtime,
                            &debugger,
                            &forced_devices,
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
        self.active.store(active, std::sync::atomic::Ordering::SeqCst);
    }

    pub fn is_active(&self) -> bool {
        self.active.load(std::sync::atomic::Ordering::Relaxed)
    }

    pub fn force_device(&self, forced: ForcedDeviceValue) {
        self.forced_devices
            .write()
            .insert(forced.display_address.clone(), forced);
    }

    pub fn release_force(&self, display_address: &str) {
        self.forced_devices.write().remove(display_address);
    }

    pub fn clear_forces(&self) {
        self.forced_devices.write().clear();
    }

    pub fn apply_forced_values(&self, runtime: &CanonicalRuntimeFacade) -> Result<(), String> {
        let forced = self.forced_devices.read();
        for forced_value in forced.values() {
            let Some(canonical) = forced_value.binding.canonical_address() else {
                return Err(format!(
                    "Tag-bound forced device is not implemented yet: {}",
                    forced_value.display_address
                ));
            };

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
}

fn track_event(
    tracked_values: &mut HashMap<CanonicalAddress, CanonicalValue>,
    event: CanonicalMemoryEvent,
) {
    match event {
        CanonicalMemoryEvent::Single(change) => {
            tracked_values.insert(change.address, change.new_value);
        }
        CanonicalMemoryEvent::Batch(batch) => {
            for change in batch.changes {
                tracked_values.insert(change.address, change.new_value);
            }
        }
    }
}

fn emit_snapshot(
    app: &AppHandle,
    runtime: &CanonicalRuntimeFacade,
    debugger: &SimDebugger,
    forced_devices: &RwLock<HashMap<String, ForcedDeviceValue>>,
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

    for (address, value) in tracked_values {
        let binding = RuntimeBinding::canonical(*address);
        if devices.iter().any(|entry| entry["binding"] == serde_json::to_value(&binding).unwrap_or_default()) {
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
