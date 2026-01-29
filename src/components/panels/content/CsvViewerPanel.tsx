/**
 * CSV Viewer Panel
 *
 * Displays CSV file content in a read-only table format with sorting and filtering.
 * Uses virtual scrolling for large files.
 */

import { memo, useState, useEffect, useMemo, useCallback } from 'react';
import {
  Table,
  FileWarning,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  RefreshCw,
} from 'lucide-react';
import Papa from 'papaparse';
import { explorerService } from '../../../services/explorerService';

// ============================================================================
// Types
// ============================================================================

interface CsvViewerPanelProps {
  data?: unknown;
}

interface CsvTabData {
  filePath?: string;
  relativePath?: string;
}

interface CsvData {
  headers: string[];
  rows: string[][];
}

type SortDirection = 'asc' | 'desc' | null;

// ============================================================================
// Helper Components
// ============================================================================

interface TableHeaderCellProps {
  header: string;
  columnIndex: number;
  sortColumn: number | null;
  sortDirection: SortDirection;
  onSort: (columnIndex: number) => void;
}

const TableHeaderCell = memo(function TableHeaderCell({
  header,
  columnIndex,
  sortColumn,
  sortDirection,
  onSort,
}: TableHeaderCellProps) {
  const isSorted = sortColumn === columnIndex;

  return (
    <th
      className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider
                 bg-gray-800 sticky top-0 cursor-pointer hover:bg-gray-700 select-none"
      onClick={() => onSort(columnIndex)}
    >
      <div className="flex items-center gap-1">
        <span className="truncate">{header || `Column ${columnIndex + 1}`}</span>
        {isSorted ? (
          sortDirection === 'asc' ? (
            <ArrowUp size={14} className="flex-shrink-0 text-blue-400" />
          ) : (
            <ArrowDown size={14} className="flex-shrink-0 text-blue-400" />
          )
        ) : (
          <ArrowUpDown size={14} className="flex-shrink-0 text-gray-600" />
        )}
      </div>
    </th>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export const CsvViewerPanel = memo(function CsvViewerPanel({
  data,
}: CsvViewerPanelProps) {
  const tabData = data as CsvTabData | undefined;
  const filePath = tabData?.filePath;
  const relativePath = tabData?.relativePath;

  // State
  const [csvData, setCsvData] = useState<CsvData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Load CSV file
  useEffect(() => {
    if (!filePath) {
      setError('No file path provided');
      return;
    }

    const loadCsv = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const content = await explorerService.readFileContents(filePath);

        // Parse CSV
        const result = Papa.parse<string[]>(content, {
          skipEmptyLines: true,
        });

        if (result.errors.length > 0) {
          console.warn('CSV parse warnings:', result.errors);
        }

        const rows = result.data;
        if (rows.length === 0) {
          setError('CSV file is empty');
          return;
        }

        // First row is headers
        const headers = rows[0];
        const dataRows = rows.slice(1);

        setCsvData({ headers, rows: dataRows });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(`Failed to load CSV: ${message}`);
      } finally {
        setIsLoading(false);
      }
    };

    loadCsv();
  }, [filePath]);

  // Handle sort
  const handleSort = useCallback((columnIndex: number) => {
    setSortColumn((prev) => {
      if (prev !== columnIndex) {
        setSortDirection('asc');
        return columnIndex;
      }
      // Cycle: asc -> desc -> null
      setSortDirection((prevDir) => {
        if (prevDir === 'asc') return 'desc';
        if (prevDir === 'desc') return null;
        return 'asc';
      });
      // If already sorted on this column, we just toggle direction, column stays
      return sortDirection === 'desc' ? null : columnIndex;
    });
  }, [sortDirection]);

  // Filter and sort rows
  const processedRows = useMemo(() => {
    if (!csvData) return [];

    let rows = csvData.rows;

    // Filter by search term
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      rows = rows.filter((row) =>
        row.some((cell) => cell.toLowerCase().includes(lowerSearch))
      );
    }

    // Sort
    if (sortColumn !== null && sortDirection) {
      rows = [...rows].sort((a, b) => {
        const aVal = a[sortColumn] || '';
        const bVal = b[sortColumn] || '';

        // Try numeric comparison
        const aNum = parseFloat(aVal);
        const bNum = parseFloat(bVal);

        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
        }

        // String comparison
        const comparison = aVal.localeCompare(bVal);
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return rows;
  }, [csvData, searchTerm, sortColumn, sortDirection]);

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 p-4">
        <RefreshCw size={48} className="mb-4 animate-spin text-gray-600" />
        <p className="text-sm">Loading CSV file...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 p-4">
        <FileWarning size={48} className="mb-4 text-red-500" />
        <h3 className="text-lg font-medium mb-2 text-red-400">Error</h3>
        <p className="text-sm text-center">{error}</p>
      </div>
    );
  }

  // No file state
  if (!filePath) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 p-4">
        <Table size={48} className="mb-4 text-gray-600" />
        <h3 className="text-lg font-medium mb-2">CSV Viewer</h3>
        <p className="text-sm text-center">No file loaded</p>
      </div>
    );
  }

  // No data state
  if (!csvData) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 p-4">
        <Table size={48} className="mb-4 text-gray-600" />
        <h3 className="text-lg font-medium mb-2">CSV Viewer</h3>
        <p className="text-sm text-center">No data available</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700">
        <div className="flex-1 flex items-center gap-2">
          <Search size={16} className="text-gray-500" />
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 max-w-xs bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm
                     text-gray-300 placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="text-xs text-gray-500">
          {processedRows.length} / {csvData.rows.length} rows
        </div>
      </div>

      {/* File path */}
      <div className="px-3 py-1 text-xs text-gray-500 border-b border-gray-700 truncate">
        {relativePath || filePath}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider
                           bg-gray-800 sticky top-0 w-12">
                #
              </th>
              {csvData.headers.map((header, index) => (
                <TableHeaderCell
                  key={index}
                  header={header}
                  columnIndex={index}
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {processedRows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="hover:bg-gray-800/50 transition-colors"
              >
                <td className="px-3 py-1.5 text-xs text-gray-500 font-mono">
                  {rowIndex + 1}
                </td>
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className="px-3 py-1.5 text-sm text-gray-300 whitespace-nowrap"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {processedRows.length === 0 && (
          <div className="p-8 text-center text-gray-500 text-sm">
            {searchTerm ? 'No matching rows found' : 'No data in CSV'}
          </div>
        )}
      </div>
    </div>
  );
});

export default CsvViewerPanel;
