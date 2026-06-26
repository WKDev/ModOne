/**
 * ModOne Symbol XML Parser — barrel.
 *
 * Parses/serializes XML symbol definition files (ModOne Symbol Definition Schema,
 * http://modone.io/schema/symbol/1.0) — both <ms:SymbolDefinition> and
 * <ms:SymbolLibrary> roots. Split into focused modules to keep each file small
 * and LLM/AI-readable (CLAUDE.md → Code Organization):
 *   symbolXmlTypes     — schema constants + extended XML types
 *   xmlDomUtils        — DOM element/attr helpers
 *   xmlElementParsers  — graphics/port/properties/units/behavior/states/anim parsers
 *   symbolXmlParse     — SymbolDefinition element parser + public parse API
 *   symbolXmlSerialize — SymbolDefinition/library → XML serialization
 *   symbolXmlUtils     — toParsedSymbolDefinition, domain-constraint validation
 *
 * Import from this module exactly as before — it re-exports the full surface.
 */
export * from './symbolXmlTypes';
export * from './xmlDomUtils';
export * from './xmlElementParsers';
export * from './symbolXmlParse';
export * from './symbolXmlSerialize';
export * from './symbolXmlUtils';
