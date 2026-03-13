use std::sync::Arc;

use parking_lot::{Mutex, RwLock};
use tauri::{AppHandle, Emitter};

use crate::modbus::{ModbusAdapter, ModbusMemory};
use crate::plc_runtime::resolve_modbus_mapping_policy;
use crate::project::{PlcSettings, ProjectConfig};

use super::canvas_sync::CanvasSync;
use super::counter::CounterManager;
use super::debugger::SimDebugger;
use super::engine::{EngineEvent, OneSimEngine};
use super::executor::CompiledProgram;
use super::memory::CanonicalRuntimeFacade;
use super::monitoring::MonitoringService;
use super::protocol_runtime::ProtocolRuntime;
use super::tag_registry::SharedTagRegistry;
use super::timer::TimerManager;
use super::types::{ScanCycleInfo, SimulationConfig, SimulationStatus};

const SIM_STATUS_UPDATE_EVENT: &str = "sim:status-update";
const SIM_SCAN_COMPLETE_EVENT: &str = "sim:scan-complete";
const SIM_STATE_CHANGE_EVENT: &str = "sim:state-change";
const SIM_WATCHDOG_EVENT: &str = "sim:watchdog";

pub struct SimulationRuntimeHost {
    engine: Arc<Mutex<Option<Arc<OneSimEngine>>>>,
    debugger: Arc<SimDebugger>,
    runtime: Arc<CanonicalRuntimeFacade>,
    modbus_memory: Option<Arc<ModbusMemory>>,
    program: Arc<Mutex<Option<CompiledProgram>>>,
    scan_task: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
    event_task: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
    monitoring: Arc<MonitoringService>,
    protocol_runtime: Arc<ProtocolRuntime>,
    canvas_sync: Arc<RwLock<Option<Arc<CanvasSync>>>>,
    tag_registry: SharedTagRegistry,
}

impl SimulationRuntimeHost {
    pub fn with_runtime(runtime: Arc<CanonicalRuntimeFacade>, tag_registry: SharedTagRegistry) -> Self {
        Self {
            engine: Arc::new(Mutex::new(None)),
            debugger: Arc::new(SimDebugger::with_tag_registry(100, Arc::clone(&tag_registry))),
            runtime,
            modbus_memory: None,
            program: Arc::new(Mutex::new(None)),
            scan_task: Arc::new(Mutex::new(None)),
            event_task: Arc::new(Mutex::new(None)),
            monitoring: Arc::new(MonitoringService::new()),
            protocol_runtime: Arc::new(ProtocolRuntime::new()),
            canvas_sync: Arc::new(RwLock::new(None)),
            tag_registry,
        }
    }

    pub fn with_runtime_and_modbus(
        runtime: Arc<CanonicalRuntimeFacade>,
        modbus_memory: Arc<ModbusMemory>,
        tag_registry: SharedTagRegistry,
    ) -> Self {
        let mut host = Self::with_runtime(runtime, tag_registry);
        host.modbus_memory = Some(modbus_memory);
        host
    }

    pub fn engine(&self) -> Arc<Mutex<Option<Arc<OneSimEngine>>>> {
        Arc::clone(&self.engine)
    }

    pub fn runtime(&self) -> &Arc<CanonicalRuntimeFacade> {
        &self.runtime
    }

    pub fn debugger(&self) -> Arc<SimDebugger> {
        Arc::clone(&self.debugger)
    }

    pub fn monitoring(&self) -> Arc<MonitoringService> {
        Arc::clone(&self.monitoring)
    }

    pub fn protocol_runtime(&self) -> Arc<ProtocolRuntime> {
        Arc::clone(&self.protocol_runtime)
    }

    pub fn tag_registry(&self) -> SharedTagRegistry {
        Arc::clone(&self.tag_registry)
    }

    pub fn load_program(&self, program: CompiledProgram) {
        *self.program.lock() = Some(program);
    }

    pub fn run(
        &self,
        app: AppHandle,
        project_config: Option<ProjectConfig>,
        plc_settings: PlcSettings,
        canvas_sync: Option<Arc<CanvasSync>>,
        config_override: Option<SimulationConfig>,
    ) -> Result<(), String> {
        let mut engine_guard = self.engine.lock();

        if let Some(ref engine) = *engine_guard {
            if engine.is_running() {
                return Err("Simulation is already running".to_string());
            }
        }

        if engine_guard.is_none() {
            let engine = Arc::new(OneSimEngine::with_components(
                Arc::clone(&self.runtime),
                Arc::new(TimerManager::new()),
                Arc::new(CounterManager::new()),
            ));
            *engine_guard = Some(engine);
        }

        let engine = engine_guard
            .as_ref()
            .cloned()
            .ok_or_else(|| "Failed to create engine".to_string())?;

        if let Some(config) = config_override {
            engine.set_config(config);
        }

        *self.canvas_sync.write() = canvas_sync;
        self.monitoring.start(
            app.clone(),
            Arc::clone(&self.runtime),
            Arc::clone(&self.debugger),
            Arc::clone(&self.tag_registry),
            Arc::clone(engine.timer_mgr()),
            Arc::clone(engine.counter_mgr()),
        );
        self.attach_modbus(project_config.as_ref(), &plc_settings)?;
        self.spawn_event_forwarder(app.clone(), Arc::clone(&engine));

        let program = self.program.lock().clone().unwrap_or_else(|| CompiledProgram {
            name: "Default Program".to_string(),
            networks: vec![],
        });
        engine.start(program).map_err(|e| e.to_string())?;

        drop(engine_guard);

        if let Some(handle) = self.scan_task.lock().take() {
            handle.abort();
        }

        let engine_clone = Arc::clone(&engine);
        let scan_task = tokio::spawn(async move {
            engine_clone.run_scan_loop().await;
        });
        *self.scan_task.lock() = Some(scan_task);

        emit_status_update(&app, &engine.get_status());
        Ok(())
    }

    pub fn stop(&self, app: &AppHandle) -> Result<(), String> {
        let stopped = {
            let engine_guard = self.engine.lock();
            if let Some(ref engine) = *engine_guard {
                engine.stop();
                true
            } else {
                false
            }
        };

        if !stopped {
            return Err("Simulation is not running".to_string());
        }

        if let Some(handle) = self.scan_task.lock().take() {
            handle.abort();
        }

        self.protocol_runtime.detach_modbus();
        self.monitoring.stop();
        emit_stopped(app);
        Ok(())
    }

    pub fn pause(&self, app: &AppHandle) -> Result<(), String> {
        let engine_guard = self.engine.lock();
        let engine = engine_guard
            .as_ref()
            .ok_or_else(|| "Simulation is not running".to_string())?;
        engine.pause().map_err(|e| e.to_string())?;
        emit_status_update(app, &engine.get_status());
        Ok(())
    }

    pub fn resume(&self, app: &AppHandle) -> Result<(), String> {
        let engine_guard = self.engine.lock();
        let engine = engine_guard
            .as_ref()
            .ok_or_else(|| "Simulation is not running".to_string())?;
        engine.resume().map_err(|e| e.to_string())?;
        emit_status_update(app, &engine.get_status());
        Ok(())
    }

    pub fn reset(&self, app: &AppHandle) {
        {
            let mut engine_guard = self.engine.lock();
            if let Some(ref engine) = *engine_guard {
                engine.stop();
            }
            *engine_guard = None;
        }

        if let Some(handle) = self.scan_task.lock().take() {
            handle.abort();
        }
        if let Some(handle) = self.event_task.lock().take() {
            handle.abort();
        }

        self.protocol_runtime.detach_modbus();
        self.monitoring.stop();
        self.monitoring.clear_forces();
        self.monitoring.set_active(false);
        self.debugger.reset();
        emit_stopped(app);
    }

    pub fn status(&self) -> SimulationStatus {
        self.engine
            .lock()
            .as_ref()
            .map(|engine| engine.get_status())
            .unwrap_or_default()
    }

    pub fn scan_info(&self) -> ScanCycleInfo {
        self.engine.lock().as_ref().map(|engine| engine.get_scan_info()).unwrap_or(ScanCycleInfo {
            cycle_count: 0,
            last_scan_time: 0,
            average_scan_time: 0,
            max_scan_time: 0,
            timestamp: 0,
        })
    }

    fn attach_modbus(
        &self,
        project_config: Option<&ProjectConfig>,
        plc_settings: &PlcSettings,
    ) -> Result<(), String> {
        let Some(modbus_memory) = self.modbus_memory.as_ref() else {
            self.protocol_runtime.detach_modbus();
            return Ok(());
        };

        let policy = if let Some(project_config) = project_config {
            resolve_modbus_mapping_policy(&project_config.plc, Some(&project_config.modbus.exposure))
                .map_err(|e| e.to_string())?
        } else {
            resolve_modbus_mapping_policy(plc_settings, None).map_err(|e| e.to_string())?
        };

        let adapter = Arc::new(ModbusAdapter::new(
            self.runtime.handle(),
            Arc::clone(modbus_memory),
            policy,
        ));
        self.protocol_runtime
            .attach_adapter(Arc::clone(&self.runtime), adapter)
    }

    fn spawn_event_forwarder(&self, app: AppHandle, engine: Arc<OneSimEngine>) {
        if let Some(handle) = self.event_task.lock().take() {
            handle.abort();
        }

        let mut rx = engine.subscribe_events();
        let monitoring = Arc::clone(&self.monitoring);
        let protocol_runtime = Arc::clone(&self.protocol_runtime);
        let runtime = Arc::clone(&self.runtime);
        let canvas_sync = Arc::clone(&self.canvas_sync);
        let tag_registry = Arc::clone(&self.tag_registry);
        let event_task = tokio::spawn(async move {
            while let Ok(event) = rx.recv().await {
                match event {
                    EngineEvent::StateChange(event) => {
                        let _ = app.emit(SIM_STATE_CHANGE_EVENT, &event);
                        emit_status_update(&app, &engine.get_status());
                    }
                    EngineEvent::ScanComplete(event) => {
                        if let Err(err) = monitoring.apply_forced_values(&runtime, &tag_registry) {
                            let _ = app.emit(
                                "ladder:monitoring-error",
                                serde_json::json!({
                                    "message": err,
                                    "timestamp": chrono::Utc::now().to_rfc3339()
                                }),
                            );
                        }
                        if let Some(sync) = canvas_sync.read().as_ref() {
                            let _ = sync.update_plc_outputs();
                        }
                        protocol_runtime.flush_now();
                        if event.scan_count % 10 == 0 {
                            let _ = app.emit(SIM_SCAN_COMPLETE_EVENT, &event);
                        }
                    }
                    EngineEvent::Watchdog(event) => {
                        let _ = app.emit(SIM_WATCHDOG_EVENT, &event);
                    }
                }
            }
        });

        *self.event_task.lock() = Some(event_task);
    }
}

fn emit_status_update(app: &AppHandle, status: &SimulationStatus) {
    let _ = app.emit(
        SIM_STATUS_UPDATE_EVENT,
        serde_json::json!({
            "status": status.state,
            "stats": {
                "scanCount": status.scan_count,
                "currentNetworkId": null,
                "timing": {
                    "current": status.last_scan_time_us as f64 / 1000.0,
                    "average": status.avg_scan_time_us as f64 / 1000.0,
                    "min": status.min_scan_time_us as f64 / 1000.0,
                    "max": status.max_scan_time_us as f64 / 1000.0
                },
                "watchdogTriggered": false
            }
        }),
    );
}

fn emit_stopped(app: &AppHandle) {
    let _ = app.emit(
        SIM_STATUS_UPDATE_EVENT,
        serde_json::json!({
            "status": "stopped",
            "stats": {
                "scanCount": 0,
                "currentNetworkId": null,
                "timing": { "current": 0.0, "average": 0.0, "min": 0.0, "max": 0.0 },
                "watchdogTriggered": false
            }
        }),
    );
}
