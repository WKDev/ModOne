//! Modbus 요청/응답 트래픽을 프론트엔드로 송출하는 텔레메트리 헬퍼
//!
//! 전송 계층(TCP/RTU) 관심사라 codec(wasm)이 아니라 native 셸에 둔다.
//! `process_request` 결과(요청/응답 PDU)에서 메타데이터를 뽑아 fire-and-forget 으로 emit 한다.

use std::sync::Arc;

use parking_lot::RwLock;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

/// 트래픽 이벤트 채널명
pub const EVENT_TRAFFIC: &str = "modbus:traffic";

/// 한 번의 Modbus 요청/응답 교환에 대한 관찰 메타데이터
#[derive(Debug, Clone, Serialize)]
pub struct ModbusTrafficEvent {
    /// ISO 8601 타임스탬프
    pub timestamp: String,
    /// 전송 프로토콜: "tcp" | "rtu"
    pub protocol: String,
    /// 클라이언트 주소(TCP는 IP:port, RTU는 포트명)
    pub client_addr: String,
    /// 요청 대상 Unit ID(슬레이브 주소)
    pub unit_id: u8,
    /// Function code (예: 0x03)
    pub function_code: u8,
    /// 사람이 읽는 FC 이름 (예: "Read Holding Registers")
    pub function_name: String,
    /// 시작 주소 (파싱 가능한 경우)
    pub start_address: Option<u16>,
    /// 수량/개수 (파싱 가능한 경우)
    pub quantity: Option<u16>,
    /// 예외 코드 (응답이 예외면 Some)
    pub exception_code: Option<u8>,
    /// 정상 응답 여부 (예외가 아니면 true)
    pub success: bool,
}

impl ModbusTrafficEvent {
    /// 요청/응답 PDU 한 쌍에서 트래픽 이벤트를 구성한다.
    ///
    /// `request_pdu` 와 `response_pdu` 는 모두 function code 바이트로 시작한다.
    pub fn from_exchange(
        protocol: &str,
        client_addr: &str,
        unit_id: u8,
        request_pdu: &[u8],
        response_pdu: &[u8],
    ) -> Self {
        let function_code = request_pdu.first().copied().unwrap_or(0);
        let (start_address, quantity) = parse_request_meta(function_code, request_pdu);

        // 예외 응답: function code 의 최상위 비트(0x80)가 셋이고, 두 번째 바이트가 예외코드.
        let is_exception = response_pdu
            .first()
            .map(|fc| fc & 0x80 != 0)
            .unwrap_or(false);
        let exception_code = if is_exception {
            response_pdu.get(1).copied()
        } else {
            None
        };

        Self {
            timestamp: chrono::Utc::now().to_rfc3339(),
            protocol: protocol.to_string(),
            client_addr: client_addr.to_string(),
            unit_id,
            function_code,
            function_name: function_name(function_code).to_string(),
            start_address,
            quantity,
            exception_code,
            success: !is_exception,
        }
    }
}

/// Function code → 사람이 읽는 이름
pub fn function_name(function_code: u8) -> &'static str {
    match function_code {
        0x01 => "Read Coils",
        0x02 => "Read Discrete Inputs",
        0x03 => "Read Holding Registers",
        0x04 => "Read Input Registers",
        0x05 => "Write Single Coil",
        0x06 => "Write Single Register",
        0x0F => "Write Multiple Coils",
        0x10 => "Write Multiple Registers",
        _ => "Unknown",
    }
}

/// 요청 PDU에서 (시작주소, 수량)을 추출한다.
///
/// FC 01–04, 0F, 10 → addr=[1..3], qty=[3..5].
/// FC 05, 06 → addr=[1..3], 단일 쓰기이므로 qty=1.
fn parse_request_meta(function_code: u8, pdu: &[u8]) -> (Option<u16>, Option<u16>) {
    let read_u16 = |i: usize| -> Option<u16> {
        match (pdu.get(i), pdu.get(i + 1)) {
            (Some(hi), Some(lo)) => Some(u16::from_be_bytes([*hi, *lo])),
            _ => None,
        }
    };

    match function_code {
        0x01 | 0x02 | 0x03 | 0x04 | 0x0F | 0x10 => (read_u16(1), read_u16(3)),
        0x05 | 0x06 => (read_u16(1), Some(1)),
        _ => (None, None),
    }
}

/// 트래픽 이벤트를 프론트엔드로 emit (app handle 미설정 시 무시).
pub fn emit_traffic(
    app_handle: &Arc<RwLock<Option<Arc<AppHandle>>>>,
    event: ModbusTrafficEvent,
) {
    if let Some(handle) = app_handle.read().as_ref() {
        let _ = handle.emit(EVENT_TRAFFIC, event);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_holding_registers_meta() {
        // FC 0x03, start=0x0010, qty=0x0002
        let req = [0x03, 0x00, 0x10, 0x00, 0x02];
        let resp = [0x03, 0x04, 0x00, 0x00, 0x00, 0x00];
        let ev = ModbusTrafficEvent::from_exchange("tcp", "127.0.0.1:5000", 1, &req, &resp);
        assert_eq!(ev.function_code, 0x03);
        assert_eq!(ev.function_name, "Read Holding Registers");
        assert_eq!(ev.start_address, Some(0x0010));
        assert_eq!(ev.quantity, Some(2));
        assert_eq!(ev.exception_code, None);
        assert!(ev.success);
    }

    #[test]
    fn write_single_register_meta() {
        // FC 0x06, addr=0x000A, value=0x10E1
        let req = [0x06, 0x00, 0x0A, 0x10, 0xE1];
        let resp = req; // echo
        let ev = ModbusTrafficEvent::from_exchange("tcp", "c", 1, &req, &resp);
        assert_eq!(ev.start_address, Some(0x000A));
        assert_eq!(ev.quantity, Some(1));
        assert!(ev.success);
    }

    #[test]
    fn exception_response_detected() {
        // 요청 FC 0x03, 응답 0x83(=0x03|0x80) + 예외코드 0x02
        let req = [0x03, 0x00, 0x00, 0x00, 0x01];
        let resp = [0x83, 0x02];
        let ev = ModbusTrafficEvent::from_exchange("tcp", "c", 1, &req, &resp);
        assert_eq!(ev.exception_code, Some(0x02));
        assert!(!ev.success);
    }

    #[test]
    fn unknown_function_has_no_meta() {
        let req = [0x99];
        let resp = [0x99 | 0x80, 0x01];
        let ev = ModbusTrafficEvent::from_exchange("tcp", "c", 1, &req, &resp);
        assert_eq!(ev.function_name, "Unknown");
        assert_eq!(ev.start_address, None);
        assert_eq!(ev.quantity, None);
        assert_eq!(ev.exception_code, Some(0x01));
    }
}
