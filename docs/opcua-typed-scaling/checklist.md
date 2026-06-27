# OPC UA Typed Publish + Scaling/Deadband — 체크리스트

> 발견: 멀티타입 매핑(Int32/Float/Double/바이트오더)은 `opcua-codec`에 완성·테스트돼 있으나
> **라이브 서버에 연결돼 있지 않다.** 노드는 전부 Boolean/UInt16으로 생성·publish된다.
> (`server.rs:662-666`, `818-820`, `address_space.rs:259`는 `is_bool`만 사용)
> 스케일링은 Float/Double 노출이 전제이므로, 먼저 typed publish를 살려야 한다.

## Phase 1 — Typed 매핑을 라이브 서버에 연결 (선행) ✅ 완료
- [x] P1.1 `OpcUaNodeSpec`(codec)에 `mapping: OpcUaMappingConfig` 필드 추가
- [x] P1.2 `build_address_space_spec`: 모든 노드(raw/tag)에 mapping 채우기 (raw=default_for_address)
- [x] P1.3 새 모듈 `src-tauri/src/opcua/node_values.rs` 추출 (server.rs 비대화 방지)
      - `data_type_id_for`, `mapped_value_to_variant`, `initial_variant_for`
      - `read_node_data_value`(getter), `read_node_mapped`(pure), `mapped_to_register_writes`(pure)
      - `variant_to_mapped`(write), `node_dirty`(span↔window 교차)
- [x] P1.4 server.rs 노드 생성: data_type + 초기값을 mapping에서 결정, getter/setter가 node_values 호출
- [x] P1.5 server.rs publish: `address_spec`의 nodes 순회 → typed span read → set_variable_value (publish_nodes로 통합)
- [x] P1.6 테스트: node_values_pure_test 5개(멀티레지스터 read/write 왕복·dirty span) + 기존 E2E 회귀
- [x] P1.7 검증: opcua-codec 293개 + 순수 5개 + opcua_integration/session_smoke E2E + 전체 빌드 green
      - openssl 빌드는 Strawberry perl 필요(C:\Strawberry\perl\bin PATH 앞에). 순수 테스트는 `--no-default-features`.
      - 정리: 고아가 된 `variant_to_canonical_value`/`canonical_data_value`/`canonical_read_error_status` 제거

## Phase 2 — 스케일링 (raw↔eng) — 백엔드 완료, 프론트 남음
- [x] P2.1 codec `ScalingConfig { kind: None|Linear|SquareRoot, raw_low/high, eng_low/high, clamp }` + serde camelCase, `scaling_active()`, `effective_opcua_data_type()`
- [x] P2.2 순수 `scaling.rs`: `raw_to_eng`/`eng_to_raw` + 8개 단위테스트 (경계/역변환/제곱근/0분모 가드)
- [x] P2.3 node_values: read에서 scaling→Double 노출, write에서 역scaling(round+saturate). server.rs 노드 생성/setter는 effective type 사용. 순수 왕복 2테스트 + E2E 회귀 통과
- [ ] P2.4 TS 타입(tagImportExport) + CSV/JSON import/export 필드  ← 남음
- [ ] P2.5 UI: `OpcUaMappingSection`에 스케일링 편집  ← 남음
- 참고: serde가 `#[serde(default, skip_serializing_if=is_disabled)]`라 프로젝트 저장/로드는 이미 round-trip(비활성 시 JSON 생략). 즉 프로젝트 파일로는 지금도 설정 가능, UI만 없음.

## Phase 3 — 데드밴드 (publish 억제)
- [ ] P3.1 codec `DeadbandConfig { kind: None|Absolute|Percent, value }` + serde + TS
- [ ] P3.2 순수 필터 `passes_deadband(last, new, &cfg) -> bool` + 테스트
- [ ] P3.3 노드별 last-published 값 상태 + publish 억제
- [ ] P3.4 UI + import/export + 커밋
