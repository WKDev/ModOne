/**
 * Canvas Commands
 *
 * Commands for OneCanvas operations: blocks, view, editing, export.
 */

import {
  Circle,
  Lightbulb,
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid3X3,
  Magnet,
  Trash2,
  BoxSelect,
  AlignStartVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignEndHorizontal,
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
  Download,
  FileSpreadsheet,
  Printer,
} from 'lucide-react';
import { commandRegistry } from '../commandRegistry';
import { useDocumentRegistry } from '../../../stores/documentRegistry';
import { useEditorAreaStore } from '../../../stores/editorAreaStore';
import { isCanvasDocument } from '../../../types/document';
import type { CanvasDocumentData } from '../../../types/document';
import type { BlockType, Block } from '../../OneCanvas/types';
import { getBlockSize, getDefaultPorts, getDefaultBlockProps, getPowerSourcePorts } from '../../OneCanvas/blockDefinitions';
import { generateId, snapToGridPosition } from '../../OneCanvas/utils/canvasHelpers';
import { alignComponents, distributeComponents } from '../../OneCanvas/utils/canvas-commands';
import {
  exportToPng,
  downloadBlob,
  downloadText,
  generateBom,
  bomToCsv,
} from '../../OneCanvas/utils';
import type { Command } from '../types';

// ============================================================================
// Helpers
// ============================================================================

function getActiveCanvasDocumentId(): string | null {
  const { tabs, activeTabId } = useEditorAreaStore.getState();
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const documentId = activeTab?.data?.documentId;
  return typeof documentId === 'string' ? documentId : null;
}

function withActiveCanvasData(
  updater: (data: CanvasDocumentData) => void,
  options?: { pushHistory?: boolean }
): boolean {
  const documentId = getActiveCanvasDocumentId();
  if (!documentId) return false;

  const registry = useDocumentRegistry.getState();
  const doc = registry.documents.get(documentId);
  if (!doc || !isCanvasDocument(doc)) return false;

  if (options?.pushHistory !== false) {
    registry.pushHistory(documentId);
  }
  registry.updateCanvasData(documentId, updater);
  return true;
}

function getActiveCanvasSnapshot() {
  const documentId = getActiveCanvasDocumentId();
  if (!documentId) return null;

  const doc = useDocumentRegistry.getState().documents.get(documentId);
  if (!doc || !isCanvasDocument(doc)) return null;

  return {
    documentId,
    data: doc.data,
  };
}

function getSelectedComponentIds(): Set<string> {
  const snapshot = getActiveCanvasSnapshot();
  if (!snapshot) return new Set();

  const selected = new Set<string>();
  snapshot.data.components.forEach((component, id) => {
    if (component.selected) {
      selected.add(id);
    }
  });
  return selected;
}

function addComponent(type: BlockType, position: { x: number; y: number }) {
  withActiveCanvasData((docData) => {
    const id = generateId(type);
    const finalPosition = docData.snapToGrid
      ? snapToGridPosition(position, docData.gridSize)
      : position;

    let ports = getDefaultPorts(type);
    if (type === 'powersource') {
      ports = getPowerSourcePorts('positive');
    }

    const newBlock: Block = {
      id,
      type,
      position: finalPosition,
      size: getBlockSize(type),
      ports,
      ...getDefaultBlockProps(type),
    } as Block;

    docData.components.set(id, newBlock);
  });
}

/**
 * Calculate center position of the current viewport
 */
function getViewportCenter(): { x: number; y: number } {
  const snapshot = getActiveCanvasSnapshot();
  const zoom = snapshot?.data.zoom ?? 1;
  const pan = snapshot?.data.pan ?? { x: 0, y: 0 };
  // Approximate viewport size - commands don't have access to container dimensions
  // Use a reasonable default centered position
  const viewWidth = 800;
  const viewHeight = 600;
  return {
    x: -pan.x + viewWidth / 2 / zoom,
    y: -pan.y + viewHeight / 2 / zoom,
  };
}

/**
 * Check if there are selected items
 */
function hasSelection(): boolean {
  return getSelectedComponentIds().size > 0;
}

/**
 * Check if alignment can be performed (need 2+ selected)
 */
function canAlignSelected(): boolean {
  return getSelectedComponentIds().size >= 2;
}

/**
 * Check if distribution can be performed (need 3+ selected)
 */
function canDistributeSelected(): boolean {
  return getSelectedComponentIds().size >= 3;
}

// ============================================================================
// Command Definitions
// ============================================================================

/**
 * Register all canvas-related commands.
 */
export function registerCanvasCommands(): void {
  const commands: Command[] = [
    // ========================================================================
    // Block Addition Commands
    // ========================================================================
    {
      id: 'canvas.openSymbolEditor',
      category: 'canvas',
      label: 'Open Symbol Editor',
      description: 'Open the Symbol Editor in a new tab',
      keywords: ['symbol', 'editor', 'custom'],
      execute: () => {
        const { tabs, addTab, setActiveTab } = useEditorAreaStore.getState();
        const existingTab = tabs.find((tab) => tab.panelType === 'symbol-editor');
        if (existingTab) {
          setActiveTab(existingTab.id);
          return;
        }
        addTab('symbol-editor', 'Symbol Editor');
      },
    },
    {
      id: 'canvas.addButton',
      category: 'canvas',
      label: 'Add Button Block',
      description: 'Add a pushbutton block to the canvas',
      icon: <Circle size={16} />,
      keywords: ['button', 'pushbutton', 'input', 'add', 'block'],
      execute: () => {
        const pos = getViewportCenter();
        addComponent('button', pos);
      },
    },
    {
      id: 'canvas.addLed',
      category: 'canvas',
      label: 'Add LED Block',
      description: 'Add an LED indicator block to the canvas',
      icon: <Lightbulb size={16} />,
      keywords: ['led', 'light', 'indicator', 'output', 'add', 'block'],
      execute: () => {
        const pos = getViewportCenter();
        addComponent('led', pos);
      },
    },
    {
      id: 'canvas.addScope',
      category: 'canvas',
      label: 'Add Scope Block',
      description: 'Add an oscilloscope block to the canvas',
      icon: <Activity size={16} />,
      keywords: ['scope', 'oscilloscope', 'waveform', 'monitor', 'add', 'block'],
      execute: () => {
        const pos = getViewportCenter();
        addComponent('scope', pos);
      },
    },
    {
      id: 'canvas.addPlcIn',
      category: 'canvas',
      label: 'Add PLC Input Block',
      description: 'Add a PLC digital input block to the canvas',
      icon: <ArrowDownToLine size={16} />,
      keywords: ['plc', 'input', 'di', 'digital', 'add', 'block'],
      execute: () => {
        const pos = getViewportCenter();
        addComponent('plc_in', pos);
      },
    },
    {
      id: 'canvas.addPlcOut',
      category: 'canvas',
      label: 'Add PLC Output Block',
      description: 'Add a PLC digital output block to the canvas',
      icon: <ArrowUpFromLine size={16} />,
      keywords: ['plc', 'output', 'do', 'digital', 'add', 'block'],
      execute: () => {
        const pos = getViewportCenter();
        addComponent('plc_out', pos);
      },
    },

    // ========================================================================
    // View Commands
    // ========================================================================
    {
      id: 'canvas.zoomIn',
      category: 'canvas',
      label: 'Zoom In',
      description: 'Zoom in on the canvas',
      icon: <ZoomIn size={16} />,
      shortcut: 'Ctrl++',
      keywords: ['zoom', 'in', 'magnify', 'larger'],
      execute: () => {
        withActiveCanvasData((data) => {
          data.zoom = Math.min(data.zoom * 1.2, 4.0);
        }, { pushHistory: false });
      },
    },
    {
      id: 'canvas.zoomOut',
      category: 'canvas',
      label: 'Zoom Out',
      description: 'Zoom out on the canvas',
      icon: <ZoomOut size={16} />,
      shortcut: 'Ctrl+-',
      keywords: ['zoom', 'out', 'smaller'],
      execute: () => {
        withActiveCanvasData((data) => {
          data.zoom = Math.max(data.zoom / 1.2, 0.1);
        }, { pushHistory: false });
      },
    },
    {
      id: 'canvas.zoomReset',
      category: 'canvas',
      label: 'Reset Zoom',
      description: 'Reset zoom to 100%',
      icon: <Maximize2 size={16} />,
      shortcut: 'Ctrl+0',
      keywords: ['zoom', 'reset', '100%', 'default'],
      execute: () => {
        withActiveCanvasData((data) => {
          data.zoom = 1.0;
        }, { pushHistory: false });
      },
    },
    {
      id: 'canvas.toggleGrid',
      category: 'canvas',
      label: 'Toggle Grid',
      description: 'Show or hide the canvas grid',
      icon: <Grid3X3 size={16} />,
      keywords: ['grid', 'toggle', 'show', 'hide', 'lines'],
      execute: () => {
        withActiveCanvasData((data) => {
          data.showGrid = !data.showGrid;
        }, { pushHistory: false });
      },
    },
    {
      id: 'canvas.toggleSnap',
      category: 'canvas',
      label: 'Toggle Snap to Grid',
      description: 'Enable or disable snapping to grid',
      icon: <Magnet size={16} />,
      keywords: ['snap', 'grid', 'toggle', 'align'],
      execute: () => {
        withActiveCanvasData((data) => {
          data.snapToGrid = !data.snapToGrid;
        }, { pushHistory: false });
      },
    },

    // ========================================================================
    // Edit Commands
    // ========================================================================
    {
      id: 'canvas.delete',
      category: 'canvas',
      label: 'Delete Selected',
      description: 'Delete all selected blocks',
      icon: <Trash2 size={16} />,
      shortcut: 'Delete',
      keywords: ['delete', 'remove', 'clear', 'selected'],
      when: hasSelection,
      execute: () => {
        const selectedIds = getSelectedComponentIds();
        withActiveCanvasData((data) => {
          selectedIds.forEach((id) => {
            data.components.delete(id);
          });
          data.wires = data.wires.filter(
            (wire) =>
              !(("componentId" in wire.from && selectedIds.has(wire.from.componentId)) ||
                ("componentId" in wire.to && selectedIds.has(wire.to.componentId)))
          );
        });
      },
    },
    {
      id: 'canvas.selectAll',
      category: 'canvas',
      label: 'Select All Blocks',
      description: 'Select all blocks on the canvas',
      icon: <BoxSelect size={16} />,
      shortcut: 'Ctrl+A',
      keywords: ['select', 'all', 'blocks'],
      execute: () => {
        withActiveCanvasData((data) => {
          data.components.forEach((component, id) => {
            if (!component.selected) {
              data.components.set(id, { ...component, selected: true });
            }
          });
        }, { pushHistory: false });
      },
    },
    {
      id: 'canvas.alignLeft',
      category: 'canvas',
      label: 'Align Left',
      description: 'Align selected blocks to the left',
      icon: <AlignStartVertical size={16} />,
      keywords: ['align', 'left', 'blocks'],
      when: canAlignSelected,
      execute: () => {
        const selectedIds = getSelectedComponentIds();
        withActiveCanvasData((data) => {
          data.components = alignComponents(data.components, selectedIds, 'left');
        });
      },
    },
    {
      id: 'canvas.alignRight',
      category: 'canvas',
      label: 'Align Right',
      description: 'Align selected blocks to the right',
      icon: <AlignEndVertical size={16} />,
      keywords: ['align', 'right', 'blocks'],
      when: canAlignSelected,
      execute: () => {
        const selectedIds = getSelectedComponentIds();
        withActiveCanvasData((data) => {
          data.components = alignComponents(data.components, selectedIds, 'right');
        });
      },
    },
    {
      id: 'canvas.alignTop',
      category: 'canvas',
      label: 'Align Top',
      description: 'Align selected blocks to the top',
      icon: <AlignStartHorizontal size={16} />,
      keywords: ['align', 'top', 'blocks'],
      when: canAlignSelected,
      execute: () => {
        const selectedIds = getSelectedComponentIds();
        withActiveCanvasData((data) => {
          data.components = alignComponents(data.components, selectedIds, 'top');
        });
      },
    },
    {
      id: 'canvas.alignBottom',
      category: 'canvas',
      label: 'Align Bottom',
      description: 'Align selected blocks to the bottom',
      icon: <AlignEndHorizontal size={16} />,
      keywords: ['align', 'bottom', 'blocks'],
      when: canAlignSelected,
      execute: () => {
        const selectedIds = getSelectedComponentIds();
        withActiveCanvasData((data) => {
          data.components = alignComponents(data.components, selectedIds, 'bottom');
        });
      },
    },
    {
      id: 'canvas.distributeH',
      category: 'canvas',
      label: 'Distribute Horizontally',
      description: 'Distribute selected blocks evenly horizontally',
      icon: <AlignHorizontalSpaceAround size={16} />,
      keywords: ['distribute', 'horizontal', 'space', 'even', 'blocks'],
      when: canDistributeSelected,
      execute: () => {
        const selectedIds = getSelectedComponentIds();
        withActiveCanvasData((data) => {
          data.components = distributeComponents(data.components, selectedIds, 'horizontal');
        });
      },
    },
    {
      id: 'canvas.distributeV',
      category: 'canvas',
      label: 'Distribute Vertically',
      description: 'Distribute selected blocks evenly vertically',
      icon: <AlignVerticalSpaceAround size={16} />,
      keywords: ['distribute', 'vertical', 'space', 'even', 'blocks'],
      when: canDistributeSelected,
      execute: () => {
        const selectedIds = getSelectedComponentIds();
        withActiveCanvasData((data) => {
          data.components = distributeComponents(data.components, selectedIds, 'vertical');
        });
      },
    },

    // ========================================================================
    // Export Commands
    // ========================================================================
    {
      id: 'canvas.exportPng',
      category: 'canvas',
      label: 'Export as PNG',
      description: 'Export the canvas as a PNG image',
      icon: <Download size={16} />,
      keywords: ['export', 'png', 'image', 'download', 'save'],
      execute: async () => {
        try {
          // Find the canvas container
          const container = document.querySelector('[data-canvas-container]') as HTMLElement;
          if (!container) {
            console.error('Canvas container not found');
            return;
          }
          const blob = await exportToPng(container, { scale: 2 });
          downloadBlob(blob, 'canvas.png');
        } catch (error) {
          console.error('Failed to export PNG:', error);
        }
      },
    },
    {
      id: 'canvas.exportBom',
      category: 'canvas',
      label: 'Export Bill of Materials',
      description: 'Export a CSV file with all components',
      icon: <FileSpreadsheet size={16} />,
      keywords: ['export', 'bom', 'bill', 'materials', 'csv', 'components'],
      execute: () => {
        try {
          const snapshot = getActiveCanvasSnapshot();
          if (!snapshot) return;
          const bom = generateBom(snapshot.data.components);
          const csv = bomToCsv(bom);
          downloadText(csv, 'bom.csv', 'text/csv');
        } catch (error) {
          console.error('Failed to export BOM:', error);
        }
      },
    },
    {
      id: 'canvas.print',
      category: 'canvas',
      label: 'Print Canvas',
      description: 'Open print dialog for the canvas',
      icon: <Printer size={16} />,
      shortcut: 'Ctrl+P',
      keywords: ['print', 'canvas', 'paper'],
      execute: () => {
        // Use browser print functionality
        window.print();
      },
    },
  ];

  commandRegistry.registerAll(commands);
}
