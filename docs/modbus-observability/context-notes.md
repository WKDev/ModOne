# Modbus Observability — 컨텍스트 노트

작업 결정과 근거를 계속 추가한다.

## 배경 / 경쟁 분석 결론 (2026-06-27)
- ModOne 비전(`docs/vision/core_vision.md`): Modbus 서버 = "산업용 통신 Postman". 외부 HMI/SCADA가 진짜 PLC로 착각하고 붙는 프로토콜 모킹 허브.
- 경쟁: Modbus Slave(Witte, 사실상 표준) — MDI 32 슬레이브, 셀 직접편집, **트래픽 모니터링**. ModRSsim2/ModbusPal — **값 제너레이터(사인파/랜덤으로 레지스터 애니메이션)**.
- 현황 진단: 코어 엔진(FC 8종)·메모리 그리드 UX는 상용급. 그러나 **"서버가 지금 뭘 하는지 보여주는 가시성 레이어가 통째로 비어있음"**. → P0 트래픽 로그가 최대 갭.

## 핵심 설계 결정
1. **P2를 백엔드가 아니라 프론트에서 집계.** 매 요청마다 락 잡고 `ConnectionInfo`를 변형하면 hot-path 비용 + 동시성 위험. 대신 P0 traffic 이벤트가 이미 client_addr/protocol/fc를 실어 나르므로, 프론트에서 클라이언트별 통계를 파생. RTU 표시도 protocol 필드로 자연 해결.
2. **traffic 이벤트는 native 전용**(src-tauri/modbus/telemetry.rs). codec(wasm)에는 넣지 않음 — 전송 계층 관심사라 native 셸이 맞음. `process_request`는 그대로 두고, 호출부(tcp/rtu)에서 request/response PDU를 들고 메타를 뽑아 emit.
3. **메타 추출**: FC 01–04/0F/10 → addr=pdu[1..3], qty=pdu[3..5]. FC 05/06 → addr=pdu[1..3], qty=1. 예외 = response[0] & 0x80 → exception_code=response[1].
4. **트래픽 버퍼는 프론트 링버퍼(cap)**. 고빈도 대비 백엔드는 fire-and-forget emit, 프론트가 상한 관리 + pause/clear.
5. 파일 크기 규약(<400줄): modbusStore(이미 422줄)에 얹지 않고 `modbusTrafficStore.ts` 분리. UI도 `components/sidebar/modbus/` 하위로 쪼갬.

## 작업 순서
P0(트래픽 로그) → P2(클라이언트 통계, P0 파생) → P1(값 제너레이터). 각 단계 끝에 커밋.

## 빌드/테스트 환경 함정 (2026-06-27 발견 — 중요)
- **openssl 1시간 빌드의 정체**: `src-tauri/Cargo.toml`의 `default = ["opcua-server"]` → `opcua` 의존성 → `vendored-openssl`이 매 fresh target마다 OpenSSL을 perl로 소스 빌드. cargo tree로 openssl-sys는 오직 opcua에서만 옴을 확인. opcua는 제품 기능(OPC UA 서버)이라 default에서 제거 불가.
  - **회피**: modbus만 테스트할 땐 `cargo test --no-default-features --lib "modbus::"` → opcua/openssl 전부 스킵, 빌드 29초.
  - **근본 원인**: 워크트리가 자기만의 빈 `target/`을 가져 매번 처음부터 컴파일. 메인 체크아웃 target엔 openssl이 캐시돼 있어 빠름.
- **cargo는 반드시 PowerShell + `scripts/with-perl.ps1`로**. Bash(Git Bash)로 돌리면 Git perl에 `Locale::Maketext::Simple` 없어서 openssl-sys 빌드 실패.
- **`[lib] test = false`**: src-tauri 라이브러리 단위테스트는 의도적으로 비활성. `cargo test --lib`로 강제 실행하면 staticlib 테스트 exe가 `0xc0000139 STATUS_ENTRYPOINT_NOT_FOUND`로 로드 실패. 즉 tcp.rs/rtu.rs/telemetry.rs/generator.rs의 `#[cfg(test)]`는 **컴파일 검증용**이고 실행은 안 됨. 네이티브 런타임 검증은 `tests/*.rs` 통합테스트(+`--features opcua-server`)로 함.
- **워크트리에서 프론트**: `node_modules`가 없음. `pnpm test`(로컬 bin) 실패 → `npx vitest`/`npx tsc`는 부모(메인 체크아웃) node_modules를 타고 올라가 동작.
