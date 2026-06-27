# 컨텍스트 노트 — 결정의 이유

작업 중 내려진 판단과 그 근거를 계속 덧붙인다.

## 2026-06-27 세션

### 워크트리
- 사용자가 명시적으로 "새 워크트리"를 요청 → `symbol-architecture-design` 생성.
- 생성 직후 HEAD가 로컬 main보다 **77 커밋 뒤**(origin/main 기준 분기, 메모리 `worktree-baseref-stale`와 동일 증상) → `git reset --hard main`으로 로컬 HEAD(b196b17)에 맞춤.

### "설계 문서부터" 결정 배경
- 사용자가 처음엔 "커스텀 심볼 생성"을 요청했으나, 조사 결과 GND/전압·전류 소스/scope가 **이미 builtin XML로 존재**함이 드러남. 똑같은 걸 다시 만드는 건 무의미 → 멈추고 방향 논의로 전환.
- 논의 끝에 관심사가 (2) 에디터 시맨틱 저작 + (3) 시뮬레이션으로 좁혀짐. 규모가 커서 코드 전에 설계 합의가 필요 → 사용자가 "설계 문서부터" 선택.

### 핵심 통찰 — 왜 archetype 계층으로 수렴하나
- 포트가 정적(`symbolBlockDefAdapter.ts:104`)이고 XSD에 파라메트릭 구문이 없으므로, "channels→ports 가변"은 선언 XML만으로 불가.
- 그런데 ModOne엔 이미 코드 백드 동작 계층(`behaviorTemplates.ts` + `circuitSimulator.ts`)이 있음. 가변 포트 생성·특수 동작·시뮬레이션은 전부 "코드가 필요한 영역"이라 이 계층이 자연스러운 단일 귀착점.
- 따라서 특수 모듈을 선언 XML에 억지로 넣지 않고 T3(코드 백드)로 보내는 설계가 일관적. XML은 정적 뼈대 유지.

### 의도적으로 보류한 것
- Falstad의 시뮬레이터 전용 소자(C 묶음: Noise/AM/FM/Audio/External-JS 등)는 산업 제어 스캐메틱 범위 밖이라 제외.
- 단순 팔레트 채우기(B 묶음 일괄 XML 작성)는 사용자 관심사 아님 → 후순위.

### 결정됨 (2026-06-27)
- **Q1 = 단계적 하이브리드.** 지금은 논리 수준 시뮬 유지, archetype 계층에 아날로그를 나중에 끼울 수 있는 인터페이스만 열어둔다. nodal 솔버는 후속.
- **Q3 = 선행.** 에디터 시맨틱 저작(핀 electricalType 셀렉터 + Property 저작 패널)을 시뮬과 독립적으로 먼저 구현. 비용 작고 즉시 효용.
- **Q2 = 보류.** 파라메트릭 포트는 하이브리드/Q3 이후로.

### 완료 — Q3 구현
- 배선 발견: PropertiesPanel은 이미 `onChange(symbol)`/`onUpdatePin`을 받으므로 SymbolEditor.tsx 수정 불필요. 모델 필드만 채우면 `symbolXmlParser`가 `electricalType="${pin.electricalType ?? pin.type}"`와 Properties를 자동 직렬화.
- 핀 두 타입 필드 공존 처리: v1 `type`(5종, 색/단순)과 v2 `electricalType`(12종 KiCad)이 별개. "Detailed Type" 셀렉터에서 power_in/power_out 등 선택 시 `V2_TO_V1_CATEGORY`로 v1 `type`을 자동 동기화해 색·XML 일관성 유지.
- 파일 크기 규칙: PropertiesPanel(1132줄)을 건드리는 김에 `inspectors/`로 PinInspector·SymbolPropertiesEditor·공유 fields를 분리해 902줄로 축소. **남은 backlog: ShapeInspector/VisualStateOverridePanel도 추후 분리하면 800 이하 가능.**
- 검증: `npx tsc --noEmit` 무에러, SymbolEditor 테스트 166 + 심볼 XML 497 통과, 신규 `inspectors.test.tsx` 7 통과.

### 다음 결정 포인트 (미진행)
- Q2(파라메트릭 포트, T2 vs T3)와 Q1 하이브리드의 아날로그 끼움 인터페이스 설계는 아직. 사용자 지시 대기.
