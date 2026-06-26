# 자동 넘버링 — 컨텍스트 노트

작업 중 내린 결정과 그 이유를 계속 덧붙인다.

## 2026-06-27 — 초기 조사·설계

### 왜 BOM/netlist 전체 인프라가 아니라 designation 인프라인가
사용자 요청은 "PS1, PS2 auto-increment". netlist(wire→net 추출)는 별개 기능이고
자동 넘버링에 불필요하다. 필요한 건 **reference designator 발급기** 하나뿐.
designation 인프라가 깔리면 BOM(이미 동작)과 향후 netlist가 그 위에 얹힌다.

### 왜 prefix를 심볼 XML 메타로 두는가 (사용자 선택)
대안은 코드 내 중앙 매핑 테이블이었다. 심볼 XML로 간 이유는 ModOne이 심볼을
single source of truth로 삼는 구조이기 때문(`blockDefinitions.ts` 헤더 주석 참고).
geometry·ports·props가 모두 심볼에서 파생되므로 prefix도 같은 자리에 두는 게 일관적.
대가: XML + TS 로더 + Rust 파서 세 곳을 손대야 한다.

### 왜 category/iecCategory를 재활용하지 않는가
`SymbolDefinition`엔 이미 `category`("switching" 등)와 `iecCategory`가 있다.
하지만 designator prefix는 카테고리와 1:1이 아니다 — 예컨대 relay(K)와
contactor(KM)는 같은 "switching" 카테고리지만 prefix가 다르다(IEC 81346).
그래서 `designationPrefix`를 독립 필드로 둔다.

### 왜 "최댓값+1"이고 수동 값도 max에 포함하나 (사용자 선택)
gap 재사용은 "방금 놓은 게 몇 번?"이 덜 직관적이고 구현도 더 복잡하다.
최댓값+1은 EDA 툴 관례. 단, 사용자가 수동으로 K9를 박아뒀다면 다음 자동값은
K10이어야 충돌이 없으므로, **수동 값도 반드시 max 스캔에 포함**한다.
"수동 값 보존"(사용자 선택)은 *기존 값을 바꾸지 않는다*는 뜻이지 *무시한다*가 아니다.

### 주입 지점을 addComponent로 잡은 이유
designation 기본값이 흐르는 경로가 `심볼 properties → defaultProps → blockFactory
merge` 단일선이고, 그 최상단 호출자가 `addComponent`(canvasStore.ts:476) 하나다.
여기서 `props.designation`이 비어있을 때만 주입하면, 복제·붙여넣기·프로젝트 로드처럼
이미 designation을 들고 오는 경로를 자연히 건드리지 않는다.

### 미해결로 남긴 것
- **prefix 표준 표**: 부품 종류별 prefix 전체 매핑이 아직 없다. IEC 81346을 따를지
  사내 관례를 따를지 사용자 확인 필요. (relay=K, motor=M, fuse=F 등은 조사에서
  부분적으로 드러남)
- **복제/붙여넣기 정책**: 원본 designation 유지가 기본이지만, "복제 시 새 번호"를
  원하면 별도 처리 필요.
- **designationManual 플래그**: Renumber All 기능 없이는 데이터만 쌓인다.
  이번엔 생략하고 향후 도입 가능.

### 참고 파일 좌표
- 심볼 designation 기본값: `relay.symbol.xml:122-125`
- props 매핑: `symbolBlockDefAdapter.ts:132` (`symbolPropsToDefaultProps`)
- override 맵: `blockDefinitions.ts:45-90`
- 인스턴스 생성: `blockFactory.ts:24` (merge)
- 주입 지점: `canvasStore.ts:476` (`addComponent`)
- BOM(기존): `bomGenerator.ts`
- Rust 파서 Category 핸들러: `xml_parser.rs:221`
