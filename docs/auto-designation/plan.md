# 부품 자동 넘버링 (Auto Designation) — 설계

> OneCanvas에 부품을 배치하면 종류별로 PS1, PS2, K1, K2… 처럼 designation이
> 자동 증가하도록 한다. BOM/netlist의 토대가 되는 reference designator 인프라.

## 목표

부품을 배치하는 순간, 같은 prefix를 쓰는 기존 부품을 스캔해 다음 번호를
부여한다. 사용자가 직접 고친 designation은 건드리지 않는다.

## 확정된 결정 (사용자 선택)

| 항목 | 결정 | 근거 |
|------|------|------|
| prefix 정의 위치 | **앱 전역 설정 override + 코드 기본표** | prefix는 심볼 기하학이 아니라 조직/표준 관례. 사용자가 바꿔야 함 |
| 기본표 기준 | **IEC 81346-2** | `designation-codes.md` 확정표를 TS 상수로 박제 |
| 빈 번호 처리 | **최댓값+1 (gap 허용)** | 예측 가능. EDA 툴 관례. PS1·PS3 → 다음 PS4 |
| 수동 수정 designation | **보존** | 사용자가 직접 박은 값은 자동 로직이 덮지 않음 |

> 방향 전환: 초기엔 prefix를 심볼 XML 메타(`DesignationPrefix`)에 넣을 계획이었으나,
> prefix는 심볼 고유 속성이 아니라 사용자가 바꾸는 관례라서 **앱 전역 설정**으로
> 옮겼다. 결과적으로 심볼 XML 35개·Rust 파서·symbol.ts를 건드리지 않아 작업이 줄었다.

## 현재 구조 (조사 결과)

### designation이 흐르는 단일 경로
```
심볼 XML  <ms:Property key="designation"><DefaultValue>K1</>   relay.symbol.xml:122
   ↓ (TS 로더 / Rust xml_parser.rs)
SymbolDefinition.properties
   ↓ symbolPropsToDefaultProps()                              symbolBlockDefAdapter.ts:132
defaultProps { designation: 'K1', ... }
   ↓ getDefaultBlockProps(type)                               blockDefinitions.ts:136
   ↓ merge                                                    blockFactory.ts:24
Block.designation = 'K1'
   ↑ 호출
addComponent(type, pos, props)                                canvasStore.ts:476
```

### 핵심 결손
1. **자동 increment 없음.** 기본값이 리터럴 `'K1'`이라 relay를 3개 놓으면 셋 다 K1.
2. **prefix 메타데이터 없음.** 번호가 prefix와 한 문자열(`'K1'`)에 뒤섞여 있다.
   심볼엔 `category`/`iecCategory`는 있으나, designator prefix는 카테고리와
   1:1이 아니므로(IEC 81346) 별도 명시 필드가 필요.

### override 경로 (심볼 미파생 부품)
`blockDefinitions.ts`의 `power_source`(PS1), `power_source_dc_2p`(BAT1),
`relay_coil`(K1)은 심볼에서 파생되지 않는 override다. 이들도 prefix를
명시해야 한다.

## 설계

### 1. 기본 prefix 테이블 (코드 상수)
`src/components/OneCanvas/utils/designation.ts`의 `DEFAULT_DESIGNATION_PREFIXES`.
키는 **canonical 블록 타입** = builtin 심볼 id에서 `builtin:`을 뗀 값
(`canonicalBlockType()` in `assets/builtin-symbols/index.ts`). 이 정규화 덕에
`power_source`/`powersource`, `relay_coil`/`relay`, `plc_input`/`plc_in` 같은
별칭이 한 칸으로 모인다. 값은 `designation-codes.md` 확정표.

### 2. 설정 override (앱 전역)
`AppSettings.designationPrefixOverrides: Record<string,string>` (TS + Rust 1:1).
`keybindingOverrides`와 동일 패턴 — 사용자가 바꾼 항목만 저장, 기본표 위에 덮어쓴다.

### 3. prefix 조회: `resolveDesignationPrefix(type, overrides)`
순수 함수. 우선순위: override[canonical] → 기본표[canonical] → `undefined`.
빈 문자열 override는 "끔"으로 보고 `undefined`(자동 넘버링 안 함).

### 4. 넘버링 로직: `nextDesignation(prefix, components)`
순수 함수. `utils/designation.ts`.
```
같은 prefix로 시작하는 모든 designation을 스캔
 → 정규식 ^{prefix}(\d+)$ 로 숫자부 추출 (앵커 고정 — KM1은 K풀이 아님)
 → max + 1  (없으면 1)
 → `${prefix}${n}` 반환
```
- **수동 값도 max 계산에 포함**한다. 사용자가 K9를 박아뒀으면 다음은 K10이어야
  충돌이 없다. "보존"은 기존 값을 안 바꾼다는 뜻이지, 무시한다는 뜻이 아니다.

### 5. 주입 지점: `addComponent` (생성 경로 3곳)
`createBlockInstance` 호출 직전에 `nextAutoDesignation(type, components.values())`.
```ts
let finalProps = props;
if (finalProps.designation === undefined) {
  const designation = nextAutoDesignation(type, <components>.values());
  if (designation) finalProps = { ...finalProps, designation };
}
```
- facade 아키텍처라 생성 경로가 셋: `useSchematicCanvasDocument`(OneCanvas 라이브),
  `useCanvasDocument`, `canvasStore`(deprecated). 셋 다 주입.
- `nextAutoDesignation`은 앱 전역 설정의 override를 읽고 `resolveDesignationPrefix`로
  prefix를 구한 뒤 `nextDesignation`을 부른다.
- `props.designation`이 이미 있으면(붙여넣기·복제·로드) 건드리지 않는다.

## 영향 범위 (실제 구현)

| 파일 | 변경 |
|------|------|
| `src/assets/builtin-symbols/index.ts` | `canonicalBlockType()` 추가 (별칭 정규화) |
| `src/components/OneCanvas/utils/designation.ts` | **신규** — 기본표 + `resolveDesignationPrefix`/`nextDesignation`/`nextAutoDesignation` |
| `src/components/OneCanvas/utils/__tests__/designation.test.ts` | **신규** — 순수 함수 12 테스트 |
| `src/types/settings.ts` | `designationPrefixOverrides: Record<string,string>` |
| `src-tauri/src/commands/settings.rs` | `designation_prefix_overrides: HashMap` (serde default) |
| `src/stores/canvasStore.ts` | `addComponent` 주입 |
| `src/stores/hooks/useSchematicCanvasDocument.ts` | `addComponent` 주입 |
| `src/stores/hooks/useCanvasDocument.ts` | `addComponent` 주입 |
| `src/components/settings/DesignationSettings.tsx` | **신규** — prefix 편집 UI |
| `src/components/panels/content/SettingsPanel.tsx` | "부품 넘버링" 카테고리 연결 |

심볼 XML·Rust 파서·symbol.ts·blockDefinitions는 **건드리지 않음**(설정 기반 전환 덕).

## 비목표 (이번 작업 아님)

- **netlist 추출** — wire 연결에서 net 뽑는 건 별개 기능. 같은 designation
  인프라를 공유하지만 이번 범위 밖.
- BOM 개선 — `bomGenerator.ts`는 이미 동작. 자동 넘버링이 들어가면 품질이
  따라 오르므로 추가 변경 불필요.
- Renumber All UI.

## 검증 기준

1. 같은 종류 부품 N개 배치 → designation이 prefix1..prefixN 으로 증가.
2. 중간 부품 삭제 후 새로 배치 → 최댓값+1 (gap 유지).
3. 수동으로 K9 설정 후 relay 배치 → K10.
4. 복제/붙여넣기 → 원본 designation 유지(자동 재부여 안 함). ※ 정책 확인 필요
5. prefix 없는 부품(text) → designation 미부여, 기존 동작 유지.
6. `cargo test` (xml_parser) + xml-loader-integration.test.ts 그린.
