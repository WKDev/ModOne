# 부품 자동 넘버링 (Auto Designation) — 설계

> OneCanvas에 부품을 배치하면 종류별로 PS1, PS2, K1, K2… 처럼 designation이
> 자동 증가하도록 한다. BOM/netlist의 토대가 되는 reference designator 인프라.

## 목표

부품을 배치하는 순간, 같은 prefix를 쓰는 기존 부품을 스캔해 다음 번호를
부여한다. 사용자가 직접 고친 designation은 건드리지 않는다.

## 확정된 결정 (사용자 선택)

| 항목 | 결정 | 근거 |
|------|------|------|
| prefix 정의 위치 | **심볼 XML 메타데이터** | 데이터 일원화. 심볼이 single source of truth |
| 빈 번호 처리 | **최댓값+1 (gap 허용)** | 예측 가능. EDA 툴 관례. PS1·PS3 → 다음 PS4 |
| 수동 수정 designation | **보존** | 사용자가 직접 박은 값은 자동 로직이 덮지 않음 |
| 이번 범위 | **설계 문서까지** | 코드는 다음 턴 |

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

### 1. 심볼 메타: `DesignationPrefix`
각 `.symbol.xml`의 `<ms:Category>` 다음에 한 줄 추가.
```xml
<ms:Category>switching</ms:Category>
<ms:DesignationPrefix>K</ms:DesignationPrefix>
```
- TS 로더와 Rust `xml_parser.rs` 둘 다 파싱 → `SymbolDefinition.designationPrefix?: string`.
- 없으면 `undefined`. designation을 안 쓰는 부품(text 등)은 생략.

### 2. prefix 조회 함수: `getDesignationPrefix(type)`
`blockDefinitions.ts`에 추가. 우선순위.
1. override 맵에 prefix가 있으면 그것 (power_source→`G`, dc_2p→`G`, relay_coil→`K`)
2. 심볼의 `designationPrefix` (값은 `designation-codes.md` 확정표)
3. 둘 다 없으면 `undefined` → 자동 넘버링 스킵 (designation 미부여)

(과거 호환: 기존 designation DefaultValue `'K1'`에서 영문 prefix를 추출하는
fallback을 둘지는 구현 시 결정. 명시 메타로 모두 채우면 불필요.)

### 3. 넘버링 로직: `nextDesignation(prefix, components)`
순수 함수. 새 util 파일(`utils/designation.ts`).
```
같은 prefix로 시작하는 모든 designation을 스캔
 → 정규식 ^{prefix}(\d+)$ 로 숫자부 추출
 → max + 1  (없으면 1)
 → `${prefix}${n}` 반환
```
- **수동 값도 max 계산에 포함**한다. 사용자가 K9를 박아뒀으면 다음은 K10이어야
  충돌이 없다. "보존"은 기존 값을 안 바꾼다는 뜻이지, 무시한다는 뜻이 아니다.

### 4. 주입 지점: `addComponent`
`canvasStore.ts:476`에서 `createBlockInstance` 호출 전.
```
const prefix = getDesignationPrefix(type)
if (prefix && props.designation === undefined) {
  props = { ...props, designation: nextDesignation(prefix, state.components) }
}
```
- `props.designation`이 이미 주어지면(붙여넣기·복제·로드) 건드리지 않는다.
- prefix 없으면 기존 동작 그대로(심볼 DefaultValue가 들어감).

### 5. 수동 보존 훅 (향후 Renumber용, 이번엔 데이터만)
사용자가 인스펙터에서 designation을 직접 수정하면 `Block.designationManual = true`.
이번 자동 넘버링(생성 시점)엔 영향 없지만, 향후 "Renumber All" 기능이 이 플래그를
존중하도록 자리만 마련. 미구현이면 생략 가능.

## 영향 범위 (구현 시)

| 파일 | 변경 |
|------|------|
| `src/assets/builtin-symbols/xml/*.symbol.xml` | `DesignationPrefix` 줄 추가 (designation 쓰는 심볼) |
| `src/types/symbol.ts` | `SymbolDefinition.designationPrefix?: string` |
| TS 심볼 로더 | `DesignationPrefix` 파싱 |
| `src-tauri/src/symbols/xml_parser.rs` | `DesignationPrefix` 파싱 (line 221 Category 핸들러 근처) + 타입 필드 |
| `src/components/OneCanvas/blockDefinitions.ts` | override에 prefix, `getDesignationPrefix()` |
| `src/components/OneCanvas/utils/designation.ts` | **신규** — `nextDesignation()` 순수 함수 |
| `src/stores/canvasStore.ts` | `addComponent`에 주입 (line 476) |
| (선택) 인스펙터 designation 편집 | `designationManual` 세팅 |

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
