# OPC UA Typed Publish + Scaling/Deadband — 컨텍스트 노트

작업 분기: `worktree-feat+tag-scaling-deadband` (로컬 main c168c5b 기준으로 리셋함 — origin/main이 50+ 뒤처져 있어서).

## 핵심 발견 (왜 이 작업을 하는가)
- `OpcUaMappingConfig`(12개 UA 타입, word_count, byte_order, string)는 `opcua-codec`에 완성·단위테스트됨.
- 그러나 **런타임 사용처는 NodeSet2/CSV export와 검증뿐.** 라이브 서버는 매핑을 무시:
  - 노드 생성(`server.rs:660-666`): `is_bool`로 Boolean/UInt16만.
  - publish(`server.rs:818-820, 856-858`): `Bool→Boolean`, `U16→UInt16` 직통.
  - write(`server.rs:1440-1454` `variant_to_canonical_value`): 단일 U16/Bool만.
  - `OpcUaNodeSpec`(`address_space_spec.rs:29`)이 `is_bool`만 담고 타입/word_count/byte_order를 안 담음.
- ⇒ 사용자가 Float 매핑해도 export엔 Float, 라이브 서버엔 UInt16으로 나오는 불일치.

## 설계 결정
- `spec`(AddressSpaceSpec)은 이미 `OpcUaServer.address_spec`에 저장됨(`server.rs:322`).
  publish 함수가 `self.address_spec`의 nodes를 순회하면 노드별 mapping에 접근 가능 ⇒ 새 필드 불필요.
- publish 함수는 기존 `publish_map` 인자 대신 **spec.nodes 순회**로 전환. spec.nodes가 생성된 노드 전체 집합과 일치(`server.rs:655` 생성 루프가 동일 집합 순회).
- 멀티레지스터 노드는 span=[base.index, base.index+word_count). dirty window가 span과 겹치면 republish.
- getter/setter 클로저는 노드별로 생성되므로 각자 base_address+mapping을 capture(스케일링/데드밴드도 여기서).
- 새 로직은 `node_values.rs`로 추출 — server.rs(2435줄)를 더 키우지 않기 위함(프로젝트 규약).

## 스케일링 의미론
- 스케일링 활성 시 노출 타입은 **Double**(엔지니어링 실수값). raw MappedValue(정수) → f64 → raw_to_eng → Double.
- write: 클라이언트가 Double(eng) 기록 → eng_to_raw → 원래 정수 타입으로 레지스터 분해.
- Linear: eng = eng_low + (raw - raw_low) * (eng_high - eng_low)/(raw_high - raw_low). 분모 0 가드.
- SquareRoot: 유량계 등. raw 정규화 후 sqrt 후 eng 범위로. 음수 raw 클램프.

## 데드밴드 의미론
- 서버측 publish 억제(Kepware식). OPC UA 표준 client deadband와 별개의 서버 기본값.
- Absolute: |new - last| >= value 일 때만 publish. Percent: eng 범위 대비 %.
- 노드별 last-published 엔지니어링 값 상태 필요.

## 미해결/주의
- publish가 spec.nodes 순회로 바뀌면 raw/alias 노드도 typed 경로를 타야 함(default 매핑 Bool/U16이라 동작 동일).
- 대규모(10K) 노드에서 매 cycle 전체 순회 — 기존 publish_map 순회와 동일 비용. 후속 최적화 여지.
