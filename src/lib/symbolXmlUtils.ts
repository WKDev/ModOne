import type { SymbolDefinition } from "@/types/symbol";
import type { BlockDomain } from "@/types/behaviorRules";
import { validateRuleDomain } from "@/types/behaviorRules";
import type { EdgePosition, ParsedSymbolDefinition, StandardsRef, XmlParseIssue } from "./symbolXmlTypes";

// Utilities
// ============================================================================

/**
 * Convert a plain SymbolDefinition to ParsedSymbolDefinition with default
 * extended fields. Useful before calling symbolDefinitionToXml().
 */
export function toParsedSymbolDefinition(
  def: SymbolDefinition,
  options?: {
    domain?: BlockDomain;
    canonicalType?: string;
    placeable?: boolean;
    standardsRef?: StandardsRef;
  },
): ParsedSymbolDefinition {
  return {
    ...def,
    domain: options?.domain ?? 'circuit',
    canonicalType: options?.canonicalType,
    placeable: options?.placeable ?? true,
    standardsRef: options?.standardsRef,
    portsExtended: def.pins.map((pin) => ({
      ...pin,
      edgePosition: _inferEdgePosition(pin.position, def.width, def.height),
    })),
  };
}

/** Infer the canvas edge a pin sits on from its position. */
export function _inferEdgePosition(
  position: { x: number; y: number },
  width: number,
  height: number,
): EdgePosition {
  const { x, y } = position;
  const threshold = Math.min(width, height) * 0.15;
  if (y <= threshold) return 'top';
  if (y >= height - threshold) return 'bottom';
  if (x <= threshold) return 'left';
  if (x >= width - threshold) return 'right';
  return x < width / 2 ? 'left' : 'right';
}

/**
 * Validate domain constraint rules:
 * - circuit blocks must not reference PLC register actions/conditions
 * - PLC blocks may use any action type
 *
 * Returns a list of issues found; empty array means the definition is valid.
 */
export function validateDomainConstraints(def: ParsedSymbolDefinition): XmlParseIssue[] {
  const issues: XmlParseIssue[] = [];
  const domain = def.behavior?.domain ?? def.domain;
  if (domain !== 'circuit') return issues;

  for (const rule of def.behavior?.rules ?? []) {
    const errs = validateRuleDomain(rule, 'circuit');
    for (const msg of errs) {
      issues.push({
        message: `Symbol '${def.id}': ${msg}`,
        level: 'error',
        path: `/SymbolDefinition[@id='${def.id}']/Behavior/Rules/Rule`,
      });
    }
  }

  return issues;
}
