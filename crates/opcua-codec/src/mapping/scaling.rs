// 원시 레지스터 값(raw)과 엔지니어링 값(eng) 사이의 스케일링 변환(선형/제곱근)
//
// PLC 레지스터는 정수(예: 0..27648)지만 사용자는 엔지니어링 단위(예: 0..100 °C)를
// 보고 싶어 한다. 스케일링이 활성화되면 OPC UA 노드는 엔지니어링 값(Double)을
// 노출하고, 클라이언트 쓰기는 역변환되어 원래 레지스터 타입으로 기록된다.

use serde::{Deserialize, Serialize};

/// 스케일링 변환 종류.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ScalingKind {
    /// 변환 없음(노드는 선언된 타입 그대로 노출).
    None,
    /// 선형: eng = lerp(raw_low→eng_low, raw_high→eng_high).
    Linear,
    /// 제곱근: 차압식 유량계 등. raw를 [0,1]로 정규화 후 sqrt, eng 범위로 매핑.
    SquareRoot,
}

impl Default for ScalingKind {
    fn default() -> Self {
        Self::None
    }
}

/// 태그별 스케일링 설정. `kind == None`이면 비활성(변환 없음).
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScalingConfig {
    pub kind: ScalingKind,
    /// 원시 범위 하한(예: 0).
    pub raw_low: f64,
    /// 원시 범위 상한(예: 27648).
    pub raw_high: f64,
    /// 엔지니어링 범위 하한(예: 0.0).
    pub eng_low: f64,
    /// 엔지니어링 범위 상한(예: 100.0).
    pub eng_high: f64,
    /// 범위를 벗어난 값을 [low, high]로 클램프할지 여부.
    #[serde(default = "default_true")]
    pub clamp: bool,
}

fn default_true() -> bool {
    true
}

impl Default for ScalingConfig {
    fn default() -> Self {
        Self {
            kind: ScalingKind::None,
            raw_low: 0.0,
            raw_high: 0.0,
            eng_low: 0.0,
            eng_high: 0.0,
            clamp: true,
        }
    }
}

impl ScalingConfig {
    /// 변환이 활성화되어 있는지(kind != None).
    pub fn is_enabled(&self) -> bool {
        self.kind != ScalingKind::None
    }

    /// 비활성(기본값)인지 — serde skip 판정용.
    pub fn is_disabled(&self) -> bool {
        self.kind == ScalingKind::None
    }

    /// 설정 유효성 검사(활성일 때만). raw/eng 범위의 폭이 0이면 변환이 불능이다.
    pub fn validate(&self) -> Result<(), String> {
        if !self.is_enabled() {
            return Ok(());
        }
        if self.raw_high == self.raw_low {
            return Err("scaling rawHigh must differ from rawLow".to_string());
        }
        if self.eng_high == self.eng_low {
            return Err("scaling engHigh must differ from engLow".to_string());
        }
        Ok(())
    }
}

/// 원시값 → 엔지니어링값.
pub fn raw_to_eng(cfg: &ScalingConfig, raw: f64) -> f64 {
    match cfg.kind {
        ScalingKind::None => raw,
        ScalingKind::Linear => {
            let t = normalized_t(raw, cfg.raw_low, cfg.raw_high, cfg.clamp);
            cfg.eng_low + t * (cfg.eng_high - cfg.eng_low)
        }
        ScalingKind::SquareRoot => {
            let t = normalized_t(raw, cfg.raw_low, cfg.raw_high, true).max(0.0);
            cfg.eng_low + t.sqrt() * (cfg.eng_high - cfg.eng_low)
        }
    }
}

/// 엔지니어링값 → 원시값(역변환).
pub fn eng_to_raw(cfg: &ScalingConfig, eng: f64) -> f64 {
    match cfg.kind {
        ScalingKind::None => eng,
        ScalingKind::Linear => {
            let t = normalized_t(eng, cfg.eng_low, cfg.eng_high, cfg.clamp);
            cfg.raw_low + t * (cfg.raw_high - cfg.raw_low)
        }
        ScalingKind::SquareRoot => {
            let t = normalized_t(eng, cfg.eng_low, cfg.eng_high, true).max(0.0);
            cfg.raw_low + (t * t) * (cfg.raw_high - cfg.raw_low)
        }
    }
}

/// `value`를 [low, high] 구간 기준 정규화한 비율 t. 폭이 0이면 0을 반환(불능 가드).
fn normalized_t(value: f64, low: f64, high: f64, clamp: bool) -> f64 {
    let span = high - low;
    if span == 0.0 {
        return 0.0;
    }
    let t = (value - low) / span;
    if clamp {
        t.clamp(0.0, 1.0)
    } else {
        t
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn linear() -> ScalingConfig {
        ScalingConfig {
            kind: ScalingKind::Linear,
            raw_low: 0.0,
            raw_high: 27648.0,
            eng_low: 0.0,
            eng_high: 100.0,
            clamp: true,
        }
    }

    #[test]
    fn linear_maps_endpoints_and_midpoint() {
        let c = linear();
        assert!((raw_to_eng(&c, 0.0) - 0.0).abs() < 1e-9);
        assert!((raw_to_eng(&c, 27648.0) - 100.0).abs() < 1e-9);
        assert!((raw_to_eng(&c, 13824.0) - 50.0).abs() < 1e-9);
    }

    #[test]
    fn linear_round_trips() {
        let c = linear();
        for raw in [0.0, 5000.0, 13824.0, 27648.0] {
            let eng = raw_to_eng(&c, raw);
            assert!((eng_to_raw(&c, eng) - raw).abs() < 1e-6, "raw {raw}");
        }
    }

    #[test]
    fn linear_clamps_out_of_range() {
        let c = linear();
        assert_eq!(raw_to_eng(&c, -1000.0), 0.0);
        assert_eq!(raw_to_eng(&c, 50000.0), 100.0);
    }

    #[test]
    fn linear_no_clamp_extrapolates() {
        let mut c = linear();
        c.clamp = false;
        assert!(raw_to_eng(&c, -27648.0) < 0.0);
        assert!(raw_to_eng(&c, 55296.0) > 100.0);
    }

    #[test]
    fn square_root_maps_quarter_to_half() {
        // t = 0.25 → sqrt = 0.5 → eng = 50
        let c = ScalingConfig {
            kind: ScalingKind::SquareRoot,
            raw_low: 0.0,
            raw_high: 100.0,
            eng_low: 0.0,
            eng_high: 100.0,
            clamp: true,
        };
        assert!((raw_to_eng(&c, 25.0) - 50.0).abs() < 1e-9);
        // round trip
        assert!((eng_to_raw(&c, 50.0) - 25.0).abs() < 1e-6);
    }

    #[test]
    fn zero_span_is_guarded() {
        let c = ScalingConfig {
            kind: ScalingKind::Linear,
            raw_low: 10.0,
            raw_high: 10.0,
            eng_low: 0.0,
            eng_high: 100.0,
            clamp: true,
        };
        // span 0 → t=0 → eng_low
        assert_eq!(raw_to_eng(&c, 10.0), 0.0);
    }

    #[test]
    fn disabled_is_identity() {
        let c = ScalingConfig::default();
        assert_eq!(raw_to_eng(&c, 1234.0), 1234.0);
        assert_eq!(eng_to_raw(&c, 1234.0), 1234.0);
    }

    #[test]
    fn validate_rejects_zero_width_ranges() {
        let mut c = linear();
        c.raw_high = 0.0;
        assert!(c.validate().is_err());
        let mut c = linear();
        c.eng_high = c.eng_low;
        assert!(c.validate().is_err());
    }
}
