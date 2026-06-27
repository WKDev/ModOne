# 커스텀 심볼 · 파라메트릭 · 시뮬레이션 아키텍처 설계

> OneCanvas에서 쓸 커스텀/특수 심볼을 어떻게 저작·렌더·구동할지에 대한 설계 문서.
> 이 문서는 코드 작성 전 단계의 설계 합의를 기록한다. 결정/미결정을 명확히 구분한다.

## 0. 한 줄 요약

ModOne은 이미 **2층 구조**(선언적 XML + 코드 백드 archetype 동작 계층)를 갖고 있다.
"가변 포트 특수 모듈"과 "더 풍부한 시뮬레이션"은 서로 다른 문제가 아니라 **archetype 계층을 확장하는 한 작업으로 수렴**한다. XML은 정적 뼈대로 남기고, archetype이 파라메트릭·동작·시뮬을 담당한다.

---

## 1. 현재 상태 (코드로 검증됨, 2026-06-27)

### 1.1 심볼 정의 = 정적 선언 XML
- 스키마 네임스페이스: `http://modone.io/schema/symbol/1.0`
- 타입: `src/lib/symbolXmlTypes.ts`
- XSD: `src/assets/symbol-schema/modone-symbol.xsd`
- builtin 심볼 45개: `src/assets/builtin-symbols/xml/*.symbol.xml`
- 로더: `src/assets/builtin-symbols/index.ts` (`import.meta.glob` → `parseSymbolXml`)
- 그래픽 프리미티브: Rect / Circle / Polyline / Arc / Text (`src/lib/xmlElementParsers.ts`)

### 1.2 포트는 100% 정적, Property는 메타데이터
- 포트 생성: `src/utils/symbolBlockDefAdapter.ts:104` `getAllPins()` — `symbol.pins` + `units[].pins` 단순 합집합. **반복/동적 생성 없음.**
- XSD에 repeat/표현식/파라미터 생성 구문 **없음**. 동적인 것은 Text의 `${propertyKey}` 치환뿐 (`modone-symbol.xsd:396`).
- **증거 = scope 자신.** `scope.symbol.xml`은 포트 `ch1~ch4`를 하드코딩하고 `channels` 기본값은 `1`. 둘이 분리돼 있어 channels를 바꿔도 포트 불변. (현존하는 불일치/버그성 신호.)
- `terminal_block.symbol.xml`도 `terminalCount` Property는 메타데이터일 뿐, 포트는 IN/OUT 2개 고정.

### 1.3 동작/시뮬레이션 = 코드 백드 archetype 계층 (이미 존재)
- 템플릿 레지스트리: `src/components/OneCanvas/runtime/behaviorTemplates.ts`
  - `archetype:motor / relay / lamp / switch` 4개 (`BEHAVIOR_TEMPLATES`, `TEMPLATE_BY_ID`)
  - `resolveBehaviorBinding(block)` — XML `<ms:Behavior>` 또는 block type 기반 바인딩
- 미니 시뮬레이터: `src/components/OneCanvas/utils/circuitSimulator.ts`
  - `simulateCircuit()` → `deriveBehaviorStates()` (topological)
  - `powered`(전원 도달) + `reachable`(2+ 포트 연결) → 시각상태 도출
  - 예: motor `running = powered || reachable` (`behaviorTemplates.ts:335`)
- 렌더: `src/components/OneCanvas/renderers/SimulationRenderer.ts`
- **중요한 한계 2개.**
  1. 현재 시뮬은 SPICE가 아니라 **on/off 논리 전파 수준**.
  2. 이 동작 계층은 **OneCanvas 런타임에서만** 돈다. SymbolEditor는 편집만(`BehaviorRulesPanel`은 IFTTT 규칙 편집 UI일 뿐, 실행 없음).

### 1.4 SymbolEditor 역량과 공백
- 됨: Rect/Circle/Line/Polyline/Arc/Text/Pin 드로잉, 멀티유닛, 시각상태 탭, XML export (`src/components/SymbolEditor/SymbolEditor.tsx`).
- 공백(= 사용자가 의심한 지점): 핀의 `electricalType=power` 지정 UI, 의미 있는 Property(`voltage`/`netName`) 저작 UI가 충분히 노출 안 됨. 소스/GND 심볼의 "그림"은 쉽고, 막히는 건 **전기적 시맨틱 저작**.

---

## 2. 사용자 관심사 (이번 세션에서 확정)

주된 관심사는 **(2) 에디터 시맨틱 저작**과 **(3) 시뮬레이션**. 단순 팔레트 채우기는 후순위.

추가로 제기된 요구: **scope처럼 Property(channels)를 바꾸면 포트가 가변적으로 변하는 특수 모듈**을 XML 기반 기본 심볼로 만들 수 있는가.

---

## 3. 제안 아키텍처 — 3-tier 심볼 모델

| Tier | 정의 방식 | 대상 | 비용 |
|------|-----------|------|------|
| **T1 정적 XML** | 순수 선언적 그림+핀+속성 | 저항·다이오드·GND·고정 소자 대부분 | 이미 됨 |
| **T2 파라메트릭 XML** | 포트 그룹 반복 구문 + 로더 확장 | "동일 단자 N개"류 (scope channels, terminal block, 커넥터, 버스) | 중 |
| **T3 코드 백드 archetype** | TS 제너레이터/동작 모델 | 불규칙 기하·조건부 포트·시뮬 동작 (특수 모듈) | 중~대 |

핵심: **특수 모듈을 순수 선언 XML에 욱여넣지 않는다.** T3로 보내고, 그 archetype 계층이 시뮬레이션 동작과 같은 자리이므로 (2)/(3)/가변포트가 한 곳에서 만난다.

### 3.1 T2 파라메트릭 XML — 검토안
예시 구문(미확정):
```xml
<ms:PortTemplate repeat="channels" idPattern="ch{i}" namePattern="CH{i}"
  orientation="left" x="0" y="10 + i*10"/>
```
- 로더(`parseSymbolXml`/`symbolBlockDefAdapter`)가 로드 시점에 `channels` 값으로 펼침.
- 선언적이라 "XML 기반 기본 심볼" 원칙 유지.
- 흔한 "N개 동일 포트" 케이스 80%를 코드 없이 커버.

### 3.2 T3 코드 백드 — 검토안
- `archetype:scope` 같은 항목에 `generatePorts(props)` / `generateGraphics(props)` 훅 추가.
- 기존 `behaviorTemplates.ts` 레지스트리를 "동작" 뿐 아니라 "구조 생성"까지 담당하도록 확장.

---

## 4. 결정 / 미결정

### 확정
- 워크트리에서 **설계 문서부터** 작성한다. (이 문서)
- 시뮬레이션은 백지가 아님 — 기존 `circuitSimulator` + `behaviorTemplates` 위에 쌓는다.
- 특수 모듈/가변 포트는 archetype(T3) 계층으로 간다.

### 미결정 — 다음 결정 포인트 (전체 규모를 가름)
**Q1. 시뮬레이션 깊이.**
- (a) 논리 수준 확장 — 기존 on/off 전파를 릴레이·모터·램프·스위치 너머로 증분 확장. 아날로그 파형 불가.
- (b) 아날로그/SPICE급 — nodal 솔버로 실제 V/I·R/L/C·AC. Falstad급. scope 파형·current source·계측기가 진짜 의미를 가짐. 대형.
- (c) 단계적 하이브리드 — 지금 (a), 같은 archetype 심으로 나중에 (b)를 끼울 수 있게 설계만 열어둠. (권장 후보)

**Q2. 파라메트릭 포트를 T2(선언 XML 반복) vs T3(코드 생성) 중 어디서 우선 지원할지.**

**Q3. (2) 에디터 시맨틱 저작(핀 전기타입 + Property 패널)을 시뮬레이션과 독립적으로 먼저 진행할지.** (독립적이고 비용 작음 → 먼저 빼도 좋음.)

---

## 5. Falstad 목록 매핑 (참고)

- **A. 이미 있음**: Ground, V-source AC/DC(1T/2T), LED, Lamp, Text, DC/3φ Motor, Capacitor, Inductor, Switch, Push, SPDT, Transformer, Relay/Coil/Contact, Fuse, Labeled Node(net_label), Scope, Resistor, Diode.
- **B. 쉬운 순수 심볼(T1)**: Current Source, Square Wave, Clock, Variable Voltage, Potentiometer, Photoresistor, Thermistor, Memristor, Crystal, Spark Gap, Antenna, Polarized Cap, DPDT, Make-Before-Break, Cross Switch, Tapped/Custom Transformer, Transmission Line, Ammeter, Voltmeter, Ohmmeter, Wattmeter, Test Point.
- **C. 시뮬 전용(동작 엔진 없으면 빈 껍데기)**: A/C Sweep, AM/FM Source, Noise Gen, Audio In/Out, Data In/Export, External Voltage(JS), Analog Output, Decimal/Instruction Display, LED Array, Stop Trigger.

ModOne은 산업 제어 스캐메틱 도구이므로 C 대부분은 범위 밖. B는 T1로 저렴하게 추가 가능.
