/**
 * Multi-Page Schematic System
 *
 * Manages multiple schematic pages within a single project.
 * Supports cross-page references, page navigation, and page-level metadata.
 */

import type { CircuitMetadata, SerializableCircuitState } from '../types';

// ============================================================================
// Types
// ============================================================================

/** Page reference for cross-page connections */
export interface PageReference {
  /** Target page ID */
  pageId: string;
  /** Target page number (1-indexed) */
  pageNumber: number;
  /** Target page name */
  pageName: string;
  /** Reference type */
  type: 'outgoing' | 'incoming';
  /** Connected wire/component ID on this page */
  localId: string;
  /** Connected wire/component ID on target page */
  remoteId: string;
  /** Label for the reference (e.g., "/2.K1" meaning page 2, component K1) */
  label: string;
}

/** Individual schematic page */
export interface SchematicPage {
  /** Unique page identifier */
  id: string;
  /** Page number (1-indexed, for display) */
  number: number;
  /** Page name/title */
  name: string;
  /** Page description */
  description: string;
  /** Page size (for printing) */
  pageSize: 'A4' | 'A3' | 'Letter' | 'Legal' | 'Custom';
  /** Page orientation */
  orientation: 'portrait' | 'landscape';
  /** Custom dimensions (if pageSize is Custom) */
  customSize?: { width: number; height: number };
  /** Circuit data for this page */
  circuit: SerializableCircuitState;
  /** Cross-page references */
  references: PageReference[];
  /** Page creation timestamp */
  createdAt: string;
  /** Last modified timestamp */
  updatedAt: string;
  /** Page-specific metadata */
  metadata?: Record<string, unknown>;
}

/** Multi-page schematic project */
export interface MultiPageSchematic {
  /** Project identifier */
  id: string;
  /** Project name */
  name: string;
  /** Project description */
  description: string;
  /** Version */
  version: string;
  /** All pages */
  pages: SchematicPage[];
  /** Currently active page ID */
  activePageId: string;
  /** Project-level metadata */
  metadata: CircuitMetadata;
  /** Creation timestamp */
  createdAt: string;
  /** Last modified timestamp */
  updatedAt: string;
}

/** Page navigation info */
export interface PageNavigationInfo {
  currentPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
  pageList: Array<{ id: string; number: number; name: string }>;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_PAGE_SIZE = 'A4';
const DEFAULT_ORIENTATION = 'landscape';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate unique page ID
 */
function generatePageId(): string {
  return `page_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

/**
 * Generate unique schematic ID
 */
function generateSchematicId(): string {
  return `sch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create an empty circuit state
 */
function createEmptyCircuit(): SerializableCircuitState {
  const now = new Date().toISOString();
  return {
    metadata: {
      name: 'New Page',
      description: '',
      tags: [],
      author: '',
      createdAt: now,
      modifiedAt: now,
      version: '1.0',
    },
    components: {},
    junctions: {},
    wires: [],
  };
}

// ============================================================================
// Multi-Page Schematic Functions
// ============================================================================

/**
 * Create a new multi-page schematic project
 */
export function createMultiPageSchematic(
  name: string,
  description: string = ''
): MultiPageSchematic {
  const now = new Date().toISOString();
  const firstPage = createPage('Page 1', 'Main schematic page', 1);

  return {
    id: generateSchematicId(),
    name,
    description,
    version: '1.0',
    pages: [firstPage],
    activePageId: firstPage.id,
    metadata: {
      name,
      description: '',
      tags: [],
      author: '',
      createdAt: now,
      modifiedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create a new schematic page
 */
export function createPage(
  name: string,
  description: string = '',
  number: number = 1,
  pageSize: SchematicPage['pageSize'] = DEFAULT_PAGE_SIZE,
  orientation: SchematicPage['orientation'] = DEFAULT_ORIENTATION
): SchematicPage {
  const now = new Date().toISOString();

  return {
    id: generatePageId(),
    number,
    name,
    description,
    pageSize,
    orientation,
    circuit: createEmptyCircuit(),
    references: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Add a new page to the schematic
 */
export function addPage(
  schematic: MultiPageSchematic,
  name?: string,
  description?: string
): MultiPageSchematic {
  const newNumber = schematic.pages.length + 1;
  const newPage = createPage(
    name || `Page ${newNumber}`,
    description || '',
    newNumber
  );

  return {
    ...schematic,
    pages: [...schematic.pages, newPage],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Remove a page from the schematic
 */
export function removePage(
  schematic: MultiPageSchematic,
  pageId: string
): MultiPageSchematic {
  if (schematic.pages.length <= 1) {
    throw new Error('Cannot remove the last page');
  }

  const pageIndex = schematic.pages.findIndex((p) => p.id === pageId);
  if (pageIndex === -1) {
    throw new Error('Page not found');
  }

  const newPages = schematic.pages.filter((p) => p.id !== pageId);

  // Renumber remaining pages
  newPages.forEach((page, index) => {
    page.number = index + 1;
  });

  // Update active page if it was removed
  let newActivePageId = schematic.activePageId;
  if (schematic.activePageId === pageId) {
    newActivePageId = newPages[Math.min(pageIndex, newPages.length - 1)].id;
  }

  // Remove cross-references to the deleted page
  newPages.forEach((page) => {
    page.references = page.references.filter((ref) => ref.pageId !== pageId);
  });

  return {
    ...schematic,
    pages: newPages,
    activePageId: newActivePageId,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Update a page's properties
 */
export function updatePage(
  schematic: MultiPageSchematic,
  pageId: string,
  updates: Partial<Pick<SchematicPage, 'name' | 'description' | 'pageSize' | 'orientation'>>
): MultiPageSchematic {
  const pageIndex = schematic.pages.findIndex((p) => p.id === pageId);
  if (pageIndex === -1) {
    throw new Error('Page not found');
  }

  const updatedPages = [...schematic.pages];
  updatedPages[pageIndex] = {
    ...updatedPages[pageIndex],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  return {
    ...schematic,
    pages: updatedPages,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Update a page's circuit data
 */
export function updatePageCircuit(
  schematic: MultiPageSchematic,
  pageId: string,
  circuit: SerializableCircuitState
): MultiPageSchematic {
  const pageIndex = schematic.pages.findIndex((p) => p.id === pageId);
  if (pageIndex === -1) {
    throw new Error('Page not found');
  }

  const updatedPages = [...schematic.pages];
  updatedPages[pageIndex] = {
    ...updatedPages[pageIndex],
    circuit,
    updatedAt: new Date().toISOString(),
  };

  return {
    ...schematic,
    pages: updatedPages,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Reorder pages
 */
export function reorderPages(
  schematic: MultiPageSchematic,
  fromIndex: number,
  toIndex: number
): MultiPageSchematic {
  if (
    fromIndex < 0 ||
    fromIndex >= schematic.pages.length ||
    toIndex < 0 ||
    toIndex >= schematic.pages.length
  ) {
    throw new Error('Invalid page index');
  }

  const newPages = [...schematic.pages];
  const [movedPage] = newPages.splice(fromIndex, 1);
  newPages.splice(toIndex, 0, movedPage);

  // Renumber pages
  newPages.forEach((page, index) => {
    page.number = index + 1;
  });

  return {
    ...schematic,
    pages: newPages,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Set the active page
 */
export function setActivePage(
  schematic: MultiPageSchematic,
  pageId: string
): MultiPageSchematic {
  const page = schematic.pages.find((p) => p.id === pageId);
  if (!page) {
    throw new Error('Page not found');
  }

  return {
    ...schematic,
    activePageId: pageId,
  };
}

/**
 * Get the active page
 */
export function getActivePage(schematic: MultiPageSchematic): SchematicPage {
  const page = schematic.pages.find((p) => p.id === schematic.activePageId);
  if (!page) {
    throw new Error('Active page not found');
  }
  return page;
}

/**
 * Get page by ID
 */
export function getPageById(
  schematic: MultiPageSchematic,
  pageId: string
): SchematicPage | undefined {
  return schematic.pages.find((p) => p.id === pageId);
}

/**
 * Get page by number
 */
export function getPageByNumber(
  schematic: MultiPageSchematic,
  pageNumber: number
): SchematicPage | undefined {
  return schematic.pages.find((p) => p.number === pageNumber);
}

/**
 * Get navigation info for the schematic
 */
export function getNavigationInfo(schematic: MultiPageSchematic): PageNavigationInfo {
  const activePage = getActivePage(schematic);
  const currentIndex = schematic.pages.findIndex((p) => p.id === schematic.activePageId);

  return {
    currentPage: activePage.number,
    totalPages: schematic.pages.length,
    hasNext: currentIndex < schematic.pages.length - 1,
    hasPrevious: currentIndex > 0,
    pageList: schematic.pages.map((p) => ({
      id: p.id,
      number: p.number,
      name: p.name,
    })),
  };
}

/**
 * Navigate to next page
 */
export function goToNextPage(schematic: MultiPageSchematic): MultiPageSchematic {
  const currentIndex = schematic.pages.findIndex((p) => p.id === schematic.activePageId);
  if (currentIndex < schematic.pages.length - 1) {
    return setActivePage(schematic, schematic.pages[currentIndex + 1].id);
  }
  return schematic;
}

/**
 * Navigate to previous page
 */
export function goToPreviousPage(schematic: MultiPageSchematic): MultiPageSchematic {
  const currentIndex = schematic.pages.findIndex((p) => p.id === schematic.activePageId);
  if (currentIndex > 0) {
    return setActivePage(schematic, schematic.pages[currentIndex - 1].id);
  }
  return schematic;
}

// ============================================================================
// Cross-Page Reference Functions
// ============================================================================

/**
 * Add a cross-page reference
 */
export function addPageReference(
  schematic: MultiPageSchematic,
  sourcePageId: string,
  targetPageId: string,
  localId: string,
  remoteId: string
): MultiPageSchematic {
  const sourcePageIndex = schematic.pages.findIndex((p) => p.id === sourcePageId);
  const targetPage = schematic.pages.find((p) => p.id === targetPageId);

  if (sourcePageIndex === -1 || !targetPage) {
    throw new Error('Page not found');
  }

  const outgoingRef: PageReference = {
    pageId: targetPageId,
    pageNumber: targetPage.number,
    pageName: targetPage.name,
    type: 'outgoing',
    localId,
    remoteId,
    label: `/${targetPage.number}.${remoteId}`,
  };

  const incomingRef: PageReference = {
    pageId: sourcePageId,
    pageNumber: schematic.pages[sourcePageIndex].number,
    pageName: schematic.pages[sourcePageIndex].name,
    type: 'incoming',
    localId: remoteId,
    remoteId: localId,
    label: `/${schematic.pages[sourcePageIndex].number}.${localId}`,
  };

  const newPages = [...schematic.pages];

  // Add outgoing reference to source page
  newPages[sourcePageIndex] = {
    ...newPages[sourcePageIndex],
    references: [...newPages[sourcePageIndex].references, outgoingRef],
    updatedAt: new Date().toISOString(),
  };

  // Add incoming reference to target page
  const targetPageIndex = newPages.findIndex((p) => p.id === targetPageId);
  newPages[targetPageIndex] = {
    ...newPages[targetPageIndex],
    references: [...newPages[targetPageIndex].references, incomingRef],
    updatedAt: new Date().toISOString(),
  };

  return {
    ...schematic,
    pages: newPages,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Remove a cross-page reference
 */
export function removePageReference(
  schematic: MultiPageSchematic,
  sourcePageId: string,
  localId: string
): MultiPageSchematic {
  const sourcePageIndex = schematic.pages.findIndex((p) => p.id === sourcePageId);
  if (sourcePageIndex === -1) {
    throw new Error('Page not found');
  }

  const ref = schematic.pages[sourcePageIndex].references.find(
    (r) => r.localId === localId && r.type === 'outgoing'
  );
  if (!ref) {
    return schematic;
  }

  const newPages = [...schematic.pages];

  // Remove outgoing reference from source page
  newPages[sourcePageIndex] = {
    ...newPages[sourcePageIndex],
    references: newPages[sourcePageIndex].references.filter(
      (r) => !(r.localId === localId && r.type === 'outgoing')
    ),
    updatedAt: new Date().toISOString(),
  };

  // Remove incoming reference from target page
  const targetPageIndex = newPages.findIndex((p) => p.id === ref.pageId);
  if (targetPageIndex !== -1) {
    newPages[targetPageIndex] = {
      ...newPages[targetPageIndex],
      references: newPages[targetPageIndex].references.filter(
        (r) => !(r.remoteId === localId && r.type === 'incoming')
      ),
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    ...schematic,
    pages: newPages,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Get all cross-references for a page
 */
export function getPageReferences(
  schematic: MultiPageSchematic,
  pageId: string
): { outgoing: PageReference[]; incoming: PageReference[] } {
  const page = schematic.pages.find((p) => p.id === pageId);
  if (!page) {
    return { outgoing: [], incoming: [] };
  }

  return {
    outgoing: page.references.filter((r) => r.type === 'outgoing'),
    incoming: page.references.filter((r) => r.type === 'incoming'),
  };
}

// ============================================================================
// Serialization
// ============================================================================

/**
 * Serialize schematic to JSON string
 */
export function serializeSchematic(schematic: MultiPageSchematic): string {
  return JSON.stringify(schematic, null, 2);
}

/**
 * Deserialize schematic from JSON string
 */
export function deserializeSchematic(json: string): MultiPageSchematic {
  const data = JSON.parse(json);

  // Validate basic structure
  if (!data.id || !data.pages || !Array.isArray(data.pages)) {
    throw new Error('Invalid schematic format');
  }

  return data as MultiPageSchematic;
}
