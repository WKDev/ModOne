# 좌표계 디버깅 가이드

## 현재 상황

좌표 변환 시스템을 다음과 같이 리팩토링했습니다:

1. ✅ **수학적 정확성 검증 완료**
   - `coordinate-system-integration.test.ts`: 9개 테스트 모두 통과
   - CSS transform과 좌표 변환 공식이 정확히 일치함을 확인
   - 다양한 zoom/pan 조합에서 왕복 변환(round-trip) 검증

2. ✅ **통일된 좌표 변환 시스템**
   - 모든 드래그 핸들러가 `screenToCanvas()` 유틸리티 사용
   - 델타 기반 → 절대 좌표 기반으로 전환
   - getBoundingClientRect 캐싱으로 성능 최적화

3. ✅ **빌드 성공**
   - TypeScript 에러 없음
   - 모든 테스트 통과

## 좌표 변환 공식 요약

```typescript
// 화면 → 캔버스
screenToCanvas(screenPos, pan, zoom) = {
  x: (screenPos.x - pan.x) / zoom,
  y: (screenPos.y - pan.y) / zoom
}

// 캔버스 → 화면
canvasToScreen(canvasPos, pan, zoom) = {
  x: canvasPos.x * zoom + pan.x,
  y: canvasPos.y * zoom + pan.y
}

// CSS Transform (Canvas.tsx:82)
transform: translate(${pan.x}px, ${pan.y}px) scale(${zoom})
```

이 공식들은 수학적으로 완벽하게 대응됩니다.

## 디버깅 도구 사용법

### 1. CoordinateDebugger 활성화

`OneCanvasPanel.tsx`에 다음을 추가:

```typescript
import { CoordinateDebugger } from '../../OneCanvas';

// Canvas 컴포넌트 안에 추가
<Canvas ...>
  {/* 기존 children */}
  <CoordinateDebugger canvasRef={canvasRef} />
</Canvas>
```

화면 우측 상단에 실시간 좌표 정보가 표시됩니다:
- **Pan**: 현재 pan 값
- **Zoom**: 현재 zoom 레벨
- **Mouse Screen**: 컨테이너 기준 마우스 위치
- **Mouse Canvas**: 캔버스 좌표계 마우스 위치
- **Last Click**: 마지막 클릭 위치 (screen & canvas)

### 2. 테스트 시나리오

다음 순서로 테스트하며 증상을 확인하세요:

#### A. 기본 상태 테스트 (zoom=1, pan=(0,0))

1. 앱 시작
2. CoordinateDebugger 확인 - Zoom: 1.000, Pan: 0, 0 이어야 함
3. 블록을 클릭했을 때:
   - 블록이 선택되는가?
   - Mouse Canvas 좌표와 블록 위치가 일치하는가?
4. 블록을 드래그했을 때:
   - 커서가 블록을 정확히 따라가는가?
   - 드롭 후 Mouse Canvas 좌표 = 새 블록 위치인가?

#### B. Zoom 테스트

1. Ctrl+휠로 zoom in (예: 2.0x)
2. CoordinateDebugger에서 Zoom 값 확인
3. 블록 위에 마우스를 올렸을 때:
   - Mouse Screen 좌표는 화면 픽셀 위치
   - Mouse Canvas 좌표가 블록의 실제 캔버스 위치와 일치하는가?
4. 블록 클릭 → 선택되는가?
5. 블록 드래그 → 커서 따라가는가?

#### C. Pan 테스트

1. Space+드래그로 캔버스 이동
2. CoordinateDebugger에서 Pan 값 변화 확인
3. 블록 클릭/드래그 테스트 반복

#### D. 복합 테스트 (Zoom + Pan)

1. Zoom = 1.5, Pan = (100, 80) 등으로 설정
2. 모든 인터랙션 테스트

### 3. 증상별 체크리스트

문제가 발생한다면 다음을 확인하세요:

#### 증상: 클릭해도 블록이 선택되지 않음

**확인사항:**
- [ ] Mouse Canvas 좌표가 블록 위치 범위 내에 있는가?
- [ ] BlockWrapper의 onClick이 호출되는가? (console.log 추가)
- [ ] 다른 요소(wire, selection box 등)가 이벤트를 가로채는가?

**원인 가능성:**
- 좌표 변환 오류 (Mouse Canvas가 블록 위치와 크게 다름)
- Event propagation 이슈
- z-index 또는 pointer-events 문제

#### 증상: 드래그 시 커서와 블록이 어긋남

**확인사항:**
- [ ] 드래그 시작: Mouse Canvas = 블록 시작 위치
- [ ] 드래그 중: Mouse Canvas 변화량 = 블록 이동량
- [ ] 드래그 종료: Mouse Canvas = 블록 최종 위치
- [ ] containerRectRef.current가 null이 아닌가?
- [ ] zoom/pan이 드래그 중 변경되는가?

**원인 가능성:**
- getBoundingClientRect 캐시가 오래됨 (unlikely - ResizeObserver가 처리)
- 드래그 중 zoom/pan이 변경됨
- startCanvasPos 계산 오류

#### 증상: DnD (Toolbox → Canvas) 시 위치가 틀림

**확인사항:**
- [ ] OneCanvasPanel.tsx:773의 screenToCanvas 호출 확인
- [ ] containerRectRef.current 값이 유효한가?
- [ ] activatorEvent의 clientX/Y가 올바른가?

#### 증상: Wire 클릭이 안됨

**확인사항:**
- [ ] wireHitTest.ts의 getClickPositionOnWire 공식 검증
- [ ] SVG 요소의 getBoundingClientRect와 Container의 rect가 동일한가?

## 코드 수정 이력

### 완료된 리팩토링

1. **useBlockDrag.ts**
   - `startMousePos` → `startCanvasPos` (screen → canvas)
   - 매 프레임 `screenToCanvas()` 호출
   - containerRect 캐싱

2. **useWireHandleDrag.ts**
   - 동일한 패턴 적용
   - pan/zoom을 의존성에 추가

3. **useWireSegmentDrag.ts**
   - 동일한 패턴 적용

4. **OneCanvasPanel.tsx**
   - DnD handler: `screenToCanvas()` 유틸리티 사용
   - `containerRectRef` + ResizeObserver 캐싱
   - handleCanvasMouseDown/Move: 캐시된 rect 사용

### 검증된 부분

- ✅ `canvasCoordinates.ts` 공식 정확성
- ✅ CSS transform 매칭
- ✅ 왕복 변환 (screen ↔ canvas)
- ✅ 다양한 zoom/pan 조합

## 다음 단계

1. **디버거를 활성화하고 실제 앱에서 테스트**
   - 위 시나리오대로 테스트
   - 문제 발생 시 스크린샷 + CoordinateDebugger 값 기록

2. **증상을 구체적으로 기록**
   - "클릭이 안됨" X
   - "Zoom 2.0, Pan (50, 30)에서 블록 (200, 150) 클릭 시 선택 안됨. Mouse Canvas는 (180, 140)으로 표시됨" O

3. **추가 로깅이 필요한 경우**
   - BlockWrapper onClick에 console.log 추가
   - useBlockDrag handleMouseMove에 좌표 로깅

4. **의심스러운 부분 점검**
   - 다른 세션에서 수정된 파일들 (Wire.tsx, BlockWrapper.tsx, useSelectionHandler.ts)
   - 이벤트 전파 체인
   - CSS z-index/pointer-events

## 수학적 검증

모든 좌표 변환이 다음을 만족함을 테스트로 확인:

```typescript
// Identity: f(f⁻¹(x)) = x
screenToCanvas(canvasToScreen(pos, pan, zoom), pan, zoom) ≈ pos
canvasToScreen(screenToCanvas(pos, pan, zoom), pan, zoom) ≈ pos

// CSS transform equivalence
CSS: translate(pan) scale(zoom)
Formula: screen = canvas * zoom + pan
```

문제가 수학적 오류가 아닌, 구현 세부사항에 있을 가능성이 높습니다.
