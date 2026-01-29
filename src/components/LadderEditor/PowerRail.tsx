/**
 * PowerRail Component
 *
 * Renders the left power rail (vertical power bus) of a ladder diagram
 * with connection points at each row for elements to connect to.
 */

import { cn } from '../../lib/utils';

export interface PowerRailProps {
  /** Number of rows to render connection points for */
  rowCount: number;
  /** Height of each cell in pixels */
  cellHeight: number;
  /** Optional additional class names */
  className?: string;
}

/**
 * PowerRail - Left vertical power bus line
 */
export function PowerRail({ rowCount, cellHeight, className }: PowerRailProps) {
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
      {/* Main vertical power line */}
      <div
        className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-blue-500"
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
            className="absolute right-0 h-0.5 bg-blue-500"
            style={{ width: 12 }}
          />
          {/* Connection point indicator */}
          <div
            className={cn(
              'absolute right-0 w-2 h-2 rounded-full',
              'bg-blue-500 border border-blue-400',
              'hover:bg-blue-400 transition-colors'
            )}
            style={{ transform: 'translateX(50%)' }}
            title={`Power rail - Row ${row + 1}`}
          />
        </div>
      ))}
    </div>
  );
}

export default PowerRail;
