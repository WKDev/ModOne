/**
 * Scenario Grid Constants
 *
 * Shared column definitions and grid layout constants
 * used by ScenarioGrid, ScenarioRow, and ScenarioCell.
 */

// ============================================================================
// Types
// ============================================================================

export type ColumnKey = 'enabled' | 'time' | 'address' | 'value' | 'persist' | 'duration' | 'note';

// ============================================================================
// Constants
// ============================================================================

export const COLUMNS: { key: ColumnKey; label: string; width: string }[] = [
  { key: 'enabled', label: '', width: '30px' },
  { key: 'time', label: 'Time (s)', width: '80px' },
  { key: 'address', label: 'Address', width: '120px' },
  { key: 'value', label: 'Value', width: '80px' },
  { key: 'persist', label: 'Persist', width: '70px' },
  { key: 'duration', label: 'Duration', width: '80px' },
  { key: 'note', label: 'Note', width: '1fr' },
];

export const GRID_TEMPLATE_COLUMNS = COLUMNS.map((c) => c.width).join(' ');
