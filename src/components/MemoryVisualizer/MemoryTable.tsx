/**
 * Memory Table Component
 *
 * Displays memory values in a configurable grid format with row headers
 * showing addresses. Supports variable column counts (1-16).
 */

import { useMemo } from 'react';
import type { MemoryType } from '../../types/modbus';
import type { DisplayFormat } from './types';
import { MemoryCell } from './MemoryCell';
import { formatAddress, calculateRowCount } from './utils/addressUtils';

// ============================================================================
// Types
// ============================================================================

interface MemoryTableProps {
  /** Type of memory being displayed */
  memoryType: MemoryType;
  /** Starting address of the displayed range */
  startAddress: number;
  /** Array of memory values */
  values: (boolean | number)[];
  /** Number of columns in the table (1-16) */
  columns: number;
  /** Display format for values */
  displayFormat: DisplayFormat;
  /** Whether cells are read-only (discrete/input are read-only) */
  isReadOnly: boolean;
  /** Currently selected address, if any */
  selectedAddress?: number | null;
  /** Callback when a cell is clicked */
  onCellClick: (address: number, value: boolean | number) => void;
  /** Callback when a cell is right-clicked */
  onCellContextMenu: (
    e: React.MouseEvent,
    address: number,
    value: boolean | number
  ) => void;
}

interface RowData {
  rowAddress: number;
  cells: (CellData | null)[];
}

interface CellData {
  address: number;
  value: boolean | number;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Memory table component with configurable grid layout.
 */
export function MemoryTable({
  memoryType,
  startAddress,
  values,
  columns,
  displayFormat,
  isReadOnly,
  selectedAddress,
  onCellClick,
  onCellContextMenu,
}: MemoryTableProps) {
  // Determine if this is a boolean type (coil/discrete)
  const isBooleanType = memoryType === 'coil' || memoryType === 'discrete';

  // Calculate row count
  const rowCount = useMemo(
    () => calculateRowCount(values.length, columns),
    [values.length, columns]
  );

  // Generate rows data
  const rows = useMemo(() => {
    const result: RowData[] = [];

    for (let row = 0; row < rowCount; row++) {
      const rowAddress = startAddress + row * columns;
      const cells: (CellData | null)[] = [];

      for (let col = 0; col < columns; col++) {
        const index = row * columns + col;
        if (index < values.length) {
          cells.push({
            address: startAddress + index,
            value: values[index],
          });
        } else {
          // Empty cell for incomplete rows
          cells.push(null);
        }
      }

      result.push({ rowAddress, cells });
    }

    return result;
  }, [startAddress, values, columns, rowCount]);

  // Address format for row headers
  const addressFormat = displayFormat === 'HEX' ? 'HEX' : 'DEC';

  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-collapse font-mono text-sm">
        {/* Column headers */}
        <thead className="sticky top-0 z-10 bg-neutral-800">
          <tr>
            <th className="w-20 border border-neutral-700 p-1 text-neutral-400">
              Addr
            </th>
            {Array.from({ length: columns }, (_, i) => (
              <th
                key={i}
                className="w-16 border border-neutral-700 p-1 text-neutral-400"
              >
                +{i}
              </th>
            ))}
          </tr>
        </thead>

        {/* Table body */}
        <tbody>
          {rows.map(({ rowAddress, cells }) => (
            <tr key={rowAddress}>
              {/* Row address header */}
              <td className="border border-neutral-700 bg-neutral-800 p-1 text-neutral-400">
                {formatAddress(rowAddress, addressFormat)}
              </td>

              {/* Memory cells */}
              {cells.map((cell, colIndex) => (
                <td
                  key={colIndex}
                  className="border border-neutral-700 p-0"
                >
                  {cell ? (
                    <MemoryCell
                      address={cell.address}
                      value={cell.value}
                      isBooleanType={isBooleanType}
                      displayFormat={displayFormat}
                      isReadOnly={isReadOnly}
                      isSelected={selectedAddress === cell.address}
                      onClick={() => onCellClick(cell.address, cell.value)}
                      onContextMenu={(e) =>
                        onCellContextMenu(e, cell.address, cell.value)
                      }
                    />
                  ) : (
                    <div className="h-8 bg-neutral-900" />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Empty state */}
      {values.length === 0 && (
        <div className="flex h-32 items-center justify-center text-neutral-500">
          No data to display
        </div>
      )}
    </div>
  );
}

export default MemoryTable;
