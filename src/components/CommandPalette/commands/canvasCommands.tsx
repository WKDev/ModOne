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
import { useCanvasStore } from '../../../stores/canvasStore';
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

/**
 * Calculate center position of the current viewport
 */
function getViewportCenter(): { x: number; y: number } {
  const { zoom, pan } = useCanvasStore.getState();
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
  return useCanvasStore.getState().selectedIds.size > 0;
}

/**
 * Check if alignment can be performed (need 2+ selected)
 */
function canAlignSelected(): boolean {
  return useCanvasStore.getState().selectedIds.size >= 2;
}

/**
 * Check if distribution can be performed (need 3+ selected)
 */
function canDistributeSelected(): boolean {
  return useCanvasStore.getState().selectedIds.size >= 3;
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
      id: 'canvas.addButton',
      category: 'canvas',
      label: 'Add Button Block',
      description: 'Add a pushbutton block to the canvas',
      icon: <Circle size={16} />,
      keywords: ['button', 'pushbutton', 'input', 'add', 'block'],
      execute: () => {
        const pos = getViewportCenter();
        useCanvasStore.getState().addComponent('button', pos);
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
        useCanvasStore.getState().addComponent('led', pos);
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
        useCanvasStore.getState().addComponent('scope', pos);
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
        useCanvasStore.getState().addComponent('plc_in', pos);
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
        useCanvasStore.getState().addComponent('plc_out', pos);
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
        const { zoom, setZoom } = useCanvasStore.getState();
        setZoom(Math.min(zoom * 1.2, 4.0));
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
        const { zoom, setZoom } = useCanvasStore.getState();
        setZoom(Math.max(zoom / 1.2, 0.1));
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
        useCanvasStore.getState().setZoom(1.0);
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
        useCanvasStore.getState().toggleGrid();
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
        useCanvasStore.getState().toggleSnap();
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
        const { selectedIds, removeComponent } = useCanvasStore.getState();
        selectedIds.forEach((id) => removeComponent(id));
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
        useCanvasStore.getState().selectAll();
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
        useCanvasStore.getState().alignSelected('left');
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
        useCanvasStore.getState().alignSelected('right');
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
        useCanvasStore.getState().alignSelected('top');
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
        useCanvasStore.getState().alignSelected('bottom');
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
        useCanvasStore.getState().distributeSelected('horizontal');
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
        useCanvasStore.getState().distributeSelected('vertical');
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
          const { components } = useCanvasStore.getState();
          const bom = generateBom(components);
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
