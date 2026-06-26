# 자동 넘버링 — 체크리스트

## 1. 심볼 메타 (prefix 데이터)
- [ ] `SymbolDefinition`에 `designationPrefix?: string` 필드 추가 (`src/types/symbol.ts`)
- [ ] TS 심볼 로더가 `<ms:DesignationPrefix>` 파싱
- [ ] Rust `xml_parser.rs` Category 핸들러 근처에 `DesignationPrefix` 파싱 + 타입 필드
- [ ] designation을 쓰는 builtin `.symbol.xml`에 `<ms:DesignationPrefix>` 추가
      — 값은 `designation-codes.md` 확정표대로 (G/M/K/F/B/P/C/T/R/L/D/S/X/Q)
  - [ ] relay_contact_no/nc, ground, net_label, off_page_connector, junction_box,
        text 는 **prefix 미부여**(스킵)
- [ ] `cargo test` (xml_parser 테스트) 그린

## 2. prefix 조회
- [ ] override(`blockDefinitions.ts`)에 prefix 명시: power_source=**G**, dc_2p=**G**,
      relay_coil=**K** (※기존 designation 기본값 'PS1'/'BAT1'도 'G1'/'K1'으로 교체)
- [ ] `getDesignationPrefix(type): string | undefined` 구현 (override → 심볼 → undefined)

## 3. 넘버링 로직
- [ ] `src/components/OneCanvas/utils/designation.ts` 신규 — `nextDesignation(prefix, components)`
- [ ] 정규식 `^{prefix}(\d+)$` 로 숫자 추출, 최댓값+1, 없으면 1
- [ ] 수동 값도 max 계산에 포함되는지 단위 테스트

## 4. 주입
- [ ] `canvasStore.ts` `addComponent`에서 `props.designation === undefined`일 때만 주입
- [ ] 복제/붙여넣기/로드 경로는 designation 유지(주입 안 함) 확인

## 5. 수동 보존 (선택)
- [ ] 인스펙터 designation 편집 시 `Block.designationManual = true`
- [ ] (향후) Renumber All이 플래그 존중

## 6. 검증
- [ ] 같은 종류 N개 배치 → prefix1..N 증가
- [ ] 삭제 후 재배치 → 최댓값+1 (gap)
- [ ] 수동 K9 후 배치 → K10
- [ ] text 등 prefix 없는 부품 → 미부여
- [ ] `pnpm test` + `cargo test` 그린

## 미해결 (구현 전 확정)
- [x] **prefix 표준 표** — `designation-codes.md` 확정 (IEC 81346-2 기준, 일부 관례 이탈)
- [ ] **복제/붙여넣기 정책** — 원본 designation 유지 vs 새 번호 재부여
- [ ] `designationManual` 이번에 넣을지, 향후로 미룰지
- [ ] (선택) K 풀이 큼 — timer=KT, counter=KC 등 2글자 세분 여부
