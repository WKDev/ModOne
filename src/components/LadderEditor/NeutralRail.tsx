/**
 * NeutralRail Component
 *
 * Renders the right neutral rail (ground/return bus) of a ladder diagram
 * with connection points at each row for output elements to connect to.
 */

import { cn } from '../../lib/utils';

export interface NeutralRailProps {
  /** Number of rows to render connection points for */
  rowCount: number;
  /** Height of each cell in pixels */
  cellHeight: number;
  /** Optional additional class names */
  className?: string;
}

/**
 * NeutralRail - Right vertical neutral/ground bus line
 */
export function NeutralRail({ rowCount, cellHeight, className }: NeutralRailProps) {
  const totalHeight = rowCount * cellHeight;

  return (
    <div
      className={cn(
        'relative flex flex-col items-center',
        'bg-neutral-900',
        className
      )}
      style={{ width: 30, height: totalHeight }}
    >
      {/* Main vertical neutral line */}
      <div
        className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-neutral-400"
        style={{ transform: 'translateX(-50%)' }}
      />

      {/* Connection points for each row */}
      {Array.from({ length: rowCount }).map((_, row) => (
        <div
          key={row}
          className="relative flex items-center justify-center"
          style={{ height: cellHeight }}
        >
          {/* Horizontal connection stub */}
          <div
            className="absolute left-0 h-0.5 bg-neutral-400"
            style={{ width: 12 }}
          />
          {/* Connection point indicator */}
          <div
            className={cn(
              'absolute left-0 w-2 h-2 rounded-full',
              'bg-neutral-400 border border-neutral-300',
              'hover:bg-neutral-300 transition-colors'
            )}
            style={{ transform: 'translateX(-50%)' }}
            title={`Neutral rail - Row ${row + 1}`}
          />
        </div>
      ))}
    </div>
  );
}

export default NeutralRail;
