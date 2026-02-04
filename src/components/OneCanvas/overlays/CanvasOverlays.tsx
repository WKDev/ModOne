import type { SelectionBoxState } from './SelectionBox';
import { SelectionBox } from './SelectionBox';
import { SelectionBoundingBox } from './SelectionBoundingBox';
import { WirePreview, type WirePreviewState } from './WirePreview';
import { CoordinateDebugger } from './CoordinateDebugger';
import type { CanvasRef } from '../Canvas';
import type { Block, Wire, Junction } from '../types';

interface CanvasOverlaysProps {
  selectionBox: SelectionBoxState | null;
  debugMode?: boolean;
  canvasRef?: React.RefObject<CanvasRef | null>;

  // SelectionBoundingBox props
  selectedIds?: Set<string>;
  components?: Map<string, Block>;
  wires?: Wire[];
  junctions?: Map<string, Junction>;

  // WirePreview props
  wirePreview?: WirePreviewState | null;
}

/**
 * Canvas Overlays
 *
 * Container/Screen Space UI 오버레이들을 렌더링합니다.
 * OverlayLayer 내부에서 사용됩니다.
 */
export function CanvasOverlays({
  selectionBox,
  debugMode = false,
  canvasRef,
  selectedIds,
  components,
  wires,
  junctions,
  wirePreview,
}: CanvasOverlaysProps) {
  return (
    <>
      {/* SelectionBox (drag-to-select) */}
      {selectionBox && <SelectionBox box={selectionBox} />}

      {/* SelectionBoundingBox (multi-select indicator) */}
      {selectedIds && components && wires && junctions && (
        <SelectionBoundingBox
          selectedIds={selectedIds}
          components={components}
          wires={wires}
          junctions={junctions}
        />
      )}

      {/* WirePreview (wire drawing) */}
      {wirePreview && <WirePreview preview={wirePreview} />}

      {/* Debug Tools */}
      {debugMode && canvasRef && <CoordinateDebugger canvasRef={canvasRef} />}
    </>
  );
}
