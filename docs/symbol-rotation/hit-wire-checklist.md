# 회전 2차: 히트영역 회전 + 포트/와이어 연결성

회전된 심볼의 클릭/선택 영역, 포트 위치, 연결 와이어가 모두 회전을 따르게 한다.
와이어 연결성 유지/끊기를 설정으로 노출(기본=유지). 4×90° 회전 시 초기 상태와 동일함을 검증.

## 핵심 설계
- **단일 회전 헬퍼**: `rotatePointAroundOrigin(p, deg)` (90/180/270 정확값 + 일반각 trig).
  렌더러와 동일한 변환(0,0 원점, Pixi CW). 4×90°→rotation 0으로 정규화되어 동일성 보장.
- **포트 월드 좌표 단일화**: `getPortWorldPosition(block, port)` = block.position +
  rotate(localOffset, rotation). localOffset = `port.absolutePosition ?? edge기반`.
  모든 소비처(스파셜인덱스/히트테스트/포트렌더/와이어경로)가 이걸 쓰게 통일.
- **OBB 히트테스트**: 클릭점을 블록 로컬좌표로 역회전 후 [0,w]×[0,h] 검사. 브로드페이즈
  AABB는 회전된 4모서리를 감싸도록.

## 작업
- [ ] `utils/rotationGeometry.ts` (신규): rotatePointAroundOrigin, getRotatedBlockCorners,
      getRotatedBlockAABB, isPointInRotatedBlock + 테스트
- [ ] `utils/wirePathCalculator.ts`: getPortLocalOffset/getPortWorldPosition,
      getPortAbsolutePosition 회전 반영
- [ ] `utils/canvasHelpers.ts`: resolveEndpoint(pos=회전, dir=rotatePortPosition),
      detectPortAtPosition 회전 반영
- [ ] `core/SpatialIndex.ts`: 블록 AABB=회전 모서리, 포트=getPortWorldPosition (rebuild+updateBlock)
- [ ] `core/HitTester.ts`: _testBlocks OBB, _resolveEndpoint 회전 포트
- [ ] `renderers/PortRenderer.ts`: 포트 위치 getPortWorldPosition
- [ ] `renderers/SelectionRenderer.ts`: 선택 박스/핸들 회전(모서리 폴리곤)

## 와이어 연결성 정책 (설정)
- [ ] settings: `symbolRotationKeepConnections: boolean` 기본 true (TS+Rust+CanvasSettings UI)
- [ ] `utils/canvas-commands.ts`: `rotateAndUpdateWires(components, wires, junctions, sel, deg, keep)`
      순수 함수 — keep시 연결 와이어 recalc, break시 포트 끝점을 회전前 위치의 floating으로 분리
- [ ] `stores/canvasStore.ts`: rotateSelectedComponents/rotateComponent가 와이어 정책 적용
- [ ] `hooks/useCanvasFacade.ts`: rotateDocumentSelected가 docData.wires까지 갱신(canvas/schematic)

## 검증
- [ ] 단위테스트: 포트 월드좌표 4×90° 동일성, 와이어 끝점 resolve 4×90° 동일성
- [ ] 단위테스트: isPointInRotatedBlock(90° 회전 블록 클릭)
- [ ] 단위테스트: keep시 연결 유지 / break시 floating 분리
- [ ] `pnpm tsc` + 관련 vitest 통과

## 메모
- 라벨/지정자는 계속 upright 유지(회전 안 함) — 사용자 요구 범위 밖.
- 와이어 경로 포트 좌표를 absolutePosition 우선으로 통일 → 커스텀 심볼에서 포트-와이어
  접점 정합성도 개선(부수 효과, 표준 블록은 변화 없음).
