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
- props 매핑: `symbolBlockDefAdapter.ts:132` (`symbolPropsToDefaultProps`)
- 인스턴스 생성: `blockFactory.ts` (merge)
- BOM(기존): `bomGenerator.ts`

## 2026-06-27 — 구현 (설정 기반으로 전환)

### 왜 심볼 XML이 아니라 설정인가
사용자 제안으로 prefix를 앱 전역 설정으로 옮겼다. prefix는 심볼 고유 속성이 아니라
조직/표준 관례(IEC vs ANSI vs 사내)라 사용자가 바꿔야 한다. 부수 효과로 심볼 XML
35개·Rust 파서·symbol.ts·blockDefinitions를 안 건드려 작업이 크게 줄었다.
`keybindingOverrides`(이미 존재하는 Record<string,string> 설정)와 같은 패턴.

### 별칭 정규화 — canonicalBlockType
런타임 `block.type`이 canonical(`power_source`)일 수도 legacy/심볼명(`powersource`)일
수도 있다. `BLOCK_TYPE_TO_SYMBOL_ID`(builtin-symbols)가 별칭을 같은 심볼 id로
모아주므로, 그 id에서 `builtin:`을 뗀 값을 canonical 키로 썼다. 덕분에
power_source/powersource, relay_coil/relay, plc_input/plc_in이 한 칸으로 모이고
override도 별칭 어긋남 없이 적용된다.

### 주입을 3곳에 한 이유
facade 아키텍처라 createBlockInstance 호출부가 셋이다 — useSchematicCanvasDocument
(OneCanvas 라이브), useCanvasDocument, canvasStore(deprecated). createBlockInstance는
순수 함수라 기존 부품 목록을 모른다(다음 번호 계산 불가). 그래서 번호 계산은
components Map을 쥔 addComponent 쪽에서 하고, 셋 다 동일하게 주입했다.

### 검증 메모
- vitest는 worktree에 node_modules가 없어 메인 repo의 `.bin/vitest`를 worktree
  cwd에서 실행(중첩 경로라 상위 node_modules로 해석됨). 12+219 그린.
- cargo는 fresh worktree에서 openssl 소스 빌드가 perl 환경 문제로 실패 →
  `CARGO_TARGET_DIR`을 메인 target으로 돌려 캐시 재사용. `cargo check` exit 0.
- settings 테스트 exe는 STATUS_ENTRYPOINT_NOT_FOUND(DLL 로딩) — 코드 아닌 환경 문제.
