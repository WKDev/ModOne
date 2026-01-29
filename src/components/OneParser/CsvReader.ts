/**
 * CSV Reader for XG5000 Ladder Logic Exports
 *
 * Parses CSV files exported from LS Electric XG5000 software,
 * handling quoted fields and Korean character comments.
 */

import type { CsvRow } from './types';

/**
 * CSV Reader class for parsing XG5000 ladder logic exports
 */
export class CsvReader {
  private lines: string[];
  private currentIndex: number = 0;
  private headerSkipped: boolean = false;

  /**
   * Create a new CSV reader
   * @param csvContent - Raw CSV content as string
   */
  constructor(csvContent: string) {
    // Split by newlines (handle both Unix and Windows line endings)
    this.lines = csvContent.split(/\r?\n/).filter((line) => line.trim().length > 0);

    // Detect and skip header row
    if (this.lines.length > 0) {
      const firstLine = this.lines[0].toLowerCase();
      if (
        firstLine.includes('no') &&
        (firstLine.includes('step') || firstLine.includes('instruction'))
      ) {
        this.currentIndex = 1;
        this.headerSkipped = true;
      }
    }
  }

  /**
   * Parse a single CSV line into fields, handling quoted values
   * @param line - CSV line to parse
   * @returns Array of field values
   */
  private parseLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote inside quoted field
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator (only when not inside quotes)
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    // Don't forget the last field
    fields.push(current.trim());

    return fields;
  }

  /**
   * Read the next row from CSV
   * @returns Parsed CsvRow or null if end of file
   */
  readRow(): CsvRow | null {
    if (this.currentIndex >= this.lines.length) {
      return null;
    }

    const line = this.lines[this.currentIndex++];
    const fields = this.parseLine(line);

    // Need at least no, step, instruction
    if (fields.length < 3) {
      // Try to read next row if this one is malformed
      return this.readRow();
    }

    const no = parseInt(fields[0], 10);
    const step = parseInt(fields[1], 10);

    // Skip rows with invalid no/step
    if (isNaN(no) || isNaN(step)) {
      return this.readRow();
    }

    return {
      no,
      step,
      instruction: fields[2]?.toUpperCase() || '',
      operand1: fields[3] || undefined,
      operand2: fields[4] || undefined,
      operand3: fields[5] || undefined,
      comment: fields[6] || undefined,
    };
  }

  /**
   * Read all rows from CSV
   * @returns Array of all parsed CsvRow objects
   */
  readAllRows(): CsvRow[] {
    const rows: CsvRow[] = [];
    let row: CsvRow | null;

    while ((row = this.readRow()) !== null) {
      rows.push(row);
    }

    return rows;
  }

  /**
   * Group rows by step (network/rung number)
   * @param rows - Array of CsvRow objects
   * @returns Map of step number to array of rows in that step
   */
  groupByStep(rows: CsvRow[]): Map<number, CsvRow[]> {
    const groups = new Map<number, CsvRow[]>();

    for (const row of rows) {
      const step = row.step;
      const existing = groups.get(step);

      if (existing) {
        existing.push(row);
      } else {
        groups.set(step, [row]);
      }
    }

    return groups;
  }

  /**
   * Reset reader to beginning (after header if present)
   */
  reset(): void {
    this.currentIndex = this.headerSkipped ? 1 : 0;
  }

  /**
   * Get total number of data lines (excluding header)
   */
  get lineCount(): number {
    return this.headerSkipped ? this.lines.length - 1 : this.lines.length;
  }

  /**
   * Check if reader has more rows
   */
  hasMore(): boolean {
    return this.currentIndex < this.lines.length;
  }

  /**
   * Peek at the next row without advancing the cursor
   * @returns Next CsvRow or null if end of file
   */
  peek(): CsvRow | null {
    const savedIndex = this.currentIndex;
    const row = this.readRow();
    this.currentIndex = savedIndex;
    return row;
  }
}

/**
 * Parse CSV content and return all rows
 * Convenience function for simple parsing
 * @param csvContent - Raw CSV content
 * @returns Array of parsed CsvRow objects
 */
export function parseCsvContent(csvContent: string): CsvRow[] {
  const reader = new CsvReader(csvContent);
  return reader.readAllRows();
}

/**
 * Parse CSV content and group by step
 * @param csvContent - Raw CSV content
 * @returns Map of step number to rows
 */
export function parseCsvGrouped(csvContent: string): Map<number, CsvRow[]> {
  const reader = new CsvReader(csvContent);
  const rows = reader.readAllRows();
  return reader.groupByStep(rows);
}

export default CsvReader;
