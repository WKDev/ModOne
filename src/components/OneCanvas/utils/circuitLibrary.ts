/**
 * Circuit Library
 *
 * Utilities for saving and loading reusable circuit templates.
 * Templates are stored in localStorage for persistence.
 */

import type { Block, Wire, Junction, Position } from '../types';

// ============================================================================
// Types
// ============================================================================

/** Circuit template stored in the library */
export interface CircuitTemplate {
  /** Unique identifier */
  id: string;
  /** User-friendly name */
  name: string;
  /** Description of what this circuit does */
  description: string;
  /** Category for organization */
  category: string;
  /** Creation timestamp */
  createdAt: string;
  /** Last modified timestamp */
  updatedAt: string;
  /** Component blocks (serialized) */
  components: Array<{ id: string; data: Block }>;
  /** Wire connections */
  wires: Wire[];
  /** Junction points */
  junctions: Array<{ id: string; data: Junction }>;
  /** Bounding box of the original circuit */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** Preview thumbnail (base64 image, optional) */
  thumbnail?: string;
  /** Tags for searchability */
  tags: string[];
}

/** Library metadata */
export interface CircuitLibraryMetadata {
  /** Library version */
  version: string;
  /** Total template count */
  templateCount: number;
  /** Categories used */
  categories: string[];
  /** Last updated */
  lastUpdated: string;
}

/** Library storage format */
interface CircuitLibraryStorage {
  metadata: CircuitLibraryMetadata;
  templates: CircuitTemplate[];
}

// ============================================================================
// Constants
// ============================================================================

const LIBRARY_STORAGE_KEY = 'modone-circuit-library';
const LIBRARY_VERSION = '1.0';

const DEFAULT_CATEGORIES = [
  'Motor Control',
  'PLC I/O',
  'Safety',
  'Power Distribution',
  'Sensors',
  'Custom',
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique ID for templates
 */
function generateTemplateId(): string {
  return `tmpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculate bounding box of components
 */
function calculateBounds(
  components: Map<string, Block>
): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const block of components.values()) {
    minX = Math.min(minX, block.position.x);
    minY = Math.min(minY, block.position.y);
    maxX = Math.max(maxX, block.position.x + block.size.width);
    maxY = Math.max(maxY, block.position.y + block.size.height);
  }

  // Handle empty circuit
  if (!isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Offset positions to start from (0, 0) with padding
 */
function normalizePositions(
  components: Map<string, Block>,
  junctions: Map<string, Junction>,
  wires: Wire[],
  bounds: { minX: number; minY: number }
): {
  components: Array<{ id: string; data: Block }>;
  junctions: Array<{ id: string; data: Junction }>;
  wires: Wire[];
} {
  const padding = 20;
  const offsetX = bounds.minX - padding;
  const offsetY = bounds.minY - padding;

  const normalizedComponents: Array<{ id: string; data: Block }> = [];
  for (const [id, block] of components) {
    normalizedComponents.push({
      id,
      data: {
        ...block,
        position: {
          x: block.position.x - offsetX,
          y: block.position.y - offsetY,
        },
      },
    });
  }

  const normalizedJunctions: Array<{ id: string; data: Junction }> = [];
  for (const [id, junction] of junctions) {
    normalizedJunctions.push({
      id,
      data: {
        ...junction,
        position: {
          x: junction.position.x - offsetX,
          y: junction.position.y - offsetY,
        },
      },
    });
  }

  // Normalize wire handle positions
  const normalizedWires = wires.map((wire) => ({
    ...wire,
    handles: wire.handles?.map((handle) => ({
      ...handle,
      position: {
        x: handle.position.x - offsetX,
        y: handle.position.y - offsetY,
      },
    })),
  }));

  return {
    components: normalizedComponents,
    junctions: normalizedJunctions,
    wires: normalizedWires,
  };
}

// ============================================================================
// Storage Functions
// ============================================================================

/**
 * Load the circuit library from localStorage
 */
export function loadLibrary(): CircuitLibraryStorage {
  try {
    const stored = localStorage.getItem(LIBRARY_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load circuit library:', e);
  }

  // Return default empty library
  return {
    metadata: {
      version: LIBRARY_VERSION,
      templateCount: 0,
      categories: DEFAULT_CATEGORIES,
      lastUpdated: new Date().toISOString(),
    },
    templates: [],
  };
}

/**
 * Save the circuit library to localStorage
 */
export function saveLibrary(library: CircuitLibraryStorage): void {
  try {
    library.metadata.templateCount = library.templates.length;
    library.metadata.lastUpdated = new Date().toISOString();
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(library));
  } catch (e) {
    console.error('Failed to save circuit library:', e);
    throw new Error('Failed to save circuit library. Storage may be full.');
  }
}

// ============================================================================
// Template CRUD Functions
// ============================================================================

/**
 * Get all templates from the library
 */
export function getAllTemplates(): CircuitTemplate[] {
  const library = loadLibrary();
  return library.templates;
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string): CircuitTemplate[] {
  const library = loadLibrary();
  return library.templates.filter((t) => t.category === category);
}

/**
 * Search templates by name, description, or tags
 */
export function searchTemplates(query: string): CircuitTemplate[] {
  const library = loadLibrary();
  const lowerQuery = query.toLowerCase();

  return library.templates.filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Get a template by ID
 */
export function getTemplateById(id: string): CircuitTemplate | undefined {
  const library = loadLibrary();
  return library.templates.find((t) => t.id === id);
}

/**
 * Create a new template from selected components
 */
export function createTemplate(
  name: string,
  description: string,
  category: string,
  components: Map<string, Block>,
  wires: Wire[],
  junctions: Map<string, Junction>,
  tags: string[] = []
): CircuitTemplate {
  const bounds = calculateBounds(components);

  // Filter wires to only include those connected to selected components
  const componentIds = new Set(components.keys());
  const junctionIds = new Set(junctions.keys());

  const relevantWires = wires.filter((wire) => {
    const fromValid =
      ('componentId' in wire.from && componentIds.has(wire.from.componentId)) ||
      ('junctionId' in wire.from && junctionIds.has(wire.from.junctionId));
    const toValid =
      ('componentId' in wire.to && componentIds.has(wire.to.componentId)) ||
      ('junctionId' in wire.to && junctionIds.has(wire.to.junctionId));
    return fromValid && toValid;
  });

  const normalized = normalizePositions(components, junctions, relevantWires, bounds);

  const now = new Date().toISOString();
  const template: CircuitTemplate = {
    id: generateTemplateId(),
    name,
    description,
    category,
    createdAt: now,
    updatedAt: now,
    components: normalized.components,
    wires: normalized.wires,
    junctions: normalized.junctions,
    bounds: {
      minX: 0,
      minY: 0,
      maxX: bounds.maxX - bounds.minX + 40,
      maxY: bounds.maxY - bounds.minY + 40,
    },
    tags,
  };

  // Save to library
  const library = loadLibrary();
  library.templates.push(template);
  saveLibrary(library);

  return template;
}

/**
 * Update an existing template
 */
export function updateTemplate(
  id: string,
  updates: Partial<Pick<CircuitTemplate, 'name' | 'description' | 'category' | 'tags'>>
): CircuitTemplate | undefined {
  const library = loadLibrary();
  const index = library.templates.findIndex((t) => t.id === id);

  if (index === -1) {
    return undefined;
  }

  library.templates[index] = {
    ...library.templates[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  saveLibrary(library);
  return library.templates[index];
}

/**
 * Delete a template
 */
export function deleteTemplate(id: string): boolean {
  const library = loadLibrary();
  const index = library.templates.findIndex((t) => t.id === id);

  if (index === -1) {
    return false;
  }

  library.templates.splice(index, 1);
  saveLibrary(library);
  return true;
}

// ============================================================================
// Template Usage Functions
// ============================================================================

/**
 * Prepare template components for insertion at a specific position.
 * Generates new IDs to avoid conflicts.
 */
export function prepareTemplateForInsertion(
  template: CircuitTemplate,
  insertPosition: Position
): {
  components: Array<{ id: string; data: Block }>;
  wires: Wire[];
  junctions: Array<{ id: string; data: Junction }>;
} {
  // Create ID mapping for new IDs
  const idMap = new Map<string, string>();

  // Generate new IDs for components
  const newComponents: Array<{ id: string; data: Block }> = template.components.map((item) => {
    const newId = `blk_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    idMap.set(item.id, newId);

    return {
      id: newId,
      data: {
        ...item.data,
        id: newId,
        position: {
          x: item.data.position.x + insertPosition.x,
          y: item.data.position.y + insertPosition.y,
        },
      },
    };
  });

  // Generate new IDs for junctions
  const newJunctions: Array<{ id: string; data: Junction }> = template.junctions.map((item) => {
    const newId = `jnc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    idMap.set(item.id, newId);

    return {
      id: newId,
      data: {
        ...item.data,
        id: newId,
        position: {
          x: item.data.position.x + insertPosition.x,
          y: item.data.position.y + insertPosition.y,
        },
      },
    };
  });

  // Update wire references to use new IDs
  const newWires: Wire[] = template.wires.map((wire) => {
    const newWireId = `wire_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const newFrom = 'componentId' in wire.from
      ? { componentId: idMap.get(wire.from.componentId) || wire.from.componentId, portId: wire.from.portId }
      : 'junctionId' in wire.from
        ? { junctionId: idMap.get(wire.from.junctionId) || wire.from.junctionId }
        : wire.from;

    const newTo = 'componentId' in wire.to
      ? { componentId: idMap.get(wire.to.componentId) || wire.to.componentId, portId: wire.to.portId }
      : 'junctionId' in wire.to
        ? { junctionId: idMap.get(wire.to.junctionId) || wire.to.junctionId }
        : wire.to;

    return {
      ...wire,
      id: newWireId,
      from: newFrom,
      to: newTo,
      handles: wire.handles?.map((handle) => ({
        ...handle,
        position: {
          x: handle.position.x + insertPosition.x,
          y: handle.position.y + insertPosition.y,
        },
      })),
    };
  });

  return {
    components: newComponents,
    wires: newWires,
    junctions: newJunctions,
  };
}

/**
 * Get all categories (including custom ones from templates)
 */
export function getAllCategories(): string[] {
  const library = loadLibrary();
  const categories = new Set(DEFAULT_CATEGORIES);

  for (const template of library.templates) {
    categories.add(template.category);
  }

  return Array.from(categories).sort();
}

/**
 * Export library to JSON string
 */
export function exportLibrary(): string {
  const library = loadLibrary();
  return JSON.stringify(library, null, 2);
}

/**
 * Import library from JSON string (merges with existing)
 */
export function importLibrary(jsonString: string, overwrite = false): number {
  try {
    const imported: CircuitLibraryStorage = JSON.parse(jsonString);

    if (!imported.templates || !Array.isArray(imported.templates)) {
      throw new Error('Invalid library format');
    }

    const library = overwrite
      ? { ...imported, metadata: { ...imported.metadata, version: LIBRARY_VERSION } }
      : loadLibrary();

    if (!overwrite) {
      // Merge: add templates with new IDs to avoid conflicts
      const existingIds = new Set(library.templates.map((t) => t.id));

      for (const template of imported.templates) {
        if (existingIds.has(template.id)) {
          // Generate new ID for imported template
          template.id = generateTemplateId();
        }
        library.templates.push(template);
      }
    }

    saveLibrary(library);
    return imported.templates.length;
  } catch (e) {
    console.error('Failed to import library:', e);
    throw new Error('Failed to import library. Invalid format.');
  }
}
