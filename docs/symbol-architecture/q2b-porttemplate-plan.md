# Q2 트랙 B 실행 계획 — 선언적 XML PortTemplate

> 커스텀 XML 심볼이 인스턴스 속성으로 포트 개수를 가변화할 수 있게 한다.
> 트랙 A(scope 코드 함수)에서 검증한 "속성 변경 → ports 재계산" 메커니즘을 선언적으로 일반화.

## 결정 (q2-parametric-ports.md의 B-1~B-4 확정)

- **B-1 위치 표현 = 명시 속성.** 표현식 DSL을 만들지 않는다. `<ms:PortTemplate>`에 `xStart/xStep` 또는 `yStart/yStep`로 등간격 배치. (orientation/edge에 따라 축 선택.)
- **B-2 해석 위치 = 순수 유틸.** `resolveInstancePorts(def, instanceProps): Port[]`를 별도 파일로. customSymbolBridge가 호출. 단위 테스트 용이.
- **B-3 인스턴스 UI = IndustrialProperties 확장.** 커스텀 심볼의 `instanceProperties`를 편집 필드로 렌더(기존 라우팅 재사용). PortTemplate가 의존하는 key 변경 시 ports 재계산해 함께 저장(트랙 A와 동일 패턴).
- **B-4 저작 = XML 수기 먼저.** 심볼에디터 PortTemplate 저작 UI는 후속. 이번엔 XML로 작성·로드만.

## 스키마 (제안)

```xml
<ms:Ports>
  <ms:Port id="trig" name="TRIG" .../>           <!-- 정적 포트는 그대로 -->
  <ms:PortTemplate repeat="channels" min="1" max="8"
    idPattern="ch{i}" namePattern="CH{i}" numberFrom="1"
    type="input" electricalType="input" functionalRole="general"
    orientation="left" shape="line"
    x="0" yStart="10" yStep="10"/>
</ms:Ports>
```

- `repeat` = 개수를 제어하는 Property key. `min/max` = 클램프(기본 1..N).
- `{i}` = 1-base 인덱스 치환. `numberFrom` = 번호 시작값.
- 좌/우 엣지: `x` 고정 + `yStart + (i-1)*yStep`. 상/하 엣지: `y` 고정 + `xStart + (i-1)*xStep`.
- 개수 = `clamp(instanceProps[repeat] ?? def의 해당 Property 기본값, min, max)`.

## 단계 (각 단계 끝에 검증)

### Phase 1 — 데이터 레이어 (동작 변화 없음)
- `PortTemplate` 타입 추가 (`types/symbol.ts` 또는 symbolXmlTypes).
- 파서: `<ms:PortTemplate>` → `def.portTemplates: PortTemplate[]`.
- 직렬화: `symbolToXml`이 PortTemplate를 다시 출력.
- 검증: 라운드트립 테스트(파싱→직렬화→재파싱 동일). 기존 정적 포트 회귀 없음.

### Phase 2 — 인스턴스 포트 해석
- `resolveInstancePorts(def, instanceProps): Port[]` — 정적 pins + 펼친 template ports 병합. offset 기반 배치(트랙 A처럼 absolutePosition 미설정).
- customSymbolBridge: `getCustomSymbolPorts(symbolId, instanceProps?)`로 시그니처 확장. 인스턴스 생성/렌더 경로에서 instanceProps 전달.
- 검증: 단위 테스트(channels=2→2포트, =6→6포트, 클램프). 정적 심볼 회귀 없음.

### Phase 3 — 커스텀 심볼 인스턴스 속성 UI
- `IndustrialProperties`(custom_symbol 라우팅)가 `symbol.properties`(visible) → 인스턴스 편집 필드 렌더, `instanceProperties`에 저장.
- 변경이 PortTemplate의 `repeat` key면 `resolveInstancePorts`로 ports 재계산해 함께 저장.
- 검증: 컴포넌트 테스트 + 실제 앱(트랙 A처럼).

### Phase 4 — 데모 심볼 + 검증
- PortTemplate를 쓰는 샘플 커스텀 심볼(예: 가변 단자 스트립 / 멀티채널 커넥터) 작성.
- 배치 후 인스턴스 속성으로 포트 수 변경 확인. XML 라운드트립 보존.

## 비범위 (이번 트랙 B에서 제외)
- 심볼에디터 PortTemplate 저작 UI(B-4 후속).
- 표현식 DSL(B-1: 명시 속성으로 충분).
- 불규칙 기하/조건부 포트(코드 백드 T3 영역).
