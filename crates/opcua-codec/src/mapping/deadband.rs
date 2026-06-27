// publish 데드밴드 — 값 변화가 임계값 미만이면 OPC UA 노드 갱신을 억제한다
//
// OPC UA 표준의 클라이언트측 DataChangeFilter 데드밴드와 별개로, 서버가 노드별
// 기본 데드밴드를 적용한다(Kepware식). 마지막으로 publish한 값과의 차이가 임계
// 미만이면 갱신을 건너뛰어 불필요한 트래픽/노이즈를 줄인다. 숫자 타입에만 적용.

use serde::{Deserialize, Serialize};

/// 데드밴드 종류.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DeadbandKind {
    /// 억제 없음.
    None,
    /// 절대값: |new - last| >= value 일 때만 publish (노출 단위 기준).
    Absolute,
    /// 백분율: 기준 범위(스케일링 eng 폭)의 value% 이상 변할 때만 publish.
    Percent,
}

impl Default for DeadbandKind {
    fn default() -> Self {
        Self::None
    }
}

/// 태그별 데드밴드 설정. `kind == None`이면 비활성.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeadbandConfig {
    pub kind: DeadbandKind,
    /// 임계값. Absolute면 노출 단위, Percent면 0..100(%).
    pub value: f64,
}

impl Default for DeadbandConfig {
    fn default() -> Self {
        Self {
            kind: DeadbandKind::None,
            value: 0.0,
        }
    }
}

impl DeadbandConfig {
    pub fn is_enabled(&self) -> bool {
        self.kind != DeadbandKind::None
    }

    pub fn is_disabled(&self) -> bool {
        self.kind == DeadbandKind::None
    }

    pub fn validate(&self) -> Result<(), String> {
        if self.is_enabled() && self.value < 0.0 {
            return Err("deadband value must be >= 0".to_string());
        }
        Ok(())
    }
}

/// `new` 값을 publish해야 하는지 판정한다(true = publish).
///
/// `last`는 직전에 publish한 값. `reference_span`은 Percent 모드에서 기준이 되는
/// 범위 폭(스케일링 eng 폭). 기준이 없으면(None/0) Percent는 억제하지 않는다.
pub fn passes_deadband(
    cfg: &DeadbandConfig,
    last: f64,
    new: f64,
    reference_span: Option<f64>,
) -> bool {
    match cfg.kind {
        DeadbandKind::None => true,
        DeadbandKind::Absolute => (new - last).abs() >= cfg.value,
        DeadbandKind::Percent => {
            let span = reference_span.map(f64::abs).unwrap_or(0.0);
            if span == 0.0 {
                return true;
            }
            (new - last).abs() >= (cfg.value / 100.0) * span
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn none_always_publishes() {
        let c = DeadbandConfig::default();
        assert!(passes_deadband(&c, 0.0, 0.0, None));
        assert!(passes_deadband(&c, 0.0, 0.0001, None));
    }

    #[test]
    fn absolute_suppresses_small_changes() {
        let c = DeadbandConfig {
            kind: DeadbandKind::Absolute,
            value: 1.0,
        };
        assert!(!passes_deadband(&c, 10.0, 10.5, None), "0.5 < 1.0 suppressed");
        assert!(passes_deadband(&c, 10.0, 11.0, None), "1.0 >= 1.0 published");
        assert!(passes_deadband(&c, 10.0, 8.5, None), "negative delta 1.5");
    }

    #[test]
    fn percent_uses_reference_span() {
        let c = DeadbandConfig {
            kind: DeadbandKind::Percent,
            value: 5.0, // 5% of span
        };
        // span 100 → threshold 5.0
        assert!(!passes_deadband(&c, 50.0, 53.0, Some(100.0)), "3 < 5 suppressed");
        assert!(passes_deadband(&c, 50.0, 56.0, Some(100.0)), "6 >= 5 published");
    }

    #[test]
    fn percent_without_span_does_not_suppress() {
        let c = DeadbandConfig {
            kind: DeadbandKind::Percent,
            value: 50.0,
        };
        assert!(passes_deadband(&c, 50.0, 50.1, None));
        assert!(passes_deadband(&c, 50.0, 50.1, Some(0.0)));
    }

    #[test]
    fn validate_rejects_negative_value() {
        let c = DeadbandConfig {
            kind: DeadbandKind::Absolute,
            value: -1.0,
        };
        assert!(c.validate().is_err());
        assert!(DeadbandConfig::default().validate().is_ok());
    }
}
