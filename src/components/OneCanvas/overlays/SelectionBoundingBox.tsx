/**
 * Selection Bounding Box Component (Overlay Layer)
 *
 * Displays a bounding box around all selected elements (blocks and wires).
 * Renders in Container Space using coordinate transformation from Canvas Space.
 * Shows resize handles at corners and edges for multi-element manipulation.
 */

import { memo, useMemo } from 'react';
import { useCoordinateSystemContext } from '../coordinate-system/CoordinateSystemContext';
import type { Block, Wire, Junction } from '../types';
import { isPortEndpoint, toCanvasPos } from '../types';

// ============================================================================
// Types
// ============================================================================

interface SelectionBoundingBoxProps {
  /** Selected component IDs */
  selectedIds: Set<string>;
  /** All components (Canvas Space) */
  components: Map<string, Block>;
  /** All wires (Canvas Space) */
  wires: Wire[];
  /** All junctions (Canvas Space) */
  junctions: Map<string, Junction>;
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Renders a bounding box around all selected elements in Container Space.
 * Automatically converts Canvas Space coordinates to Container Space.
 */
export const SelectionBoundingBox = memo(function SelectionBoundingBox({
  selectedIds,
  components,
  wires,
  junctions,
}: SelectionBoundingBoxProps) {
  const coordinateSystem = useCoordinateSystemContext();

  // Calculate bounding box in Canvas Space, then convert to Container Space
  const boundingBox = useMemo((): BoundingBox | null => {
    if (selectedIds.size === 0) {
      return null;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    let hasElements = false;

    // Include selected blocks
    selectedIds.forEach((id) => {
      const component = components.get(id);
      if (component) {
        hasElements = true;
        minX = Math.min(minX, component.position.x);
        minY = Math.min(minY, component.position.y);
        maxX = Math.max(maxX, component.position.x + component.size.width);
        maxY = Math.max(maxY, component.position.y + component.size.height);
      }
    });

    // Include selected wires
    const selectedWires = wires.filter((wire) => selectedIds.has(wire.id));
    selectedWires.forEach((wire) => {
      hasElements = true;

      // Get from position
      if (isPortEndpoint(wire.from)) {
        const component = components.get(wire.from.componentId);
        if (component) {
          minX = Math.min(minX, component.position.x);
          minY = Math.min(minY, component.position.y);
          maxX = Math.max(maxX, component.position.x);
          maxY = Math.max(maxY, component.position.y);
        }
      } else {
        const junction = junctions.get(wire.from.junctionId);
        if (junction) {
          minX = Math.min(minX, junction.position.x);
          minY = Math.min(minY, junction.position.y);
          maxX = Math.max(maxX, junction.position.x);
          maxY = Math.max(maxY, junction.position.y);
        }
      }

      // Get to position
      if (isPortEndpoint(wire.to)) {
        const component = components.get(wire.to.componentId);
        if (component) {
          minX = Math.min(minX, component.position.x);
          minY = Math.min(minY, component.position.y);
          maxX = Math.max(maxX, component.position.x);
          maxY = Math.max(maxY, component.position.y);
        }
      } else {
        const junction = junctions.get(wire.to.junctionId);
        if (junction) {
          minX = Math.min(minX, junction.position.x);
          minY = Math.min(minY, junction.position.y);
          maxX = Math.max(maxX, junction.position.x);
          maxY = Math.max(maxY, junction.position.y);
        }
      }

      // Include wire handles
      if (wire.handles) {
        wire.handles.forEach((handle) => {
          minX = Math.min(minX, handle.position.x);
          minY = Math.min(minY, handle.position.y);
          maxX = Math.max(maxX, handle.position.x);
          maxY = Math.max(maxY, handle.position.y);
        });
      }
    });

    if (!hasElements) {
      return null;
    }

    // Add padding in Canvas Space
    const padding = 8;
    const canvasBox = {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    };

    // Convert to Container Space
    const topLeft = coordinateSystem.toContainer(toCanvasPos({ x: canvasBox.x, y: canvasBox.y }));
    const bottomRight = coordinateSystem.toContainer(
      toCanvasPos({ x: canvasBox.x + canvasBox.width, y: canvasBox.y + canvasBox.height })
    );

    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    };
  }, [selectedIds, components, wires, junctions, coordinateSystem]);

  if (!boundingBox) {
    return null;
  }

  // Don't show for single block selection (individual highlight is enough)
  if (selectedIds.size === 1) {
    const singleId = Array.from(selectedIds)[0];
    if (components.has(singleId)) {
      return null;
    }
  }

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: boundingBox.x,
        top: boundingBox.y,
        width: boundingBox.width,
        height: boundingBox.height,
        zIndex: 1000,
      }}
    >
      {/* Dashed border */}
      <div
        className="absolute inset-0 border-4 border-blue-500 rounded-lg"
        style={{
          borderStyle: 'dashed',
          borderWidth: '3px',
          boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.2), 0 0 20px rgba(59, 130, 246, 0.4)',
          backgroundColor: 'rgba(59, 130, 246, 0.05)',
        }}
      />

      {/* Corner handles */}
      {[
        { x: -4, y: -4, cursor: 'nwse-resize' }, // top-left
        { x: boundingBox.width - 4, y: -4, cursor: 'nesw-resize' }, // top-right
        { x: -4, y: boundingBox.height - 4, cursor: 'nesw-resize' }, // bottom-left
        { x: boundingBox.width - 4, y: boundingBox.height - 4, cursor: 'nwse-resize' }, // bottom-right
      ].map((handle, i) => (
        <div
          key={`corner-${i}`}
          className="absolute w-2 h-2 bg-blue-500 border border-white rounded-sm shadow"
          style={{
            left: handle.x,
            top: handle.y,
            cursor: handle.cursor,
          }}
        />
      ))}

      {/* Edge handles */}
      {[
        { x: boundingBox.width / 2 - 4, y: -4, cursor: 'ns-resize' }, // top
        { x: boundingBox.width / 2 - 4, y: boundingBox.height - 4, cursor: 'ns-resize' }, // bottom
        { x: -4, y: boundingBox.height / 2 - 4, cursor: 'ew-resize' }, // left
        { x: boundingBox.width - 4, y: boundingBox.height / 2 - 4, cursor: 'ew-resize' }, // right
      ].map((handle, i) => (
        <div
          key={`edge-${i}`}
          className="absolute w-2 h-2 bg-blue-500 border border-white rounded-sm shadow"
          style={{
            left: handle.x,
            top: handle.y,
            cursor: handle.cursor,
          }}
        />
      ))}
    </div>
  );
});

export default SelectionBoundingBox;
