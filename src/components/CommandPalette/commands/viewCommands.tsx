/**
 * View Commands
 *
 * Commands for view operations: toggle panels, zoom, layout.
 * Uses layoutStore for state management and layoutPersistenceStore for layouts.
 */

import {
  PanelLeftClose,
  PanelRightClose,
  PanelBottomClose,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layout,
} from 'lucide-react';
import { commandRegistry } from '../commandRegistry';
import { useLayoutStore } from '../../../stores/layoutStore';
import { useLayoutPersistenceStore } from '../../../stores/layoutPersistenceStore';
import type { Command } from '../types';

/**
 * Register all view-related commands.
 */
export function registerViewCommands(): void {
  const commands: Command[] = [
    {
      id: 'view.toggleLeftPanel',
      category: 'view',
      label: 'Toggle Left Panel',
      description: 'Show or hide the left panel',
      icon: <PanelLeftClose size={16} />,
      shortcut: 'Ctrl+B',
      keywords: ['panel', 'sidebar', 'left', 'explorer'],
      execute: () => {
        useLayoutStore.getState().toggleSidebar();
      },
    },
    {
      id: 'view.toggleRightPanel',
      category: 'view',
      label: 'Toggle Right Panel',
      description: 'Show or hide the right panel',
      icon: <PanelRightClose size={16} />,
      shortcut: 'Ctrl+Alt+B',
      keywords: ['panel', 'sidebar', 'right', 'properties'],
      execute: () => {
        // Right panel toggle not yet implemented in layoutStore
        console.log('Toggle Right Panel - not yet implemented');
      },
    },
    {
      id: 'view.toggleBottomPanel',
      category: 'view',
      label: 'Toggle Bottom Panel',
      description: 'Show or hide the bottom panel',
      icon: <PanelBottomClose size={16} />,
      shortcut: 'Ctrl+J',
      keywords: ['panel', 'terminal', 'bottom', 'console'],
      execute: () => {
        useLayoutStore.getState().togglePanel();
      },
    },
    {
      id: 'view.zoomIn',
      category: 'view',
      label: 'Zoom In',
      description: 'Increase zoom level',
      icon: <ZoomIn size={16} />,
      shortcut: 'Ctrl+=',
      keywords: ['zoom', 'enlarge', 'bigger'],
      execute: () => {
        // Use browser's zoom functionality
        const currentZoom = parseFloat(document.body.style.zoom || '1');
        document.body.style.zoom = `${Math.min(currentZoom + 0.1, 2)}`;
      },
    },
    {
      id: 'view.zoomOut',
      category: 'view',
      label: 'Zoom Out',
      description: 'Decrease zoom level',
      icon: <ZoomOut size={16} />,
      shortcut: 'Ctrl+-',
      keywords: ['zoom', 'shrink', 'smaller'],
      execute: () => {
        // Use browser's zoom functionality
        const currentZoom = parseFloat(document.body.style.zoom || '1');
        document.body.style.zoom = `${Math.max(currentZoom - 0.1, 0.5)}`;
      },
    },
    {
      id: 'view.resetZoom',
      category: 'view',
      label: 'Reset Zoom',
      description: 'Reset zoom to default level',
      icon: <RotateCcw size={16} />,
      shortcut: 'Ctrl+0',
      keywords: ['zoom', 'reset', 'default'],
      execute: () => {
        document.body.style.zoom = '1';
      },
    },
    {
      id: 'view.fullScreen',
      category: 'view',
      label: 'Toggle Full Screen',
      description: 'Enter or exit full screen mode',
      icon: <Maximize2 size={16} />,
      shortcut: 'F11',
      keywords: ['fullscreen', 'maximize'],
      execute: () => {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          document.documentElement.requestFullscreen();
        }
      },
    },
    {
      id: 'view.resetLayout',
      category: 'view',
      label: 'Reset Layout',
      description: 'Reset window layout to default',
      icon: <Layout size={16} />,
      keywords: ['layout', 'reset', 'default', 'arrange'],
      execute: () => {
        useLayoutPersistenceStore.getState().resetToDefault();
        useLayoutStore.getState().resetLayout();
      },
    },
  ];

  commandRegistry.registerAll(commands);
}
