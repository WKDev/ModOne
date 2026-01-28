/**
 * CSV Parser and Generator for Scenario Data
 *
 * Utilities for importing and exporting scenario events in CSV format.
 */

import type { ScenarioEvent } from '../../../types/scenario';
import { parseAddress } from './addressParser';

// ============================================================================
// Types
// ============================================================================

/**
 * Error or warning from CSV parsing.
 */
export interface CsvIssue {
  /** Line number (1-indexed) */
  line: number;
  /** Issue description */
  message: string;
}

/**
 * Result of parsing CSV content.
 */
export interface CsvParseResult {
  /** Successfully parsed events */
  events: ScenarioEvent[];
  /** Parsing errors (events skipped) */
  errors: CsvIssue[];
  /** Non-fatal warnings */
  warnings: CsvIssue[];
}

/**
 * Expected CSV columns.
 */
const EXPECTED_COLUMNS = ['time', 'address', 'value', 'persist', 'duration', 'note'];

// ============================================================================
// Internal Utilities
// ============================================================================

/**
 * Detect delimiter (comma or semicolon) from first data line.
 */
function detectDelimiter(content: string): string {
  const lines = content.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#'));
  if (lines.length === 0) return ',';

  const firstLine = lines[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;

  return semicolonCount > commaCount ? ';' : ',';
}

/**
 * Parse a single CSV line respecting quoted fields.
 */
function parseCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote (double quote)
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
          continue;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        // Start of quoted field
        inQuotes = true;
      } else if (char === delimiter) {
        // Field separator
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    i++;
  }

  // Push last field
  fields.push(current.trim());

  return fields;
}

/**
 * Generate a unique ID.
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Parse a boolean from string.
 */
function parseBoolean(value: string): boolean {
  const lower = value.toLowerCase().trim();
  return lower === 'true' || lower === '1' || lower === 'yes';
}

/**
 * Validate if a value is in valid range for its address type.
 */
function isValidValue(address: string, value: number): { valid: boolean; reason?: string } {
  const parsed = parseAddress(address);
  if (!parsed) {
    return { valid: false, reason: 'Invalid address format' };
  }

  // Coils and discrete inputs: 0 or 1
  if (parsed.type === 'coil' || parsed.type === 'discrete') {
    if (value !== 0 && value !== 1) {
      return { valid: false, reason: `${parsed.type} values must be 0 or 1, got ${value}` };
    }
  }

  // All types: 0-65535
  if (!Number.isInteger(value) || value < 0 || value > 65535) {
    return { valid: false, reason: `Value must be 0-65535, got ${value}` };
  }

  return { valid: true };
}

// ============================================================================
// Parse CSV
// ============================================================================

/**
 * Parse scenario events from CSV content.
 *
 * Supports:
 * - Comma or semicolon delimiters (auto-detected)
 * - Quoted fields for notes with special characters
 * - Comment lines starting with #
 * - Empty lines are skipped
 *
 * @param content - Raw CSV content
 * @returns Parse result with events, errors, and warnings
 */
export function parseScenarioCsv(content: string): CsvParseResult {
  const events: ScenarioEvent[] = [];
  const errors: CsvIssue[] = [];
  const warnings: CsvIssue[] = [];

  // Detect delimiter
  const delimiter = detectDelimiter(content);

  // Split into lines
  const lines = content.split(/\r?\n/);

  // Track state
  let headerParsed = false;
  let columnMap: Map<string, number> = new Map();

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1; // 1-indexed for user
    const line = lines[i].trim();

    // Skip empty lines and comments
    if (!line || line.startsWith('#')) {
      continue;
    }

    // Parse line
    const fields = parseCsvLine(line, delimiter);

    // First non-comment line is header
    if (!headerParsed) {
      // Build column map
      fields.forEach((col, index) => {
        const normalizedCol = col.toLowerCase().trim();
        if (EXPECTED_COLUMNS.includes(normalizedCol)) {
          columnMap.set(normalizedCol, index);
        }
      });

      // Validate required columns
      const missingColumns = EXPECTED_COLUMNS.filter(
        (col) => col !== 'duration' && col !== 'note' && !columnMap.has(col)
      );

      if (missingColumns.length > 0) {
        errors.push({
          line: lineNum,
          message: `Missing required columns: ${missingColumns.join(', ')}`,
        });
        // Still continue parsing with available columns
      }

      headerParsed = true;
      continue;
    }

    // Parse data row
    try {
      // Extract fields using column map
      const getField = (name: string): string => {
        const index = columnMap.get(name);
        return index !== undefined && index < fields.length ? fields[index] : '';
      };

      // Time (required)
      const timeStr = getField('time');
      const time = parseFloat(timeStr);
      if (isNaN(time)) {
        errors.push({ line: lineNum, message: `Invalid time value: "${timeStr}"` });
        continue;
      }
      if (time < 0) {
        errors.push({ line: lineNum, message: `Time cannot be negative: ${time}` });
        continue;
      }
      if (time > 3600) {
        warnings.push({ line: lineNum, message: `Time exceeds 1 hour (${time}s)` });
      }

      // Address (required)
      const address = getField('address');
      const parsedAddr = parseAddress(address);
      if (!parsedAddr) {
        errors.push({ line: lineNum, message: `Invalid address format: "${address}"` });
        continue;
      }

      // Value (required)
      const valueStr = getField('value');
      const value = parseInt(valueStr, 10);
      if (isNaN(value)) {
        errors.push({ line: lineNum, message: `Invalid value: "${valueStr}"` });
        continue;
      }

      // Validate value range
      const valueValidation = isValidValue(address, value);
      if (!valueValidation.valid) {
        errors.push({ line: lineNum, message: valueValidation.reason! });
        continue;
      }

      // Persist (optional, defaults to true)
      const persistStr = getField('persist');
      const persist = persistStr ? parseBoolean(persistStr) : true;

      // Duration (optional)
      const durationStr = getField('duration');
      let persistDuration: number | undefined;
      if (durationStr) {
        persistDuration = parseInt(durationStr, 10);
        if (isNaN(persistDuration) || persistDuration < 0) {
          errors.push({ line: lineNum, message: `Invalid duration: "${durationStr}"` });
          continue;
        }

        // Warning if duration specified with persist=true
        if (persist && persistDuration > 0) {
          warnings.push({
            line: lineNum,
            message: 'Duration is ignored when persist=true',
          });
        }
      }

      // Note (optional)
      const note = getField('note');

      // Create event
      const event: ScenarioEvent = {
        id: generateId(),
        time,
        address,
        value,
        persist,
        persistDuration: !persist ? persistDuration : undefined,
        note,
        enabled: true,
      };

      events.push(event);
    } catch (err) {
      errors.push({
        line: lineNum,
        message: `Failed to parse row: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return { events, errors, warnings };
}

// ============================================================================
// Generate CSV
// ============================================================================

/**
 * Escape a CSV field value.
 * Quotes fields containing delimiters, quotes, or newlines.
 */
function escapeField(value: string): string {
  if (!value) return '';

  // Check if quoting is needed
  const needsQuoting = /[,"\n\r]/.test(value);

  if (needsQuoting) {
    // Escape double quotes by doubling them
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  return value;
}

/**
 * Generate CSV content from scenario events.
 *
 * Rules:
 * - Uses comma delimiter
 * - Time formatted to 3 decimal places
 * - Notes with special characters are quoted
 * - Duration omitted for persist=true events
 * - Only exports enabled events
 *
 * @param events - Events to export
 * @returns CSV content as string
 */
export function generateScenarioCsv(events: ScenarioEvent[]): string {
  const lines: string[] = [];

  // Header
  lines.push(EXPECTED_COLUMNS.join(','));

  // Data rows (only enabled events)
  for (const event of events) {
    if (!event.enabled) continue;

    const row = [
      event.time.toFixed(3),
      event.address,
      event.value.toString(),
      event.persist ? 'true' : 'false',
      event.persist ? '' : (event.persistDuration?.toString() ?? ''),
      escapeField(event.note),
    ];

    lines.push(row.join(','));
  }

  return lines.join('\n');
}

// ============================================================================
// Export
// ============================================================================

export default {
  parseScenarioCsv,
  generateScenarioCsv,
};
