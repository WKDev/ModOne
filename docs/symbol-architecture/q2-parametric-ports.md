# Q2 설계 — 파라메트릭 포트 (인스턴스 속성 → 가변 포트)

> 목표. scope의 `channels`처럼 **인스턴스 속성값을 바꾸면 포트 개수/배치가 인스턴스마다 달라지게** 한다.
> 이 문서는 코드 작성 전 설계 합의. 트랙 A/B를 비교하고 단계적 경로를 정한다.

## 1. 문제와 현재 파이프라인 (코드로 검증, 2026-06-27)

- 포트는 **인스턴스마다 생성**되지만 생성 후 **불변**.
  - 생성: `OneCanvas/runtime/blockFactory.ts:10` `createBlockInstance()` — 정의에서 읽어 복사.
  - 커스텀 심볼 정의→포트: `utils/symbolBlockDefAdapter.ts:122` `symbolPinsToRawPorts()`.
  - 커스텀 심볼 포트 캐시: `OneCanvas/renderers/symbols/customSymbolBridge.ts:206` `getCustomSymbolPorts(symbolId)` — **정의당 1회, 인스턴스 무관**.
- 인스턴스 속성 저장 위치.
  - 커스텀 심볼: `types/symbol.ts:376` `CustomSymbolBlock.instanceProperties: Record<string, string|number|boolean>`.
  - 내장 타입 블록: 전용 필드 (`ScopeBlock.channels`, `TerminalBlock.terminalCount`).
  - 갱신: `stores/hooks/useCanvasDocument.ts:240` `updateComponent()` — `{ ...component, ...updates }`. 포트 자동 재계산 없음.
- **이미 존재하는 가변 포트 선례 (중요).**
  - `OneCanvas/blockDefinitions.ts:147` `getPowerSourcePorts(polarity)` — 값에 따라 다른 Port[] 반환.
  - `panels/content/properties/PowerSourceProperties.tsx:72` — polarity 변경 시 `{ polarity, ports: getPowerSourcePorts(...) }`로 **포트를 같이 저장**.
- **갭 (= 사용자가 짚은 지점).**
  - `panels/content/properties/ScopeProperties.tsx:75` `handleChannelsChange` — `channels`만 바꾸고 ports 미재계산.
  - terminal_block도 `terminalCount` 필드만 있고 포트 정적.

결론. "파라메트릭 포트"는 새 땅이 아니다. 한 타입(PowerSource)이 이미 한다. 빠진 곳에 같은 패턴을 적용하면 된다.

## 2. 트랙 A — 코드 백드 per-type 포트 함수 (PowerSource 패턴)

내장 "특수 모듈"(scope, terminal_block)을 즉시 가변화.

### 설계
- `blockDefinitions.ts`에 추가.
  - `getScopePorts(channels: number): Port[]` — 채널 수만큼 왼쪽 입력 포트를 등간격 배치.
  - `getTerminalBlockPorts(count: number): Port[]` — 단자 수만큼 in/out 쌍.
- 속성 편집기에서 재계산해 함께 저장 (PowerSource와 동일).
  - `ScopeProperties.handleChannelsChange` → `onChange({ channels, ports: getScopePorts(channels) })`.
  - terminal_block 속성 편집기도 동일.
- 생성 시점 정합성.
  - `createBlockInstance`/`getDefaultPorts`가 기본 channels로 초기 포트를 만들도록 보장 (기본값과 포트 수 일치).

### 장단점
- 장점. 검증된 패턴, 위험 작음, scope를 지금 해결, "특수 모듈=코드 백드" 합의와 일치, 테스트 쉬움.
- 단점. 타입마다 함수가 필요(일반화 아님). 커스텀 XML 심볼에는 적용 안 됨.

## 3. 트랙 B — 선언적 XML PortTemplate (T2)

커스텀 심볼까지 데이터 주도로 일반화.

### 스키마 (제안)
표현식 DSL은 피하고 **명시 속성**으로 위치를 정의 (파서 불필요).
```xml
<ms:Ports>
  <ms:PortTemplate repeat="channels" min="1" max="8"
    idPattern="ch{i}" namePattern="CH{i}" numberFrom="1"
    type="input" electricalType="input" orientation="left"
    x="0" yStart="10" yStep="10"/>
</ms:Ports>
```
- `repeat` = 개수를 제어하는 Property key. `min/max` = 클램프.
- `idPattern/namePattern` = `{i}` 치환 (1-base).
- `x` 고정, `yStart + (i-1)*yStep` 로 등간격. (orientation별로 축만 바뀜.)

### 로더 / 인스턴스 인지 포트 해석
- 핵심 변경. 포트 해석을 **인스턴스 인지**로. `getCustomSymbolPorts(symbolId, instanceProperties?)`로 시그니처 확장.
  - 정의의 정적 Port + PortTemplate 펼침 결과를 합쳐 반환.
  - 펼침 개수 = `clamp(instanceProperties[repeat] ?? defaultFromProperty, min, max)`.
- 캐시 전략. 정적 부분은 정의당 캐시, 템플릿 부분은 (symbolId, count)별 메모.

### 커스텀 심볼 인스턴스 속성 UI (신설 필요)
- 현재 `panels/content/properties/IndustrialProperties.tsx`는 custom_symbol에 빈 필드 반환.
- `symbol.properties`(visible)를 인스턴스 편집 필드로 렌더하고, `instanceProperties`에 저장.
- 변경 시 PortTemplate가 그 key에 의존하면 ports 재계산해 함께 저장(트랙 A와 동일한 합치기 규칙).

### 장단점
- 장점. 데이터 주도("원칙적으로 XML" 철학), 커스텀 심볼 일반 지원, 에디터에서 PortTemplate 저작로 확장 가능.
- 단점. 스키마+직렬화+파서+인스턴스 인지 포트 해석+커스텀 심볼 인스턴스 UI까지 범위 큼. 회귀 표면 넓음.

## 4. 권장 경로 — A 먼저, B 나중

1. **A 구현 (이번).** scope·terminal_block을 PowerSource 패턴으로 가변화. 사용자의 실제 예시를 즉시 해결하고 패턴을 한 번 더 굳힘.
2. **B 설계·구현 (다음).** PortTemplate 스키마 + 인스턴스 인지 포트 해석 + 커스텀 심볼 인스턴스 UI. A에서 만든 "ports 합치기/재계산" 규칙을 재사용.

근거. B의 인스턴스 인지 포트 해석과 "속성 변경 시 ports 재계산"은 A에서 작게 먼저 검증된다. A 없이 B로 직행하면 새 스키마와 새 UI와 새 해석 경로를 동시에 디버깅하게 됨.

## 5. B의 미결정 (착수 전 확정)
- **B-1.** 위치를 명시 속성(yStart/yStep)으로 갈지, 최소 표현식(`y=10+i*10`)을 허용할지. (권장: 명시 속성, DSL 회피.)
- **B-2.** 인스턴스 인지 포트 해석을 `customSymbolBridge`에 둘지, 별도 `resolveInstancePorts()` 유틸로 뺄지.
- **B-3.** 커스텀 심볼 인스턴스 속성 UI를 `IndustrialProperties`에 넣을지 전용 패널 신설할지.
- **B-4.** PortTemplate 저작을 심볼에디터 UI에 넣을지(=Q2와 Q3의 만남), XML 수기 작성만 둘지.

## 6. 검증 기준
- A. scope 인스턴스의 channels를 바꾸면 포트 수가 즉시 바뀐다(유닛 테스트 + 실제 앱 확인). terminal_block 동일. 기존 심볼 회귀 없음.
- B. PortTemplate를 가진 커스텀 심볼을 배치 후 인스턴스 속성으로 포트 수 변경. XML 라운드트립(PortTemplate 보존). 정적 포트 심볼 회귀 없음.
