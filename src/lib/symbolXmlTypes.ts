import type { SymbolDefinition, SymbolPin, LibraryScope } from "@/types/symbol";
import type { SymbolBehaviorBinding } from "@/types/behavior";
import type { BlockDomain } from "@/types/behaviorRules";

// Schema Constants
// ============================================================================

export const SYMBOL_SCHEMA_NS = 'http://modone.io/schema/symbol/1.0';
export const SYMBOL_SCHEMA_VERSION = '1.0.0';

// ============================================================================
// Extended Types  (XML-specific fields beyond SymbolDefinition)
// ============================================================================

// Re-export domain type for consumers
export type { BlockDomain };

/** User interaction mode during simulation */
export type InteractionMode = 'none' | 'click' | 'toggle' | 'drag';

/** Canvas edge the port sits on */
export type EdgePosition = 'top' | 'bottom' | 'left' | 'right';

/** Extended pin with XML-specific routing hints */
export interface XmlPort extends SymbolPin {
  edgePosition?: EdgePosition;
  /** Fractional offset along the edge (0.0 = start, 1.0 = end) */
  edgeOffset?: number;
  /** Maximum simultaneous connections (0 = unlimited) */
  maxConnections?: number;
  description?: string;
}

/**
 * Extended behavior binding — SymbolBehaviorBinding already has `rules` and
 * `domain` (from behaviorRules.ts); this alias adds no new fields but is
 * kept as a named export for clarity in the parser's public API.
 */
export type ExtendedBehaviorBinding = SymbolBehaviorBinding;

/** IEC / SPICE standards cross-reference */
export interface StandardsRef {
  iecSection?: string;
  iecCategory?: string;
  refDesignator?: string;
  spiceDevice?: string;
  spiceLibrary?: string;
}

/** ParsedSymbolDefinition — extends SymbolDefinition with XML-specific fields */
export interface ParsedSymbolDefinition extends SymbolDefinition {
  domain?: BlockDomain;
  canonicalType?: string;
  placeable?: boolean;
  extendedBehavior?: ExtendedBehaviorBinding;
  standardsRef?: StandardsRef;
  extendsSymbol?: string;
  /** Full ports with routing hints (superset of pins) */
  portsExtended?: XmlPort[];
}

/** Symbol library metadata (maps to ms:MetaInformation) */
export interface SymbolLibraryMetadata {
  schemaVersion: string;
  sourceTool?: string;
  description?: string;
  author?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Parsed symbol library */
export interface ParsedSymbolLibrary {
  id: string;
  name: string;
  scope: LibraryScope | 'builtin';
  metadata: SymbolLibraryMetadata;
  symbols: ParsedSymbolDefinition[];
}

/** Parse issue (error or warning) */
export interface XmlParseIssue {
  message: string;
  level: 'error' | 'warning';
  path?: string;
}

/** Result of an XML parse operation */
export interface XmlParseResult<T> {
  data: T | null;
  errors: XmlParseIssue[];
  warnings: XmlParseIssue[];
  isValid: boolean;
}

// ============================================================================
