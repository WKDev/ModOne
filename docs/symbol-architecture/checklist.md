# 체크리스트 — 심볼 아키텍처

## 설계 단계 (현재)
- [x] 현재 심볼 시스템 조사 (XML 스키마, 포트 정적성, 시뮬 계층)
- [x] archetype/behavior 계층이 코드 백드이고 OneCanvas 런타임 전용임을 확인
- [x] scope channels↔ports 불일치(정적 포트) 확인
- [x] 3-tier 모델 + 결정/미결정 정리 (`design.md`)
- [x] **Q1 시뮬레이션 깊이 결정** → **단계적 하이브리드** (지금 논리 수준, archetype 심에 아날로그 후속 가능하게 설계만 열어둠)
- [ ] **Q2 파라메트릭 포트 우선 위치 결정** (T2 선언 XML / T3 코드) — 보류, 하이브리드/Q3 이후
- [x] **Q3 (2) 에디터 시맨틱 저작 선행 결정** → **선행 진행**

## 구현 단계 — Q3 선행 (완료)
- [x] SymbolEditor 현재 핀/속성 편집 UI 정밀 조사
- [x] SymbolEditor: 핀 Detailed Type(electricalType V2) + Functional Role 셀렉터 추가 — `inspectors/PinInspector.tsx`
- [x] SymbolEditor: Symbol Properties 저작 패널 추가 — `inspectors/SymbolPropertiesEditor.tsx`
- [x] 공유 Section/Field/inputClass 추출 — `inspectors/fields.tsx` (PropertiesPanel 1132→902줄)
- [x] XML 라운드트립 확인 — tsc 클린 + 심볼 파서/로더 테스트 497 + 신규 인스펙터 7 통과

## Q3 → main 병합 (완료, 2026-06-27)
- [x] 다른 세션 main 애니메이션 작업(7600245, 81eb6f3) 확인 — 파일 겹침 0
- [x] main을 우리 브랜치에 병합(clean) → tsc 클린 + 228 테스트 통과
- [x] main을 우리 브랜치로 fast-forward (c168c5b)

## Q2 — 파라메트릭 포트 (진행 중)
- [x] 포트 해석 파이프라인 조사 — 포트는 인스턴스마다 생성되나 생성 후 불변. `instanceProperties`/type 필드에 값은 있음.
- [x] **기존 선례 발견**: `PowerSourceProperties`가 polarity 변경 시 `getPowerSourcePorts()`로 ports 재계산해 함께 저장 → 코드 백드 per-type 포트 함수 패턴이 이미 검증됨.
- [x] 갭 확인: `ScopeProperties.handleChannelsChange`는 channels만 바꾸고 ports 미재계산. terminal_block도 동일.
- [x] **설계 문서 작성** — `q2-parametric-ports.md` (트랙 A/B 스키마·로더·UI 설계 + 단계적 권장안)
- [x] 트랙 A/B 시작 방식 사용자 확정 → **A 먼저**
- [x] (트랙 A) `getScopePorts(channels)` 추가 — offset 기반 좌측 입력 포트 (`blockDefinitions.ts`)
- [x] (트랙 A) 생성 시 scope 포트 = channels 기반 (`blockFactory.ts`)
- [x] (트랙 A) `ScopeProperties.handleChannelsChange`에서 ports 재계산
- [x] (트랙 A) scope 심볼 channels 기본값 1→4 (포트 수와 일치, 원 불일치 수정)
- [x] (트랙 A) 검증 — tsc 클린 + parametricPorts 6 + OneCanvas 135 + 통합 250 통과
- [ ] terminal_block 가변 단자 — 전용 속성 편집기 없음, 후속(B에서 일반화하거나 별도)
- [x] 트랙 A → main 병합 (main 9857a9f, 다른 세션 Modbus/멀티-CPU 작업과 clean 병합)

## Q2 트랙 B — 선언적 XML PortTemplate (설계 확정, 구현 보류)
계획·결정: `q2b-porttemplate-plan.md` (B-1 명시속성 / B-2 순수유틸 / B-3 IndustrialProperties / B-4 XML수기 먼저)
- [x] 설계 완성 — 파서 3경로 매핑(TS 서비스=builtin/에디터, Rust=프로젝트 커스텀 로드)
- [x] Rust 비용 분석 — import는 verbatim write(직렬화 불필요), 파서는 unknown 스킵(graceful). Rust는 파서+타입만, 재빌드 비용 있음
- [x] **Phase 1 — TS 데이터 레이어** — `PortTemplate` 타입(types/symbol.ts) + services 파서 파싱/직렬화 + 라운드트립 테스트(portTemplateRoundtrip 3). 동작 변화 없음, 회귀 없음(심볼 XML/로더 417 그린)
- [x] **Phase 2 — TS 인스턴스 포트 해석** — `resolveInstancePorts.ts`(expandPortTemplate/resolveEffectivePins/resolveInstancePorts, pin 중심). **라이브 배선**: `symbolBlockDefAdapter.getAllPins`가 resolveEffectivePins 사용 → builtin/심볼파생 블록이 기본 속성값으로 템플릿 포트 획득. customSymbolBridge·symbolBridge 인스턴스 인지(instanceProps). 유틸 테스트 7 + OneCanvas 145 + 통합 250 그린. (커스텀 심볼 dead 래퍼 대신 라이브 getAllPins 경로에 끼움)
- [x] **Phase 3 — TS 인스턴스 속성 UI + ports 재계산** — `SymbolInstanceProperties.tsx`(custom 심볼 def.properties 편집, 변경 시 resolveInstancePorts로 ports 재계산해 저장). IndustrialProperties가 custom_symbol일 때 렌더. 테스트 3 + 패널 54 그린. (에디터 주도라 placement 경로 불명에도 동작)
- [ ] Phase 4 — builtin 데모 PortTemplate 심볼 + 검증
- [ ] Phase 5 (보류) — Rust 파서+타입 패리티 (프로젝트 저장 커스텀 심볼 동적 포트 복원, Rust 재빌드)
- [ ] (Q2=T2 시) scope/terminal_block을 PortTemplate로 마이그레이션
- [ ] (Q2=T3 시) `behaviorTemplates.ts`에 구조 생성 훅(generatePorts) 추가
- [ ] (Q1=a 시) 논리 시뮬: archetype 추가 (counter/timer/contactor 등)
- [ ] (Q1=b/c 시) nodal 솔버 PoC, archetype 심에 끼울 인터페이스 설계
- [ ] 회귀 테스트: `builtinXmlRoundtrip.test.ts` 등 통과

## 마무리
- [ ] 변경 커밋
- [ ] main 병합 + 워크트리 제거 (ExitWorktree)
