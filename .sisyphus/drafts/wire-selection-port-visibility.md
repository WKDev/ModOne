# Draft: Wire Selection Visual + Port Always Visible

## Requirements (confirmed)
- **Wire color contrast**: 기본색(0xd0d4da)과 선택색(0x4dabf7)의 대비가 약함 → 더 뚜렷하게
- **Port-connected segment drag**: port에 연결된 wire 선분은 현재 드래그 불가 → 수직 방향 드래그 시 port 쪽에 새 선분 생성 (rubber-band)
- **Port always visible**: 모든 블록의 port circle을 상시 렌더링 (EDA 표준)

## Technical Decisions
- Wire rendering: `WireRenderer.ts` — color constants 조정
- Port visibility: `PortRenderer.ts` — `_showAll` 기본값 변경 + layer visibility 상시 true
- Wire segment drag: `InteractionController.ts` — `wire_segment_dragging` state에서 port-connected segment 처리 로직

## Research Findings
- WireRenderer: `DEFAULT_WIRE_STYLE.color = 0xd0d4da`, `selectedColor = 0x4dabf7`
- PortRenderer: `_showAll = false` by default, `setShowAll()` toggles `_layer.visible`
- InteractionController: has `wire_segment_dragging` state
- WireRenderer already draws different colors for selected/hovered/default
- Port rendering uses shared GraphicsContext per port type (input/output/power/passive/bidirectional)

## Open Questions
- Wire segment dragging rubber-band behavior scope?
- Test strategy?

## Scope Boundaries
- INCLUDE: Wire color enhancement, port always-visible, wire segment drag fix
- EXCLUDE: TBD
