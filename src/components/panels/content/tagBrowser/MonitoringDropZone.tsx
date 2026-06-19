import { memo, type ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Eye } from 'lucide-react';

// ============================================================================
// Constants
// ============================================================================

/** Droppable ID used by @dnd-kit to identify the monitoring watch zone */
export const MONITORING_DROPZONE_ID = 'tag-watch-dropzone';

// ============================================================================
// Types
// ============================================================================

interface MonitoringDropZoneProps {
  /** Child content to render inside the drop zone */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * MonitoringDropZone
 *
 * Wraps the monitoring / watch list area with @dnd-kit useDroppable
 * to accept dragged tags. Shows visual indicators when a drag is
 * hovering over the zone:
 *   - Highlighted border ring (accent color)
 *   - Semi-transparent overlay with drop prompt text
 */
export const MonitoringDropZone = memo(function MonitoringDropZone({
  children,
  className = '',
}: MonitoringDropZoneProps) {
  const { setNodeRef, isOver, active } = useDroppable({
    id: MONITORING_DROPZONE_ID,
    data: {
      type: 'monitoring-zone',
      accepts: 'tag',
    },
  });

  // Only show drop indicator when there's an active drag with tag data
  const showDropIndicator = isOver && active != null;

  return (
    <div
      ref={setNodeRef}
      className={`relative transition-colors duration-150 ${
        showDropIndicator
          ? 'ring-2 ring-[var(--color-accent)] ring-inset bg-[var(--color-accent)]/5'
          : ''
      } ${className}`}
    >
      {children}

      {/* Drop overlay indicator */}
      {showDropIndicator && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none bg-[var(--color-accent)]/10 border-2 border-dashed border-[var(--color-accent)] rounded">
          <Eye size={24} className="text-[var(--color-accent)] mb-1.5 opacity-80" />
          <span className="text-xs font-medium text-[var(--color-accent)]">
            여기에 놓아 감시 추가
          </span>
          <span className="text-[10px] text-[var(--color-accent)]/70 mt-0.5">
            Drop to add to watch list
          </span>
        </div>
      )}
    </div>
  );
});

export default MonitoringDropZone;
