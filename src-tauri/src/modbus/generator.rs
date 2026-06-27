//! 레지스터/코일 값을 주기적으로 자동 변동시키는 값 제너레이터 엔진
//!
//! ModRSsim2/ModbusPal 류의 "값 제너레이터"에 해당. 사인파/램프/사각파/랜덤/카운터로
//! 메모리를 흔들어 HMI 트렌드·알람 테스트를 돕는다. 쓰기는 `ChangeSource::Simulation`.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

use super::{ChangeSource, ModbusMemory};

/// 엔진 틱 간격 (10 Hz)
const TICK_MS: u64 = 100;

/// 제너레이터가 쓸 대상 메모리 영역
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum GeneratorTarget {
    Coil,
    Discrete,
    Holding,
    Input,
}

/// 파형 종류
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Waveform {
    Sine,
    Ramp,
    Square,
    Random,
    Counter,
}

/// 단일 제너레이터 설정 (프론트엔드와 주고받는 와이어 포맷)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratorConfig {
    pub id: String,
    pub enabled: bool,
    pub target: GeneratorTarget,
    pub address: u16,
    pub waveform: Waveform,
    /// 한 주기 길이(ms)
    pub period_ms: u64,
    /// 출력 하한
    pub min: f64,
    /// 출력 상한
    pub max: f64,
}

/// 제너레이터별 런타임 상태(카운터/난수 시드)
struct GenRuntime {
    counter: u64,
    rng: u32,
}

/// 값 제너레이터 엔진 — 설정 목록을 공유하고 단일 틱 루프가 메모리에 기록한다.
pub struct GeneratorManager {
    memory: Arc<ModbusMemory>,
    generators: Arc<RwLock<Vec<GeneratorConfig>>>,
    running: Arc<AtomicBool>,
    task: Mutex<Option<tokio::task::JoinHandle<()>>>,
}

impl GeneratorManager {
    pub fn new(memory: Arc<ModbusMemory>) -> Self {
        Self {
            memory,
            generators: Arc::new(RwLock::new(Vec::new())),
            running: Arc::new(AtomicBool::new(false)),
            task: Mutex::new(None),
        }
    }

    pub fn get_generators(&self) -> Vec<GeneratorConfig> {
        self.generators.read().clone()
    }

    /// 설정 목록을 교체하고, 활성 항목이 있으면 엔진을 가동/유지한다.
    pub async fn set_generators(&self, list: Vec<GeneratorConfig>) {
        let any_enabled = list.iter().any(|g| g.enabled);
        *self.generators.write() = list;

        if any_enabled {
            self.start().await;
        } else {
            self.stop().await;
        }
    }

    /// 틱 루프 시작 (이미 돌고 있으면 무시).
    pub async fn start(&self) {
        let mut task = self.task.lock().await;
        if self.running.load(Ordering::SeqCst) {
            return;
        }
        self.running.store(true, Ordering::SeqCst);

        let memory = Arc::clone(&self.memory);
        let generators = Arc::clone(&self.generators);
        let running = Arc::clone(&self.running);

        *task = Some(tokio::spawn(async move {
            tick_loop(memory, generators, running).await;
        }));
    }

    /// 틱 루프 정지.
    pub async fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
        if let Some(handle) = self.task.lock().await.take() {
            let _ = handle.await;
        }
    }
}

async fn tick_loop(
    memory: Arc<ModbusMemory>,
    generators: Arc<RwLock<Vec<GeneratorConfig>>>,
    running: Arc<AtomicBool>,
) {
    let started = Instant::now();
    let mut state: HashMap<String, GenRuntime> = HashMap::new();
    let mut interval = tokio::time::interval(std::time::Duration::from_millis(TICK_MS));

    while running.load(Ordering::SeqCst) {
        interval.tick().await;
        let elapsed_s = started.elapsed().as_secs_f64();

        let snapshot = generators.read().clone();
        let mut live_ids = std::collections::HashSet::new();

        for gen in &snapshot {
            live_ids.insert(gen.id.clone());
            if !gen.enabled {
                continue;
            }
            let rt = state.entry(gen.id.clone()).or_insert_with(|| GenRuntime {
                counter: 0,
                rng: seed_from_id(&gen.id),
            });

            let value = compute_value(gen, elapsed_s, rt);
            write_value(&memory, gen, value);
        }

        // 사라진 제너레이터의 런타임 상태 정리
        state.retain(|id, _| live_ids.contains(id));
    }
}

fn seed_from_id(id: &str) -> u32 {
    // 결정적이지만 id마다 다른 시드
    let mut h: u32 = 2166136261;
    for b in id.bytes() {
        h ^= b as u32;
        h = h.wrapping_mul(16777619);
    }
    h | 1 // 0 회피
}

fn xorshift(state: &mut u32) -> u32 {
    let mut x = *state;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    *state = x;
    x
}

/// 파형 + 런타임 상태로부터 현재 출력값(f64)을 계산한다.
fn compute_value(gen: &GeneratorConfig, elapsed_s: f64, rt: &mut GenRuntime) -> f64 {
    let span = gen.max - gen.min;
    let period_s = (gen.period_ms.max(1) as f64) / 1000.0;
    let phase = (elapsed_s % period_s) / period_s; // 0.0..1.0

    match gen.waveform {
        Waveform::Sine => {
            let s = (phase * std::f64::consts::TAU).sin(); // -1..1
            gen.min + span * (0.5 + 0.5 * s)
        }
        Waveform::Ramp => gen.min + span * phase,
        Waveform::Square => {
            if phase < 0.5 {
                gen.max
            } else {
                gen.min
            }
        }
        Waveform::Counter => {
            let steps = (span.max(0.0) as u64) + 1;
            let v = gen.min + (rt.counter % steps) as f64;
            rt.counter = rt.counter.wrapping_add(1);
            v
        }
        Waveform::Random => {
            let r = (xorshift(&mut rt.rng) as f64) / (u32::MAX as f64); // 0..1
            gen.min + span * r
        }
    }
}

fn write_value(memory: &ModbusMemory, gen: &GeneratorConfig, value: f64) {
    match gen.target {
        GeneratorTarget::Coil => {
            let on = value >= (gen.min + gen.max) / 2.0;
            let _ = memory.write_coil_with_source(gen.address, on, ChangeSource::Simulation);
        }
        GeneratorTarget::Discrete => {
            let on = value >= (gen.min + gen.max) / 2.0;
            let _ =
                memory.write_discrete_input_with_source(gen.address, on, ChangeSource::Simulation);
        }
        GeneratorTarget::Holding => {
            let v = value.round().clamp(0.0, u16::MAX as f64) as u16;
            let _ =
                memory.write_holding_register_with_source(gen.address, v, ChangeSource::Simulation);
        }
        GeneratorTarget::Input => {
            let v = value.round().clamp(0.0, u16::MAX as f64) as u16;
            let _ =
                memory.write_input_register_with_source(gen.address, v, ChangeSource::Simulation);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn gen(waveform: Waveform, min: f64, max: f64, period_ms: u64) -> GeneratorConfig {
        GeneratorConfig {
            id: "g1".into(),
            enabled: true,
            target: GeneratorTarget::Holding,
            address: 0,
            waveform,
            period_ms,
            min,
            max,
        }
    }

    fn rt() -> GenRuntime {
        GenRuntime { counter: 0, rng: 12345 }
    }

    #[test]
    fn sine_stays_within_bounds() {
        let g = gen(Waveform::Sine, 0.0, 100.0, 1000);
        let mut r = rt();
        for i in 0..100 {
            let v = compute_value(&g, i as f64 * 0.01, &mut r);
            assert!((0.0..=100.0).contains(&v), "sine out of range: {}", v);
        }
    }

    #[test]
    fn ramp_is_monotonic_within_period() {
        let g = gen(Waveform::Ramp, 0.0, 100.0, 1000);
        let mut r = rt();
        let a = compute_value(&g, 0.1, &mut r);
        let b = compute_value(&g, 0.5, &mut r);
        assert!(b > a);
    }

    #[test]
    fn square_is_high_then_low() {
        let g = gen(Waveform::Square, 10.0, 20.0, 1000);
        let mut r = rt();
        assert_eq!(compute_value(&g, 0.1, &mut r), 20.0); // 1st half
        assert_eq!(compute_value(&g, 0.6, &mut r), 10.0); // 2nd half
    }

    #[test]
    fn counter_wraps() {
        let g = gen(Waveform::Counter, 0.0, 2.0, 1000); // steps = 3
        let mut r = rt();
        assert_eq!(compute_value(&g, 0.0, &mut r), 0.0);
        assert_eq!(compute_value(&g, 0.0, &mut r), 1.0);
        assert_eq!(compute_value(&g, 0.0, &mut r), 2.0);
        assert_eq!(compute_value(&g, 0.0, &mut r), 0.0);
    }

    #[test]
    fn random_within_bounds() {
        let g = gen(Waveform::Random, 5.0, 15.0, 1000);
        let mut r = rt();
        for _ in 0..50 {
            let v = compute_value(&g, 0.0, &mut r);
            assert!((5.0..=15.0).contains(&v));
        }
    }
}
