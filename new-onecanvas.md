# onecanvas 개선구현 계획

## 1. 기술 스택 및 아키텍처 선정 (Technology Stack)

데스크톱 툴(KiCad 등)의 정밀함과 웹의 반응성을 모두 잡기 위해 다음 스택을 권장합니다.

| 구분 | 추천 기술 | 선정 이유 |
| --- | --- | --- |
| **렌더링 엔진** | **React-Konva (Canvas)** | 수천 개의 부품/와이어를 끊김 없이 렌더링하기 위해 필수. SVG는 객체가 많아지면(1,000+) DOM 조작 비용으로 느려짐. |
| **상태 관리** | **Zustand + Immer** | Redux보다 가볍고, 불변성(Immutability) 관리가 쉬워 실행 취소(Undo/Redo) 구현에 유리함. |
| **공간 인덱싱** | **RBush (R-Tree)** | 마우스 클릭/드래그 시 수천 개의 객체 중 대상을 즉시 찾기 위해 필수 (O(log n) 검색). |
| **상태 머신** | **XState** (또는 단순 Reducer) | '배선 중', '부품 배치 중', '영역 선택 중' 등 복잡한 모드 전환을 명확히 제어. |

---

## 2. 핵심 기능별 구현 상세 (Implementation Details)

### 2.1 좌표계 및 그리드 스냅 (Grid System)

EDA 툴은 픽셀이 아닌 물리적 단위(mm/mil)를 사용해야 합니다.

* **좌표 변환:** `Screen(픽셀)` ↔ `World(물리 좌표)` 변환 함수를 작성합니다.
* 줌/팬 기능은 Canvas의 `Scale`과 `Offset` 속성만 변경하여 구현합니다.


* **그리드 스냅 (Snapping):** 모든 좌표 입력(마우스 이동)은 로직 처리에 앞서 스냅 함수를 거쳐야 합니다.
```javascript
const GRID_SIZE = 10; // 10px or 10mil
const snapToGrid = (val) => Math.round(val / GRID_SIZE) * GRID_SIZE;

// 마우스 이벤트 핸들러 예시
const handleMouseMove = (e) => {
  const worldPos = toWorld(e.evt.layerX, e.evt.layerY);
  const snappedPos = { x: snapToGrid(worldPos.x), y: snapToGrid(worldPos.y) };
  // 이후 로직은 snappedPos 사용
};

```



### 2.2 심볼 배치 및 관리 (Symbol Placement)

* **상태 관리:** `currentMode`가 `PLACING`일 때, 마우스 커서에 '유령(Ghost) 심볼'을 따라다니게 합니다.
* **회전(Rotation):** 'R' 키 입력 시 90도 단위로 회전 행렬을 적용합니다.
* ⚠️ **중요:** 회전 시 심볼의 **중심이 아닌 1번 핀(또는 기준점)**을 축으로 회전해야 그리드에서 벗어나지 않습니다.


* **데이터 구조:**
```typescript
interface SymbolInstance {
  id: string;
  libId: string; // 라이브러리 심볼 참조
  x: number;
  y: number;
  rotation: 0 | 90 | 180 | 270;
  pins: { [pinId: string]: { netId: string | null } }; // 연결 정보
}

```



### 2.3 배선 및 직교 라우팅 (Wiring & Orthogonal Routing)

사용자가 핀을 클릭하여 선을 그릴 때, 대각선이 아닌 직각(Manhattan) 경로를 유지해야 합니다.

* **라우팅 로직:**
1. **시작:** 핀 클릭 시 `WIRING` 모드 진입, 시작점 고정.
2. **이동:** 마우스 위치(Target)에 따라 중간 꺾임점(Corner)을 실시간 계산.
* *단순 방식:* X축 우선 이동 후 Y축 이동 (ㄱ자 형태).


3. **종료:** 다른 핀이나 와이어 위에서 클릭 시 배선 종료 및 데이터 커밋.


* **연결성 처리 (Connectivity):**
* **좌표 일치(Coincidence):** 와이어의 끝점 좌표가 핀의 좌표와 정확히 일치(`===`)하면 연결된 것으로 간주합니다.
* **Net 병합:** 두 개의 서로 다른 Net이 와이어로 연결되면, `Union-Find` 알고리즘을 사용하여 두 Net ID를 하나로 통합합니다.



### 2.4 다중 선택 및 이동 (Multi-Select & Move)

성능 최적화가 가장 필요한 부분입니다. React 상태 업데이트를 최소화해야 합니다.

* **선택 (Rubberband):**
* 배경 드래그 시 사각형(Box)을 그립니다.
* `MouseUp` 시점에 **RBush(공간 인덱스)**를 조회하여 박스 안에 포함된 모든 객체 ID를 가져옵니다.


* **이동 (Dragging):**
* **Transient Update (일시적 업데이트):** 드래그 중에는 React 상태(`setState`)를 호출하지 않습니다. 대신 **Konva Node의 속성(x, y)만 직접 수정**하여 60FPS를 유지합니다.
* **Commit:** 드래그가 끝나는 순간(`MouseUp`), 변경된 좌표를 한 번에 React Store에 업데이트합니다.



### 2.5 넷리스트(Netlist) 추출

화면에 그려진 그림을 실제 회로 데이터로 변환하는 과정입니다.

* **실시간 vs 후처리:** 웹 환경에서는 성능을 위해 **후처리 방식**을 권장합니다.
* **알고리즘:**
1. 모든 핀과 와이어를 노드(Node)로 간주하는 그래프 생성.
2. 좌표가 겹치는 노드끼리 간선(Edge) 연결.
3. 그래프 탐색(BFS/DFS)을 통해 연결된 덩어리(Connected Component)를 찾아 각각의 `Net`으로 정의.



---

## 3. 단계별 개발 로드맵

### Phase 1: 캔버스 엔진 구축 (기반 공사)

1. `react-konva` 세팅 및 무한 줌/팬(Zoom/Pan) 기능 구현.
2. 그리드(Grid) 렌더링 (줌 레벨에 따라 간격 자동 조정).
3. 좌표 변환 유틸리티 (`screenToWorld`, `snapToGrid`) 작성.

### Phase 2: 기본 편집 기능 (MVP)

1. **심볼 배치:** 더미 JSON 데이터를 이용해 심볼을 그리드에 맞춰 배치.
2. **와이어링:** 핀과 핀을 잇는 단순 직선(Line) 그리기.
3. **선택 및 삭제:** 클릭하여 선택(Highlight), Delete 키로 삭제.

### Phase 3: EDA 핵심 로직 (심화)

1. **직교 라우팅:** 와이어가 90도로 꺾이도록 알고리즘 개선.
2. **공간 인덱싱(RBush):** 수천 개 객체 생성 시 렉을 방지하기 위해 히트 테스팅 최적화.
3. **다중 이동:** 선택된 그룹을 드래그할 때 `Transient Update` 패턴 적용.

### Phase 4: 데이터 무결성

1. **Undo/Redo:** `zundo` 또는 `immer` 패치를 이용한 실행 취소 구현.
2. **Netlist Export:** 현재 상태를 파싱하여 `JSON` 형태의 넷리스트로 추출하는 기능.

## 4. React 컴포넌트 구조 예시

```jsx
// App.js
const SchematicEditor = () => {
  const stageRef = useRef();
  const { mode, setMode } = useStore(); // Zustand Store

  // 이벤트 핸들러: 모드에 따라 동작 분기 (State Machine 패턴)
  const handleMouseDown = (e) => {
    if (mode === 'IDLE') handleSelectStart(e);
    if (mode === 'WIRING') handleWireStart(e);
  };

  return (
    <Stage 
      onMouseDown={handleMouseDown} 
      onMouseMove={handleMouseMove} 
      onMouseUp={handleMouseUp}
    >
      <Layer>
        <Grid /> {/* 배경 그리드 */}
        <Wires /> {/* 배선 레이어 */}
        <Symbols /> {/* 부품 심볼 레이어 */}
        <SelectionOverlay /> {/* 선택 박스 및 하이라이트 */}
      </Layer>
    </Stage>
  );
};