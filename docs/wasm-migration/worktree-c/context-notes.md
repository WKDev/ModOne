<!-- 워크트리 C 작업 중 내린 결정과 근거를 누적 기록 -->
# 워크트리 C — context notes

## 결정 1: address_space의 프로젝트 결합 → 노드스펙 경계 (modbus 선례)
`address_space.rs`는 `crate::project`(PlcHardwareTopology/PlcSettings/PlcIoDirection/
PlcAddressWindow)와 `crate::sim`(SharedTagRegistry, TagDefinition 등)에 의존한다.
계약 §1은 코어 크레이트의 src-tauri/project 역의존을 금지한다.
→ modbus가 vendor profile resolve를 src-tauri에 남긴 것과 동일하게,
"프로젝트 토폴로지 → `AddressSpaceSpec` 해석"(`build_address_space_spec`)은
src-tauri에 잔류시키고, 순수 노드/코덱 로직만 opcua-codec로 옮긴다.
`build_address_space_spec`이 이미 `AddressSpaceSpec`(primary_node_map, publish_map)을
반환하므로 경계가 이미 코드에 존재한다 — 이를 trait/크레이트 경계로 승격.

## 결정 2: 단계적 진행으로 빌드 green 유지
opcua crate는 vendored-openssl로 빌드가 무겁고 모듈이 13.5k줄이라 한 번에 못 옮긴다.
P1(어댑터 경계) → P2(노드스펙) → P3(라이프사이클 trait) → P4(크레이트 추출) 순서로,
각 단계가 독립적으로 머지 가능하고 검증 green이 되도록 한다. (문서 권장 "작은 PR 자주 머지")

## 결정 3: trait는 native 전용(§4)
`opcua` crate v0.12는 wasm 컴파일 불가 → OPC UA 실서빙은 native 전용 확정.
`OpcUaServerBackend` trait + 구현(RustOpcUaBackend)은 `opcua-server` feature-gate.
순수 codec/주소공간/매핑/dirty_tracker만 wasm 빌드 대상.

## 환경 함정: native 빌드는 PowerShell로
`opcua` crate는 `vendored-openssl`이라 빌드 시 OpenSSL을 소스 컴파일(perl 필요).
Bash 도구의 MSYS perl은 `Locale/Maketext/Simple.pm`이 없어 빌드 실패한다.
→ **src-tauri(native) `cargo check/test`는 PowerShell 도구로 실행**한다
(PowerShell PATH의 `C:\Strawberry\perl`가 모듈 보유). contract/codec 등 순수
크레이트는 Bash로도 OK. wasm 타깃 체크도 openssl 불필요 → Bash 가능.

## 환경 함정 2: 이 샌드박스에서 lib 테스트 "실행" 불가
`cargo test -p modone --lib`의 test exe(`app_lib-*.exe`)가 실행 시
`0xc0000139 STATUS_ENTRYPOINT_NOT_FOUND`로 기동 실패한다. opcua 무관 모듈
(`plc_runtime::`)도 동일 → PATH상 잘못된 버전 DLL로 인한 **환경 문제**이며 코드 무관.
- 컴파일/`cargo check`/`cargo test --no-run`은 green (검증 가능).
- 테스트 **실행**은 실제 Windows 개발 환경에서 수행해야 한다.
- 선행 버그: `symbols/project_block_loader.rs` sample_xml가 `r#"..."#` 안에
  `stroke="#888888"`을 담아 `"#`가 raw string을 조기 종료 → `r##"..."##`로 수정
  (sibling `xml_parser.rs`는 이미 `r##` 사용). main에도 있던 저장소 전반 버그.

## P4 결과 + wasm 게이트 (§6)
- opcua-codec 추출 완료. src-tauri/opcua/mod.rs가 크레이트 모듈을 같은 이름으로
  재노출해 기존 `crate::opcua::*` 경로를 전부 유지 → sibling(server/audit/auth/
  commands) 무수정. trait은 크레이트, `impl for OpcUaServer`는 backend_impl(src-tauri).
- 놓쳤다 잡은 결합: mapping.rs의 `default_for_tag`(sim TagDefinition, 프로덕션
  호출처 0) + sim 결합 테스트 4개 → src-tauri로 재배치, default_for_address로 검증.
  address_space_spec의 access_level_*/push_publish_node는 src-tauri 빌더가 쓰므로
  pub로 승격(크로스-크레이트).
- **wasm 게이트 (§3 주입 방식 채택)**: opcua-codec 소스는 wasm-clean이나, 의존
  modone-contract가 `uuid::v4`(batch_id)·`chrono::Utc::now`(timestamp, memory.rs
  2곳)를 써서 막혔다. 처음엔 피처 추가(uuid js + chrono wasmbind)로 풀었으나,
  사용자 결정으로 **§3 "주입" 방식**으로 전환:
  - contract에 `clock` 모듈 추가(`now_rfc3339`/`new_batch_id`). chrono/uuid를
    `std-clock`(기본 on) 피처 뒤로 optional화. 피처 off면 호스트가
    `clock::set_clock`/`set_id_source`로 주입(기본값: 빈 timestamp, 카운터 ID).
  - opcua-codec는 `modone-contract = { default-features = false }`로 의존 →
    **단독 wasm 빌드에선 std-clock off → chrono/uuid 미컴파일 → 주입 경로**.
  - 네이티브 워크스페이스 빌드는 src-tauri가 std-clock을 켜므로 **피처 단일화**로
    chrono/uuid가 켜져 기존 동작 그대로.
  - 검증: `cargo check -p opcua-codec --target wasm32` green(chrono/uuid 없이),
    `cargo test -p opcua-codec` 293 passed, contract 11 passed, workspace green.
  - 주의: contract는 A/B/C 공유라 이 §3 변경은 A와 머지 시 조율 대상.

## P1 설계 메모
- 어댑터가 실제로 쓰는 서버 메서드: `update_node_values(windows, mem, publish_map)`,
  `sync_all_node_values(mem, publish_map)`. → 이 두 개가 P1 trait 표면.
- `Arc<OpcUaServer>` → `Arc<dyn OpcUaServerBackend>` 는 호출부에서 unsizing 자동 coercion.
  조립 지점(sim.rs:212) 코드 변경 불필요.
- 전체 라이프사이클(start/stop/status/sessions/security)의 trait화는 P3.
  start() 시그니처가 project 객체에 결합돼 있어 P2(노드스펙 경계) 이후에 가능.
