<!-- 워크트리 B 작업 중 내린 결정과 근거 기록 -->
# 워크트리 B — context notes

## 결정 1: ModbusMemory의 Tauri 결합을 `MemoryEventSink` trait으로 끊는다
`src-tauri/src/modbus/memory.rs`의 `ModbusMemory`는 `tauri::AppHandle`을 보유하고
`handle.emit("modbus:memory-changed", ...)`로 직접 이벤트를 쏜다. 이게 유일한
wasm-적대 결합이다.

- **해결**: codec에 `pub trait MemoryEventSink: Send + Sync { fn emit_change(&self, &MemoryChangeEvent); fn emit_batch(&self, &MemoryBatchChangeEvent); }` 정의.
  `ModbusMemory`는 `RwLock<Option<Arc<dyn MemoryEventSink>>>`를 들고 `set_event_sink()`로 주입받음.
- **native 셸**: `TauriEventSink`가 `Arc<tauri::AppHandle>`를 감싸 채널명 상수와 함께 emit.
  이벤트 채널명(`modbus:memory-changed`, `modbus:memory-batch-changed`)은 Tauri 전용이므로
  src-tauri 쪽 sink로 이동. 페이로드 직렬화 형태는 그대로 → 프런트엔드 변경 없음.
- 호출부: `state.memory.set_app_handle(h)` (commands/modbus.rs 3곳) →
  `state.memory.set_event_sink(Arc::new(TauriEventSink::new(h)))`.

## 결정 2: `ModbusMappingPolicy.profile_id`를 `VendorProfileId` → `String`
계약/브리프상 `VendorProfileId`(vendor 타입)는 src-tauri 잔류, 정책 타입은 codec로 이전.
정책이 vendor enum을 참조하면 의존이 역류한다. `profile_id`는 어디서도 **읽히지 않는**
순수 라벨(직렬화는 되지만 프런트엔드 미사용)이라 `String`으로 바꿔 결합을 끊는다.
profiles는 `self.id().as_str().to_string()`으로 채운다.

## 결정 3: types.rs 분할
- codec로: `MemoryError, MemoryMapSettings, MemoryType, ChangeSource, MemoryChangeEvent, MemoryBatchChangeEvent`
- src-tauri 잔류(전송 전용): `ModbusError(#[from] codec::MemoryError), TcpConfig, ConnectionInfo, ConnectionEvent`
  (후자는 `chrono::Utc::now()` 사용 = native 전송 계층).
- `modbus/types.rs`는 codec 타입을 `pub use`로 재노출해 `crate::modbus::types::X` 경로 호환 유지.

## 결정 4: CSV save/load는 codec의 ModbusMemory에 잔류
`std::fs`는 wasm32-unknown-unknown에서 **컴파일**은 됨(런타임만 실패). 검증 게이트는
`cargo check`이므로 통과. 분리는 과설계 → 보류.

## 결정 5: wasm 게이트의 uuid 부채는 codec manifest에서 임시 통일
`cargo check -p modbus-codec --target wasm32-unknown-unknown`는 의존 트리의
`modone-contract`가 끌어오는 `uuid`(v4)가 wasm에서 getrandom 백엔드를 못 찾아 실패한다.
이건 계약 §3 부채(워크트리 A 담당)다. codec 자체 deps(parking_lot/bitvec/serde_json)는
wasm 컴파일 OK. B 게이트를 독립적으로 green으로 만들기 위해 codec Cargo.toml에
`[target.'cfg(target_arch=\"wasm32\")'.dependencies] uuid = { features=[\"js\"] }`를
추가(additive feature 통일, native 무영향, 계약 코드/표면 불변). A가 §3을 정식
상환하면 이 줄은 제거 가능. **결과: wasm 게이트 green.**

## 발견: 죽어있던 adapter 테스트의 off-by-offset 단언 수정
src-tauri `[lib] test = false`라 `src/modbus/adapter.rs`의 `#[test]`들은 **한 번도
실행된 적이 없었다.** codec(정상 테스트 크레이트)로 옮기니
`full_sync_honors_configured_window_starts_and_rule_offsets`가 실패. 매핑은
`canonical[i] ↔ modbus[space_start + offset + i]` (offset은 modbus 창만 이동)인데
원본 테스트는 canonical 인덱스에도 offset을 더한 잘못된 단언을 갖고 있었다
(OutputBit 3→실제 2, DataWord 4→실제 2). 통과하는 `publishes_discrete_inputs_...`
테스트가 같은 매핑 규칙으로 일관됨을 확인 후, 죽은 테스트의 canonical 단언을
실제 동작에 맞게 수정. **동작 변경 아님 — 테스트 자체의 버그 수정.**

## 미해결/리스크
- (해결) `parking_lot`은 wasm32-unknown-unknown에서 컴파일됨 — 검증 완료.
- src-tauri 전체 빌드는 `opcua`의 vendored-openssl가 Windows perl(Strawberry)을
  요구. Bash 툴의 msys perl로는 실패하므로 PowerShell(Windows PATH)로 빌드해야 함.
  내 변경과 무관한 환경 이슈.
