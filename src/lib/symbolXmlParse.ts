import type { SymbolPin, LibraryScope } from "@/types/symbol";
import type { SymbolBehaviorBinding } from "@/types/behavior";
import type { BlockDomain } from "@/types/behaviorRules";
import { SYMBOL_SCHEMA_VERSION } from "./symbolXmlTypes";
import { childEl, childEls, attr, requiredAttr, numAttr, boolAttr, childText } from "./xmlDomUtils";
import { parseGraphics, parsePorts, parseProperties, parseUnits, parseBehavior, parseVisualStates, parseAnimations } from "./xmlElementParsers";
import type { XmlParseIssue, ParsedSymbolDefinition, XmlParseResult, ParsedSymbolLibrary, SymbolLibraryMetadata } from "./symbolXmlTypes";

// SymbolDefinition Element Parser
// ============================================================================

export function parseSymbolDefinitionElement(
  el: Element,
  path: string,
  issues: XmlParseIssue[],
): ParsedSymbolDefinition | null {
  if (el.localName !== 'SymbolDefinition') {
    issues.push({
      message: `Expected <SymbolDefinition>, got <${el.localName}>`,
      level: 'error',
      path,
    });
    return null;
  }

  const id = requiredAttr(el, 'id', path, issues);
  const name = requiredAttr(el, 'name', path, issues);
  if (!id || !name) return null;

  const version = attr(el, 'version') ?? '1.0.0';
  const domain = (attr(el, 'domain') ?? 'circuit') as BlockDomain;
  const canonicalType = attr(el, 'canonicalType');
  const placeable = boolAttr(el, 'placeable', true);

  // Metadata
  const description = childText(el, 'Description');
  const category = childText(el, 'Category') ?? 'custom';
  const author = childText(el, 'Author');
  const createdAt = childText(el, 'CreatedAt') ?? new Date().toISOString();
  const updatedAt = childText(el, 'UpdatedAt') ?? new Date().toISOString();

  // Layout
  const layoutEl = childEl(el, 'Layout');
  if (!layoutEl) {
    issues.push({ message: `Symbol '${id}' missing <Layout>`, level: 'error', path: `${path}/Layout` });
    return null;
  }
  const width = numAttr(layoutEl, 'width', 60);
  const height = numAttr(layoutEl, 'height', 60);

  // Ports
  const portsEl = childEl(el, 'Ports');
  const portsExtended = portsEl ? parsePorts(portsEl, `${path}/Ports`, issues) : [];
  const pins: SymbolPin[] = portsExtended;

  // Graphics
  const graphicsEl = childEl(el, 'Graphics');
  const graphics = graphicsEl ? parseGraphics(graphicsEl, `${path}/Graphics`, issues) : [];

  // Units
  const unitsEl = childEl(el, 'Units');
  const units = unitsEl ? parseUnits(unitsEl, `${path}/Units`, issues) : undefined;

  // Properties
  const propsEl = childEl(el, 'Properties');
  const properties = propsEl ? parseProperties(propsEl, `${path}/Properties`, issues) : [];

  // Behavior
  const behaviorEl = childEl(el, 'Behavior');
  const extendedBehavior = behaviorEl
    ? parseBehavior(behaviorEl, `${path}/Behavior`, issues)
    : undefined;

  // Slim SymbolBehaviorBinding (without rules) for the base interface field
  const behavior: SymbolBehaviorBinding | undefined = extendedBehavior
    ? {
        templateId: extendedBehavior.templateId,
        archetype: extendedBehavior.archetype,
        interactionMode: extendedBehavior.interactionMode,
        deviceScoped: extendedBehavior.deviceScoped,
        terminalRoles: extendedBehavior.terminalRoles,
      }
    : undefined;

  // Visual states
  const vsEl = childEl(el, 'VisualStates');
  const rawVS = vsEl ? parseVisualStates(vsEl, `${path}/VisualStates`, issues) : {};
  const visualStates = Object.keys(rawVS).length > 0 ? rawVS : undefined;

  // Animations
  const animsEl = childEl(el, 'Animations');
  const rawAnims = animsEl ? parseAnimations(animsEl, `${path}/Animations`, issues) : {};
  const animations = Object.keys(rawAnims).length > 0 ? rawAnims : undefined;

  // StandardsRef
  const srEl = childEl(el, 'StandardsRef');
  const standardsRef = srEl
    ? {
        iecSection: attr(srEl, 'iecSection'),
        iecCategory: attr(srEl, 'iecCategory'),
        refDesignator: attr(srEl, 'refDesignator'),
        spiceDevice: attr(srEl, 'spiceDevice'),
        spiceLibrary: attr(srEl, 'spiceLibrary'),
      }
    : undefined;

  // Extends
  const extendsEl = childEl(el, 'Extends');
  const extendsSymbol = extendsEl ? attr(extendsEl, 'symbolId') : undefined;

  return {
    id,
    name,
    version,
    description,
    category,
    author,
    createdAt,
    updatedAt,
    width,
    height,
    graphics,
    pins,
    units,
    properties,
    behavior,
    visualStates,
    animations,
    // Extended
    domain,
    canonicalType,
    placeable,
    extendedBehavior,
    standardsRef,
    extendsSymbol,
    portsExtended,
  };
}

// ============================================================================
// Public API — Parsing
// ============================================================================

/**
 * Parse a standalone symbol definition XML string.
 * Root element must be `<ms:SymbolDefinition>`.
 *
 * @example
 * ```ts
 * import { parseSymbolXml } from '@/lib/symbolXmlParser';
 * const result = parseSymbolXml(xmlString);
 * if (result.isValid) console.log(result.data?.id);
 * ```
 */
export function parseSymbolXml(xml: string): XmlParseResult<ParsedSymbolDefinition> {
  const issues: XmlParseIssue[] = [];

  if (!xml?.trim()) {
    return { data: null, errors: [{ message: 'Empty XML input', level: 'error' }], warnings: [], isValid: false };
  }

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xml, 'application/xml');
  } catch (e) {
    return {
      data: null,
      errors: [{ message: `DOMParser failed: ${e}`, level: 'error' }],
      warnings: [],
      isValid: false,
    };
  }

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    return {
      data: null,
      errors: [{ message: `XML syntax error: ${parseError.textContent?.trim()}`, level: 'error' }],
      warnings: [],
      isValid: false,
    };
  }

  const root = doc.documentElement;
  if (root.localName !== 'SymbolDefinition') {
    return {
      data: null,
      errors: [{ message: `Root must be <SymbolDefinition>, got <${root.localName}>`, level: 'error' }],
      warnings: [],
      isValid: false,
    };
  }

  const data = parseSymbolDefinitionElement(root, '/SymbolDefinition', issues);
  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');

  return { data, errors, warnings, isValid: errors.length === 0 && data !== null };
}

/**
 * Parse a symbol library XML string.
 * Root element must be `<ms:SymbolLibrary>`.
 *
 * @example
 * ```ts
 * import { parseSymbolLibraryXml } from '@/lib/symbolXmlParser';
 * const result = parseSymbolLibraryXml(xmlString);
 * if (result.isValid) result.data?.symbols.forEach(s => console.log(s.id));
 * ```
 */
export function parseSymbolLibraryXml(xml: string): XmlParseResult<ParsedSymbolLibrary> {
  const issues: XmlParseIssue[] = [];

  if (!xml?.trim()) {
    return { data: null, errors: [{ message: 'Empty XML input', level: 'error' }], warnings: [], isValid: false };
  }

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xml, 'application/xml');
  } catch (e) {
    return {
      data: null,
      errors: [{ message: `DOMParser failed: ${e}`, level: 'error' }],
      warnings: [],
      isValid: false,
    };
  }

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    return {
      data: null,
      errors: [{ message: `XML syntax error: ${parseError.textContent?.trim()}`, level: 'error' }],
      warnings: [],
      isValid: false,
    };
  }

  const root = doc.documentElement;
  if (root.localName !== 'SymbolLibrary') {
    return {
      data: null,
      errors: [{ message: `Root must be <SymbolLibrary>, got <${root.localName}>`, level: 'error' }],
      warnings: [],
      isValid: false,
    };
  }

  const libraryId = requiredAttr(root, 'id', '/SymbolLibrary', issues);
  const libraryName = requiredAttr(root, 'name', '/SymbolLibrary', issues);
  const scope = (attr(root, 'scope') ?? 'global') as LibraryScope | 'builtin';

  // MetaInformation
  const metaEl = childEl(root, 'MetaInformation');
  const metadata: SymbolLibraryMetadata = {
    schemaVersion: metaEl ? (childText(metaEl, 'SchemaVersion') ?? SYMBOL_SCHEMA_VERSION) : SYMBOL_SCHEMA_VERSION,
    sourceTool: metaEl ? childText(metaEl, 'SourceTool') : undefined,
    description: metaEl ? childText(metaEl, 'Description') : undefined,
    author: metaEl ? childText(metaEl, 'Author') : undefined,
    createdAt: metaEl ? childText(metaEl, 'CreatedAt') : undefined,
    updatedAt: metaEl ? childText(metaEl, 'UpdatedAt') : undefined,
  };

  // SymbolDefinitions
  const symbolDefsEl = childEl(root, 'SymbolDefinitions');
  const symbols: ParsedSymbolDefinition[] = [];

  if (symbolDefsEl) {
    for (const symEl of childEls(symbolDefsEl, 'SymbolDefinition')) {
      const symId = symEl.getAttribute('id') ?? '?';
      const sym = parseSymbolDefinitionElement(
        symEl,
        `/SymbolLibrary/SymbolDefinitions/${symId}`,
        issues,
      );
      if (sym) symbols.push(sym);
    }
  }

  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');

  return {
    data: { id: libraryId, name: libraryName, scope, metadata, symbols },
    errors,
    warnings,
    isValid: errors.length === 0,
  };
}

// ============================================================================
