# PRD Unit 12: Multi-Page Schematic System

## 개요

Multi-Page Schematic System은 여러 회로도 페이지를 하나의 문서로 관리하는 시스템입니다.
EPLAN, KiCad, OrCAD와 같은 산업용 EDA 도구의 핵심 기능으로, 대규모 프로젝트에서 회로를 논리적 단위로 분리하고 페이지 간 상호 참조(Cross-Reference)를 통해 연결합니다.

### 디자인 레퍼런스
- **EPLAN**: 프로젝트 단위 멀티페이지, Cross-Reference 자동 생성
- **KiCad**: Hierarchical Sheet 구조, Off-Page Connector
- **OrCAD**: Flat multi-page, Inter-page connector

### 기존 코드 기반
`src/components/OneCanvas/utils/multiPageSchematic.ts` (596 lines)에 이미 완전한 데이터 모델이 존재합니다:
- `MultiPageSchematic`, `SchematicPage`, `PageReference` 타입
- 페이지 CRUD, 순서 변경, Cross-Reference 관리 함수
- 직렬화/역직렬화 함수

**이 PRD는 기존 데이터 모델을 변경하지 않고, documentRegistry 통합 및 UI 구현에 집중합니다.**

---

## 아키텍처 결정 사항 (Architecture Decisions)

### AD-1: 문서 소유권 — documentRegistry 패턴 준수

**결정**: 별도의 `schematicStore` Zustand 스토어를 만들지 않습니다.

**근거**: 기존 `documentRegistry`가 모든 문서 타입(canvas, ladder, scenario)의 상태를 관리합니다. Schematic도 동일 패턴을 따릅니다.

**구현**:
- `src/types/document.ts`에 `SchematicDocumentState` 추가
- `src/stores/documentRegistry.ts`에 schematic-specific 메서드 추가
- `src/components/OneCanvas/utils/schematicHelpers.ts` — 순수 함수 모듈 (Zustand store 아님)
  - `documentRegistry`의 `updateSchematicData()`를 래핑하는 편의 함수들
  - 기존 `multiPageSchematic.ts`의 함수들을 documentRegistry 컨텍스트에서 호출하는 어댑터

```typescript
// schematicHelpers.ts — NOT a Zustand store
import { useDocumentRegistry } from '../../../stores/documentRegistry';
import { addPage, removePage, setActivePage } from './multiPageSchematic';

export function addPageToDocument(documentId: string, name?: string) {
  useDocumentRegistry.getState().updateSchematicData(documentId, (data) => {
    const updated = addPage(data.schematic, name);
    data.schematic = updated;
  });
}
```

### AD-2: 페이지 로딩 전략 — Eager Loading

**결정**: 모든 페이지를 메모리에 로드합니다.

**근거**: 일반적인 전자 회로도는 10-30페이지입니다. 페이지당 데이터가 작아 (컴포넌트 수십~수백개) 메모리 부담이 없습니다.

**구현**: `MultiPageSchematic.pages[].circuit`는 항상 non-nullable (`SerializableCircuitState`)를 유지합니다. Lazy loading은 100+ 페이지 요구사항이 발생할 때 별도 Unit으로 처리합니다.

### AD-3: Undo/Redo — 페이지 전환 시 히스토리 리셋

**결정**: `canvasStore`의 히스토리는 페이지 전환 시 리셋됩니다. Schematic 레벨 undo/redo는 `documentRegistry.pushHistory()`를 통한 whole-snapshot 방식입니다.

**근거**: 기존 `canvasStore`는 단일 캔버스의 세밀한 편집 히스토리를 관리합니다. 페이지를 전환하면 새로운 캔버스 세션이 시작되므로 히스토리가 무효화됩니다. Schematic 전체 수준의 undo/redo (페이지 추가/삭제/순서변경)는 documentRegistry의 기존 `pushHistory()`로 처리합니다.

**참고**: `canvasStore.loadCircuit()`은 내부적으로 `history=[]`, `historyIndex=-1`로 리셋합니다 (canvasStore.ts:1591-1592). 별도의 `resetHistory()` 메서드는 존재하지 않으며, `loadCircuit()` 호출만으로 히스토리 리셋이 완료됩니다.

**구현**:
```typescript
// SchematicHistoryData — JSON.stringify로 직렬화
export interface SchematicHistoryData {
  snapshot: string; // JSON.stringify(MultiPageSchematic)
}
```

### AD-4: 파일 경로 규칙 — `schematics/` 디렉토리

**결정**: Schematic 파일은 `.mop` 프로젝트의 **추출된 작업 디렉토리** 내 `schematics/{schematic_name}/` 경로를 사용합니다.

**근거**: 기존 `one_canvas/` 디렉토리는 단일 캔버스 문서용입니다. Schematic은 멀티페이지 구조이므로 별도 네임스페이스가 필요합니다.

**저장 흐름 (기존 `.mop` 패턴 준수)**:
1. `.mop` 파일은 ZIP 아카이브입니다
2. 프로젝트 열기 시 임시 작업 디렉토리로 추출됩니다 (기존 `mop_file.rs` 참조)
3. Schematic 저장은 이 추출된 작업 디렉토리의 `schematics/` 하위에 파일을 씁니다
4. 프로젝트 저장 시 전체 작업 디렉토리가 `.mop` ZIP으로 다시 패킹됩니다 (기존 패턴)
5. **Schematic 자체의 원자적 저장 (§저장 원자성)은 추출된 작업 디렉토리 내부에서 수행됩니다**

**경로 규칙**:
- `{schematic_name}`: 영문, 숫자, 하이픈, 언더스코어만 허용 (1-64자)
- 매니페스트: `schematics/{name}/manifest.yaml`
- 페이지 파일: `schematics/{name}/page_{number}.yaml` (1-indexed)

**예시 (추출된 작업 디렉토리 내 구조)**:
```
{work_dir}/
├── project.yaml           # 기존 프로젝트 메타데이터
├── one_canvas/            # 기존 단일 캔버스 파일들
│   └── main.yaml
├── schematics/            # 신규: 멀티페이지 schematic들
│   └── power_distribution/
│       ├── manifest.yaml
│       ├── page_1.yaml
│       ├── page_2.yaml
│       └── page_3.yaml
└── scenarios/             # 기존 시나리오 파일들
```

### AD-5: 글로벌 넷 — 메타데이터 전용

**결정**: 글로벌 넷은 라벨 수집용 메타데이터입니다. 전기적 연결 검증(ERC)은 이 Unit에서 구현하지 않습니다.

**근거**: 코드베이스에 `netLabelResolver.ts`가 존재하지만 단일 페이지 내 넷 라벨 해석용입니다. 크로스-페이지 전기적 연결 검증은 Unit 15 (ERC/DRC)에서 처리합니다.

**구현**: `MultiPageSchematic` 최상위에 `globalNets` 필드를 추가합니다 (`CircuitMetadata`를 변경하지 않음):
```typescript
// MultiPageSchematic 인터페이스에 optional 필드 추가
// 주의: CircuitMetadata 타입은 변경하지 않습니다 (다른 문서 타입에도 사용됨)
interface MultiPageSchematic {
  // ... 기존 필드들
  globalNets?: Array<{
    label: string;
    pages: Array<{ pageId: string; componentId: string }>;
  }>;
}
```

### AD-6: Off-Page Connector ID 규칙

**결정**: `off_page_connector` 블록의 Block ID === `PageReference.localId` / `PageReference.remoteId`

**근거**: PageReference가 이미 `localId`/`remoteId` 필드를 가지고 있습니다. Off-Page Connector 블록이 삭제되면 해당 localId를 가진 PageReference도 함께 삭제되어야 합니다.

**삭제 정책**:
1. Off-Page Connector 블록 삭제 시 → 해당 블록을 참조하는 모든 PageReference 삭제
2. 원격 페이지의 대응 incoming/outgoing reference도 삭제
3. 원격 페이지의 Off-Page Connector 블록은 유지하되 "dangling" 상태 표시 (빨간 테두리)

---

## 기능 요구사항

### 핵심 기능

#### 1. Schematic 문서 타입 추가
- `DocumentType`에 `'schematic'` 추가
- `SchematicDocumentState` 타입 추가 (`DocumentMeta` + `MultiPageSchematic` data)
- `documentRegistry`에 schematic 전용 메서드 추가:
  - `createDocument('schematic', name)` — 1페이지 기본 생성
  - `loadDocument('schematic', filePath, data)` — manifest + 페이지 파일 로드
  - `updateSchematicData(docId, updater)` — Immer updater 패턴

#### 2. 페이지 관리
- 페이지 추가 (빈 페이지 또는 템플릿 기반)
- 페이지 삭제 (최소 1페이지 유지, 마지막 페이지 삭제 불가)
- 페이지 이름/설명 편집
- 페이지 순서 변경 (드래그 앤 드롭)
- 페이지 복제

#### 3. 페이지 전환
- 페이지 탭 바를 통한 전환
- 키보드 단축키: `Ctrl+PageUp` (이전), `Ctrl+PageDown` (다음)
- 페이지 전환 시 현재 페이지 circuit 데이터 저장 후 새 페이지 로드

#### 4. Off-Page Connector (크로스-페이지 참조)
- 새 블록 타입 `off_page_connector` 추가
- 속성: 대상 페이지, 대상 커넥터 ID, 라벨
- 배치 시 대상 페이지/커넥터 선택 다이얼로그
- 양방향 참조 자동 생성 (outgoing + incoming)

#### 5. 크로스-레퍼런스 다이얼로그
- 전체 schematic의 크로스-레퍼런스 목록 표시
- 클릭 시 해당 페이지로 이동 및 해당 커넥터 선택
- 필터링: 페이지별, 라벨별

---

## 페이지 전환 라이프사이클 (Page Switch Protocol)

### 6단계 프로토콜

```
[현재 페이지에서 다른 페이지로 전환 시]

1. canvasStore.getState().getCircuitData() → currentCircuit
2. documentRegistry.updateSchematicData(docId, (data) => {
     updatePageCircuit(data.schematic, currentPageId, currentCircuit)
   })
3. documentRegistry.pushHistory(docId) // schematic-level snapshot
4. schematicHelpers.setActivePage(docId, targetPageId)
5. const targetPage = getActivePage(schematic)
6. canvasStore.getState().loadCircuit(targetPage.circuit)
   // loadCircuit()은 내부적으로 history=[], historyIndex=-1로 리셋함
   // 별도의 resetHistory() 호출 불필요
```

### 저장 전 활성 페이지 플러시 (Save Flush)

저장 명령(Ctrl+S) 시 반드시 현재 활성 페이지의 canvasStore 데이터를 schematic으로 플러시해야 합니다:

```
[저장 절차 — 저장 전 필수 단계]

1. canvasStore.getState().getCircuitData() → currentCircuit
2. documentRegistry.updateSchematicData(docId, (data) => {
     updatePageCircuit(data.schematic, data.schematic.activePageId, currentCircuit)
   })
3. 이제 schematic의 모든 페이지 데이터가 최신 상태
4. schematicService.save() 호출
```

이 플러시 단계 없이 저장하면 활성 페이지의 최신 편집 내용이 손실됩니다.

### 에러 처리

| 단계 | 실패 조건 | 복구 방법 |
|------|----------|----------|
| 1 | canvasStore 상태 없음 | 빈 circuit으로 대체 |
| 2 | documentRegistry에 문서 없음 | 전환 중단, 에러 토스트 표시 |
| 4 | 대상 페이지 ID 유효하지 않음 | 전환 중단, 에러 토스트 표시 |
| 5 | 대상 페이지 circuit 데이터 없음 | 빈 circuit으로 로드 |

---

## 시스템 아키텍처

### 타입 확장

```typescript
// src/types/document.ts에 추가

/** Supported document types — 'schematic' 추가 */
export type DocumentType = 'canvas' | 'ladder' | 'scenario' | 'schematic';

/** Schematic document history data */
export interface SchematicHistoryData {
  snapshot: string; // JSON.stringify(MultiPageSchematic)
}

/** Schematic document data */
export interface SchematicDocumentData {
  schematic: MultiPageSchematic;
}

/** Complete schematic document state */
export interface SchematicDocumentState extends DocumentMeta {
  type: 'schematic';
  data: SchematicDocumentData;
  history: HistorySnapshot<SchematicHistoryData>[];
  historyIndex: number;
}

/** Updated discriminated union */
export type DocumentState =
  | CanvasDocumentState
  | LadderDocumentState
  | ScenarioDocumentState
  | SchematicDocumentState;

/** Type guard */
export function isSchematicDocument(doc: DocumentState): doc is SchematicDocumentState {
  return doc.type === 'schematic';
}

/** Factory function */
export function createEmptySchematicDocument(
  name: string = 'Untitled Schematic',
  filePath: string | null = null
): SchematicDocumentState {
  const schematic = createMultiPageSchematic(name);
  return {
    ...createDocumentMeta('schematic', name, filePath),
    type: 'schematic',
    data: { schematic },
    history: [],
    historyIndex: -1,
  };
}
```

### documentRegistry 확장

```typescript
// src/stores/documentRegistry.ts에 추가할 메서드

/** Update schematic document data */
updateSchematicData: (
  documentId: string,
  updater: (data: SchematicDocumentData) => void
) => void;

/** Get schematic data for saving */
getSchematicData: (documentId: string) => MultiPageSchematic | null;
```

### 블록 타입 확장

```typescript
// src/components/OneCanvas/types.ts — BlockType에 추가
export type BlockType =
  | ... // 기존 타입들
  | 'off_page_connector';

// src/components/OneCanvas/types.ts — Off-Page Connector 블록 인터페이스
/** Off-Page Connector direction */
export type OffPageDirection = 'outgoing' | 'incoming';

/** Off-Page Connector block - cross-page electrical connection point */
export interface OffPageConnectorBlock extends BaseBlock<'off_page_connector'> {
  /** Target page ID (empty string if not yet linked) */
  targetPageId: string;
  /** Target page number (0 if not yet linked) */
  targetPageNumber: number;
  /** Corresponding connector block ID on target page */
  targetConnectorId: string;
  /** Display label (e.g., "/2.K1") */
  label: string;
  /** Direction: outgoing = this page → target, incoming = target → this page */
  direction: OffPageDirection;
}

// Block discriminated union에 추가:
export type Block =
  | ... // 기존 타입들
  | OffPageConnectorBlock;

// isValidBlockType()에 'off_page_connector' 추가 필요

// src/components/OneCanvas/blockDefinitions.ts — 블록 정의 추가
{
  type: 'off_page_connector',
  category: 'connectivity',
  label: 'Off-Page Connector',
  description: '다른 페이지와의 연결점',
  size: { width: 60, height: 40 },
  ports: [
    { id: 'in', position: 'left', type: 'input' },
    { id: 'out', position: 'right', type: 'output' },
  ],
  defaultProps: {
    targetPageId: '',
    targetPageNumber: 0,
    targetConnectorId: '',
    label: '',
    direction: 'outgoing',
  },
}
```

### 컴포넌트 트리

```
src/components/OneCanvas/
├── components/
│   ├── SchematicPageBar.tsx        # 페이지 탭 바 (추가/삭제/전환)
│   ├── SchematicPageTab.tsx        # 개별 페이지 탭
│   ├── CrossReferenceDialog.tsx    # 크로스-레퍼런스 목록 다이얼로그
│   └── blocks/
│       └── OffPageConnectorBlock.tsx  # Off-Page Connector 블록 렌더러
├── utils/
│   ├── multiPageSchematic.ts       # 기존 데이터 모델 (변경 없음)
│   └── schematicHelpers.ts         # documentRegistry 래핑 함수 모듈
```

### Rust Backend 확장

```rust
// src-tauri/src/commands/schematic.rs

#[tauri::command]
pub async fn schematic_save(
    path: String,
    manifest: String,     // YAML manifest content
    pages: Vec<PageData>, // { filename: String, content: String }
) -> Result<(), String>;

#[tauri::command]
pub async fn schematic_load(
    path: String,
) -> Result<SchematicLoadResult, String>;
// Returns: { manifest: String, pages: Vec<{ filename: String, content: String }> }
```

---

## In-Memory ↔ On-Disk 매핑 (Data Mapping)

### Manifest 매핑 테이블 (MultiPageSchematic → manifest.yaml)

| In-Memory (TypeScript) | On-Disk Key | 변환 | 비고 |
|----------------------|------------|------|------|
| `MultiPageSchematic.id` | `id` | 그대로 | `sch_` prefix UUID |
| `MultiPageSchematic.name` | `name` | 그대로 | |
| `MultiPageSchematic.description` | `description` | 그대로 | |
| `MultiPageSchematic.version` | `version` | 그대로 | |
| `MultiPageSchematic.activePageId` | `active_page_id` | camelCase→snake_case | |
| `MultiPageSchematic.metadata` | `metadata` | CircuitMetadata 그대로 | name, description, tags, author |
| `MultiPageSchematic.metadata.createdAt` | `metadata.created` | key 변환 | 기존 circuitToYaml 형식 따름 |
| `MultiPageSchematic.metadata.modifiedAt` | `metadata.modified` | key 변환 | 기존 circuitToYaml 형식 따름 |
| `MultiPageSchematic.createdAt` | `created_at` | camelCase→snake_case | ISO 8601 string |
| `MultiPageSchematic.updatedAt` | `updated_at` | camelCase→snake_case | ISO 8601 string |
| `MultiPageSchematic.globalNets` | `global_nets` | camelCase→snake_case | optional, 없으면 생략 |
| `MultiPageSchematic.pages` | `pages` (index only) | 파일 참조 목록 | 실제 데이터는 개별 파일 |

### Page 매핑 테이블 (SchematicPage → page_{n}.yaml)

| In-Memory (TypeScript) | On-Disk Key | 변환 | 비고 |
|----------------------|------------|------|------|
| `SchematicPage.id` | `page_id` | camelCase→snake_case | `page_` prefix UUID |
| `SchematicPage.number` | `page_number` | 그대로 | 1-indexed |
| `SchematicPage.name` | `page_name` | 그대로 | |
| `SchematicPage.description` | `description` | 그대로 | |
| `SchematicPage.pageSize` | `page_size` | camelCase→snake_case | 'A4'\|'A3'\|'Letter'\|'Legal'\|'Custom' |
| `SchematicPage.orientation` | `orientation` | 그대로 | 'portrait'\|'landscape' |
| `SchematicPage.customSize` | `custom_size` | camelCase→snake_case | optional, Custom일 때만 |
| `SchematicPage.references` | `references` | 개별 필드 snake_case | 배열, 아래 참조 |
| `SchematicPage.createdAt` | `created_at` | camelCase→snake_case | ISO 8601 string |
| `SchematicPage.updatedAt` | `updated_at` | camelCase→snake_case | ISO 8601 string |
| `SchematicPage.metadata` | `page_metadata` | key 변환 | optional Record, page-specific |
| `SchematicPage.circuit` | (circuit section) | **schematic 전용 직렬화** | 아래 §페이지 Circuit 직렬화 참조 |

### PageReference 매핑 (references[] 내 각 항목)

| In-Memory | On-Disk Key | 비고 |
|-----------|------------|------|
| `pageId` | `page_id` | 대상 페이지 ID |
| `pageNumber` | `page_number` | |
| `pageName` | `page_name` | |
| `type` | `type` | 'outgoing'\|'incoming' |
| `localId` | `local_id` | 이 페이지의 커넥터 블록 ID |
| `remoteId` | `remote_id` | 대상 페이지의 커넥터 블록 ID |
| `label` | `label` | "/{pageNumber}.{id}" |

### 페이지 Circuit 직렬화 (AD-7)

**결정**: 페이지의 circuit 데이터는 기존 `circuitToYaml()` / `yamlToCircuit()`를 재사용합니다.

**중요 제약사항**:
- 기존 `circuitToYaml()`는 **junction을 직렬화하지 않습니다** (junction 연결 와이어는 null로 필터됨)
- 기존 `yamlToCircuit()`는 항상 `junctions: new Map()`으로 빈 Map을 반환합니다
- 이는 기존 단일 캔버스 문서의 동작과 동일하며, junction 직렬화는 별도 Unit에서 처리합니다

**구현**: `schematicService.ts`에서 페이지 직렬화 시:
```typescript
// 페이지 저장: SchematicPage.circuit → YAML string
function serializePageCircuit(circuit: SerializableCircuitState): string {
  // SerializableCircuitState → CircuitState 변환 후 기존 circuitToYaml() 사용
  const circuitState = deserializeToCircuitState(circuit);
  return circuitToYaml(circuitState);
}

// 페이지 로드: YAML string → SerializableCircuitState
function deserializePageCircuit(yamlStr: string): SerializableCircuitState {
  const circuitState = yamlToCircuit(yamlStr);
  return circuitStateToSerializable(circuitState);
}
```

**페이지 YAML 파일 구조**: 페이지 메타데이터 헤더 + circuit YAML 본문
```yaml
# === Page Header (schematic-specific) ===
page_id: "page_xxx"
page_name: "Power Supply"
page_number: 1
page_size: "A4"
orientation: "landscape"
description: "..."
created_at: "2026-02-07T00:00:00Z"
updated_at: "2026-02-07T00:00:00Z"
references:
  - page_id: "page_yyy"
    page_number: 2
    page_name: "Motor Control"
    type: "outgoing"
    local_id: "opc_001"
    remote_id: "opc_010"
    label: "/2.opc_010"
# === Circuit Body (circuitToYaml() format) ===
circuit:
  version: '1.1'
  metadata:
    name: "Power Supply"
    description: ""
    tags: []
    created: "2026-02-07T00:00:00Z"
    modified: "2026-02-07T00:00:00Z"
  components:
    - id: "block-1"
      type: "powersource"
      position: { x: 100, y: 50 }
      label: "24V Supply"
      properties:
        voltage: 24
        polarity: "positive"
      ports:
        - id: "pos"
          type: "output"
          label: "+"
          position: "right"
  wires:
    - id: "wire-1"
      from: { component: "block-1", port: "pos" }
      to: { component: "block-2", port: "anode" }
```

**핵심**: `circuit:` 키 아래의 내용은 기존 `circuitToYaml()` 출력과 **100% 동일**합니다. 별도 직렬화 로직을 만들지 않습니다.

### manifest.yaml 예시

```yaml
id: "sch_1234567890_abcdefghi"
name: "Main Power Distribution"
description: "Power schematic for production line"
version: "1.0"
active_page_id: "page_1234567890_abcdef"
page_count: 3
pages:
  - file: "page_1.yaml"
    id: "page_1234567890_abcdef"
    number: 1
    name: "Power Supply"
  - file: "page_2.yaml"
    id: "page_1234567891_bcdefg"
    number: 2
    name: "Motor Control"
  - file: "page_3.yaml"
    id: "page_1234567892_cdefgh"
    number: 3
    name: "I/O Panel"
metadata:
  name: "Main Power Distribution"
  description: ""
  tags: ["power", "production"]
  author: "Engineer A"
  created: "2026-02-07T00:00:00Z"     # circuitToYaml 형식 따름 (created, 非 created_at)
  modified: "2026-02-07T12:00:00Z"     # circuitToYaml 형식 따름 (modified, 非 modified_at)
created_at: "2026-02-07T00:00:00Z"
updated_at: "2026-02-07T12:00:00Z"
```

### page_{n}.yaml 예시

위 §페이지 Circuit 직렬화 (AD-7) 섹션의 "페이지 YAML 파일 구조" 참조.
핵심: 페이지 헤더(page_id, references 등) + `circuit:` 키 아래에 기존 `circuitToYaml()` 출력을 그대로 삽입합니다.

---

## 저장 원자성 (Save Atomicity)

### 전략: Temp Directory → Rename

```
[저장 절차]

1. 임시 디렉토리 생성: `schematics/.tmp_{name}_{timestamp}/` (base의 형제 디렉토리)
   주의: base 내부가 아닌 형제(sibling) 경로에 생성해야 함.
   base 내부에 생성하면 step 4a에서 base를 rename할 때 tmp도 함께 이동됨.
2. manifest.yaml 쓰기 → `.tmp_{name}_{timestamp}/manifest.yaml`
3. 각 페이지 파일 쓰기 → `.tmp_{name}_{timestamp}/page_{n}.yaml`
4. 모든 파일 성공 시:
   a. 기존 디렉토리 백업 → `schematics/.backup_{name}/`
   b. `.tmp_{name}_{timestamp}/` → `schematics/{name}/` 으로 rename
   c. `.backup_{name}/` 삭제
5. 실패 시:
   a. `.tmp_{name}_{timestamp}/` 디렉토리 삭제 (cleanup)
   b. 기존 파일은 그대로 유지 → 데이터 무결성 보장
```

### Rust 구현 개요

```rust
pub async fn schematic_save(path: String, manifest: String, pages: Vec<PageData>) -> Result<(), String> {
    let base = Path::new(&path);
    let parent = base.parent().ok_or("Invalid schematic path: no parent directory")?;
    let name = base.file_name().ok_or("Invalid schematic path: no directory name")?;
    let tmp_dir = parent.join(format!(
        ".tmp_{}_{}", name.to_string_lossy(), chrono::Utc::now().timestamp_millis()
    ));

    // 1. Write to temp (sibling of base, NOT inside base)
    fs::create_dir_all(&tmp_dir).map_err(|e| e.to_string())?;
    fs::write(tmp_dir.join("manifest.yaml"), &manifest).map_err(|e| e.to_string())?;
    for page in &pages {
        fs::write(tmp_dir.join(&page.filename), &page.content).map_err(|e| e.to_string())?;
    }

    // 2. Atomic swap
    let backup_dir = parent.join(format!(".backup_{}", name.to_string_lossy()));
    if base.exists() {
        fs::rename(&base, &backup_dir).map_err(|e| e.to_string())?;
    }
    fs::rename(&tmp_dir, &base).map_err(|e| e.to_string())?;
    if backup_dir.exists() {
        let _ = fs::remove_dir_all(&backup_dir);
    }

    Ok(())
}
```

---

## UI/UX 명세

### 페이지 탭 바 (SchematicPageBar)

```
┌──────────────────────────────────────────────────────────────────────┐
│ [Page 1: Power Supply] [Page 2: Motor Ctrl] [Page 3: I/O] [＋]     │
│ ──────────────────────  ─────────────────── ───────────── ────      │
│ (active, bold)          (normal)            (normal)      (add btn) │
└──────────────────────────────────────────────────────────────────────┘
```

- 위치: 캔버스 영역 하단
- 활성 페이지: 볼드 텍스트 + 하단 하이라이트 바
- 우클릭: 컨텍스트 메뉴 (이름 변경, 삭제, 복제, 순서 변경)
- 드래그: 탭 순서 변경
- `[＋]` 버튼: 새 페이지 추가

### Off-Page Connector 블록

```
┌──────────────────┐
│ ● ← /2.K1    → ● │    outgoing 방향
└──────────────────┘
     label text

┌──────────────────┐
│ ● ← /1.K1    → ● │    incoming 방향
└──────────────────┘
     label text
```

- 오각형 또는 화살표 형태 (IEC 표준 참조)
- 라벨: `/{pageNumber}.{componentId}` 형식
- 더블 클릭: 대상 페이지로 이동
- "dangling" 상태 (대응 커넥터 없음): 빨간 테두리

### 크로스-레퍼런스 다이얼로그 (CrossReferenceDialog)

```
┌─────────────────────────────────────────────────┐
│  Cross References                    [×]         │
│─────────────────────────────────────────────────│
│  Filter: [__________] Page: [All ▼]             │
│─────────────────────────────────────────────────│
│  From          To            Label              │
│  Page 1 (K1)  → Page 2 (K1)  /2.K1            │
│  Page 2 (M1)  → Page 3 (M1)  /3.M1            │
│  Page 3 (P1)  → Page 1 (P1)  /1.P1            │
│─────────────────────────────────────────────────│
│  [Close]                                        │
└─────────────────────────────────────────────────┘
```

- 행 클릭: 해당 페이지로 이동 + 해당 커넥터 선택
- Command Palette에서도 접근 가능: "Show Cross References"

---

## 파일 구조

```
src/
├── components/
│   └── OneCanvas/
│       ├── components/
│       │   ├── SchematicPageBar.tsx        # 신규
│       │   ├── SchematicPageTab.tsx        # 신규
│       │   ├── CrossReferenceDialog.tsx    # 신규
│       │   └── blocks/
│       │       └── OffPageConnectorBlock.tsx  # 신규
│       └── utils/
│           ├── multiPageSchematic.ts       # 기존 (변경 없음)
│           └── schematicHelpers.ts         # 신규
├── types/
│   └── document.ts                        # 확장 (SchematicDocumentState 추가)
├── stores/
│   └── documentRegistry.ts                # 확장 (schematic 메서드 추가)
└── services/
    └── schematicService.ts                # 신규 (Tauri 명령 래퍼)

src-tauri/src/
├── commands/
│   ├── mod.rs                             # schematic 모듈 추가
│   └── schematic.rs                       # 신규
└── lib.rs                                 # 명령어 등록
```

---

## 의존성

- **Unit 5 (OneCanvas)**: 캔버스 렌더링, 블록 시스템, canvasStore
- **Unit 2 (UI Layout)**: 탭 시스템, documentRegistry
- **Unit 10 (Missing Features)**: 기존 blockDefinitions, 직렬화 유틸리티

## 차단 항목
- 없음 (독립적으로 구현 가능, 기존 코드 기반 활용)

---

## 구현 우선순위

1. **Phase 1**: 타입 시스템 확장 (`document.ts` + `documentRegistry.ts`)
2. **Phase 2**: `schematicHelpers.ts` + `schematicService.ts` 구현
3. **Phase 3**: Rust Backend (`schematic.rs` 저장/로드 명령)
4. **Phase 4**: `off_page_connector` 블록 + `OffPageConnectorBlock.tsx`
5. **Phase 5**: `SchematicPageBar.tsx` + `SchematicPageTab.tsx` (페이지 탭 UI)
6. **Phase 6**: `CrossReferenceDialog.tsx` + Command Palette 통합
7. **Phase 7**: 페이지 전환 라이프사이클 통합 + 저장 원자성
8. **Phase 8**: 테스트 + Edge Case 처리

---

## 검증 기준 (Acceptance Criteria)

### AC-1: Schematic 문서 생성 및 로드

**Given**: 사용자가 새 Schematic 문서를 생성
**When**: `documentRegistry.createDocument('schematic', 'Test')` 호출
**Then**:
- `documents` Map에 `SchematicDocumentState` 추가됨
- `data.schematic.pages.length === 1` (기본 1페이지)
- `data.schematic.activePageId === pages[0].id`
- `status === 'loaded'`

### AC-2: 페이지 추가 및 삭제

**Given**: 3페이지 Schematic 문서
**When**: 페이지 추가 버튼 클릭
**Then**:
- `pages.length === 4`
- 새 페이지 번호 === 4
- 탭 바에 4번째 탭 표시

**When**: 2번 페이지 삭제 (우클릭 → 삭제)
**Then**:
- `pages.length === 3`
- 남은 페이지 번호 자동 재정렬 (1, 2, 3)
- 2번 페이지를 참조하던 PageReference 모두 삭제
- 삭제된 페이지가 활성 페이지였으면 인접 페이지로 전환

### AC-3: 페이지 전환

**Given**: 사용자가 Page 1에서 작업 중
**When**: Page 2 탭 클릭
**Then**:
- Page 1의 circuit 데이터가 schematic에 저장됨
- canvasStore에 Page 2의 circuit 데이터 로드됨
- canvasStore 히스토리 리셋됨
- 활성 탭이 Page 2로 변경됨

### AC-4: Off-Page Connector 양방향 참조

**Given**: Page 1에 Off-Page Connector 배치, 대상 = Page 2
**When**: 커넥터 생성 완료
**Then**:
- Page 1에 `outgoing` PageReference 추가 (`localId` = 커넥터 블록 ID)
- Page 2에 `incoming` PageReference 추가 (`remoteId` = Page 1 커넥터 블록 ID)
- Page 2에 대응 Off-Page Connector 블록 자동 생성

**When**: Page 1의 Off-Page Connector 삭제
**Then**:
- Page 1의 outgoing reference 삭제
- Page 2의 incoming reference 삭제
- Page 2의 대응 커넥터는 유지하되 "dangling" 상태 (빨간 테두리)

### AC-5: 저장/로드 왕복 (Round-Trip)

**Given**: 3페이지, 2개 크로스-레퍼런스가 있는 Schematic
**When**: 저장 → 앱 종료 → 다시 열기
**Then**:
- 모든 페이지 데이터 보존 (컴포넌트, 와이어 — junction은 현재 직렬화 미지원이므로 제외)
- 크로스-레퍼런스 보존 (양방향 참조 일치)
- 활성 페이지 복원
- 페이지 순서 보존

### AC-6: 저장 원자성

**Given**: 저장 중 3번째 페이지 파일 쓰기에서 에러 발생
**When**: 에러 catch
**Then**:
- 임시 디렉토리 정리 (cleanup)
- 기존 파일 무결성 유지 (이전 버전 그대로)
- 사용자에게 에러 메시지 표시
- 재저장 가능한 상태 유지

---

## 위험 요소 및 대응

| 위험 | 영향 | 대응 |
|------|------|------|
| canvasStore와 schematic 간 데이터 동기화 | 페이지 전환 시 데이터 유실 | 6단계 프로토콜 엄격 준수, 전환/저장 전 반드시 flush |
| Off-Page Connector 삭제 시 참조 불일치 | Dangling reference | AD-6 삭제 정책 준수, dangling 상태 시각적 표시 |
| 대량 페이지 (50+) 시 메모리 부담 | 성능 저하 | AD-2 결정대로 현재는 eager loading, 추후 lazy loading Unit 분리 |
| .mop 아카이브 내 파일 경로 충돌 | 저장 실패 | AD-4 경로 규칙 엄격 준수, 이름 유효성 검증 |
| 저장 중 앱 크래시 | 파일 손상 | 저장 원자성 보장 (temp → rename) |

---

## MUST NOT Do (구현 시 주의사항)

- `schematicStore`라는 별도 Zustand 스토어를 만들지 마세요 (AD-1)
- `multiPageSchematic.ts`를 삭제하거나 대폭 수정하지 마세요 (기존 데이터 모델 유지)
- `one_canvas/` 경로를 schematic 파일에 사용하지 마세요 (AD-4)
- Lazy page loading을 구현하지 마세요 (AD-2)
- 기존 `canvas`, `ladder`, `scenario` DocumentType의 동작을 변경하지 마세요
- ERC/전기적 연결 검증을 이 Unit에서 구현하지 마세요 (AD-5, Unit 15)
- `as any`, `@ts-ignore`, `@ts-expect-error` 타입 억제를 사용하지 마세요
