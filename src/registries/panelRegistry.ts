/**
 * Panel Registry — Single Source of Truth
 *
 * Centralizes all panel metadata: component mapping, labels, zone classification,
 * and document type associations. Uses `satisfies` to guarantee compile-time
 * exhaustiveness — adding a new PanelType without registering it here causes
 * a type error.
 */

import type { ComponentType } from 'react';
import type { PanelType, PanelZone } from '../types/panel';
import type { DocumentType } from '../types/document';

// Lazy imports to avoid circular dependencies and improve code-splitting
import { LadderEditorPanel } from '../components/panels/content/LadderEditorPanel';
import { MemoryVisualizerPanel } from '../components/panels/content/MemoryVisualizerPanel';
import { OneCanvasPanel } from '../components/panels/content/OneCanvasPanel';
import { ScenarioEditorPanel } from '../components/panels/content/ScenarioEditorPanel';
import { ConsolePanel } from '../components/panels/content/ConsolePanel';
import { PropertiesPanel } from '../components/panels/content/PropertiesPanel';
import { CsvViewerPanel } from '../components/panels/content/CsvViewerPanel';
import { SheetEditorPanel } from '../components/panels/content/SheetEditorPanel';
import { SettingsPanel } from '../components/panels/content/SettingsPanel';
import { SymbolEditorPanel } from '../components/panels/content/SymbolEditorPanel';
import { TagBrowserPanel } from '../components/panels/content/TagBrowserPanel';
import { WelcomePanel } from '../components/panels/content/WelcomePanel';
import { ProjectSettingsPanel } from '../components/panels/content/ProjectSettingsPanel';
import { OpcUaServerPanel } from '../components/panels/content/OpcUaServerPanel';

export interface PanelRegistration {
  label: string;
  zone: PanelZone;
  component: ComponentType<{ data?: unknown }>;
  /** Only set for panels backed by a document (canvas, ladder, scenario). */
  documentType?: DocumentType;
}

/**
 * Canonical panel registry.
 *
 * `satisfies Record<PanelType, PanelRegistration>` ensures every PanelType
 * variant is present. If you add a new PanelType to `src/types/panel.ts`,
 * TypeScript will error here until you register it.
 */
const registry = {
  'ladder-editor': {
    label: 'Ladder Editor',
    zone: 'editor',
    component: LadderEditorPanel,
    documentType: 'ladder',
  },
  'memory-visualizer': {
    label: 'Memory Visualizer',
    zone: 'tool',
    component: MemoryVisualizerPanel,
  },
  'one-canvas': {
    label: 'One Canvas',
    zone: 'editor',
    component: OneCanvasPanel,
    documentType: 'canvas',
  },
  'scenario-editor': {
    label: 'Scenario Editor',
    zone: 'editor',
    component: ScenarioEditorPanel,
    documentType: 'scenario',
  },
  'console': {
    label: 'Console',
    zone: 'tool',
    component: ConsolePanel,
  },
  'properties': {
    label: 'Properties',
    zone: 'tool',
    component: PropertiesPanel,
  },
  'csv-viewer': {
    label: 'CSV Viewer',
    zone: 'editor',
    component: CsvViewerPanel,
  },
  'sheet-editor': {
    label: 'Sheet Editor',
    zone: 'editor',
    component: SheetEditorPanel,
  },
  'settings': {
    label: 'Settings',
    zone: 'editor',
    component: SettingsPanel,
  },
  'project-settings': {
    label: 'Project Settings',
    zone: 'editor',
    component: ProjectSettingsPanel,
  },
  'symbol-editor': {
    label: 'Symbol Editor',
    zone: 'editor',
    component: SymbolEditorPanel,
  },
  'tag-browser': {
    label: 'Tag Browser',
    zone: 'editor',
    component: TagBrowserPanel,
  },
  'welcome': {
    label: 'Welcome',
    zone: 'editor',
    component: WelcomePanel,
  },
  'opcua-server': {
    label: 'OPC UA Server',
    zone: 'editor',
    component: OpcUaServerPanel,
  },
} satisfies Record<PanelType, PanelRegistration>;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Get the React component for a given panel type. */
export function getComponent(type: PanelType): ComponentType<{ data?: unknown }> {
  return registry[type].component;
}

/** Get the human-readable label for a given panel type. */
export function getLabel(type: PanelType): string {
  return registry[type].label;
}

/** Get the zone ('editor' | 'tool') for a given panel type. */
export function getPanelZone(type: PanelType): PanelZone {
  return registry[type].zone;
}

/** Get the associated document type, if any. */
export function getDocumentType(type: PanelType): DocumentType | undefined {
  return (registry[type] as PanelRegistration).documentType;
}

// Pre-computed zone lists (computed once at module load)
const toolTypes: PanelType[] = (Object.keys(registry) as PanelType[]).filter(
  (t) => registry[t].zone === 'tool',
);
const editorTypes: PanelType[] = (Object.keys(registry) as PanelType[]).filter(
  (t) => registry[t].zone === 'editor',
);

/** Panel types that belong to the tool zone (bottom panel). */
export function getToolPanelTypes(): PanelType[] {
  return toolTypes;
}

/** Panel types that belong to the editor zone (main area). */
export function getEditorPanelTypes(): PanelType[] {
  return editorTypes;
}

/**
 * Full labels record — backward-compatible drop-in for PANEL_TYPE_LABELS.
 * Prefer `getLabel(type)` for single lookups.
 */
export const PANEL_TYPE_LABELS: Record<PanelType, string> = Object.fromEntries(
  (Object.keys(registry) as PanelType[]).map((t) => [t, registry[t].label]),
) as Record<PanelType, string>;
