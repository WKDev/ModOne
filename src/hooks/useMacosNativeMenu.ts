/**
 * useMacosNativeMenu Hook
 *
 * Bridges native macOS menu events to frontend actions.
 * Listens for "native-menu-command" Tauri events emitted by Rust's
 * on_menu_event handler (see src-tauri/src/lib.rs) and dispatches
 * them to the appropriate frontend action — either commandRegistry.execute()
 * or a special service call for items that bypass the command registry.
 *
 * Only activates on macOS; is a no-op on other platforms.
 */

import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { commandRegistry } from '../components/CommandPalette/commandRegistry';
import { projectDialogService } from '../services/projectDialogService';
import { fileDialogService } from '../services/fileDialogService';
import { importService } from '../services/importService';
import { useLayoutStore } from '../stores/layoutStore';

// ============================================================================
// Platform detection (computed once at module load)
// ============================================================================

const IS_MAC = navigator.userAgent.includes('Mac');

// ============================================================================
// Hook
// ============================================================================

export function useMacosNativeMenu(): void {
  useEffect(() => {
    if (!IS_MAC) return;

    let unlisten: (() => void) | undefined;

    const setup = async () => {
      unlisten = await listen<string>('native-menu-command', (event) => {
        const commandId = event.payload;
        handleMenuCommand(commandId);
      });
    };

    setup();

    return () => {
      unlisten?.();
    };
  }, []);
}

// ============================================================================
// Command handler
// ============================================================================

/**
 * Maps a native menu command ID to the corresponding frontend action.
 *
 * Special cases replicate the exact same calls that MenuBar.tsx makes for
 * each item. All other IDs are forwarded to commandRegistry.execute().
 */
function handleMenuCommand(commandId: string): void {
  switch (commandId) {
    // ── File: project operations (bypass commandRegistry — use services) ──
    case 'file.new':
      projectDialogService.requestNewProject();
      break;
    case 'file.open':
      projectDialogService.requestOpenProject();
      break;

    // ── File: new document types ──
    case 'file.add.newCanvas':
      fileDialogService.requestNewCanvas();
      break;
    case 'file.add.newLadder':
      fileDialogService.requestNewLadder();
      break;
    case 'file.add.newScenario':
      fileDialogService.requestNewScenario();
      break;

    // ── File: import ──
    case 'file.import.xg5000':
      importService.requestImportXG5000();
      break;

    // ── File: exit ──
    case 'file.exit':
      getCurrentWindow()
        .destroy()
        .catch((err) => {
          console.error('Failed to close window from native menu:', err);
        });
      break;

    // ── View: panel toggles (need direct store access) ──
    case 'view.panel.output': {
      const store = useLayoutStore.getState();
      store.setPanelType('output');
      if (!store.panelVisible) {
        store.togglePanel();
      }
      break;
    }
    case 'view.panel.problems': {
      const store = useLayoutStore.getState();
      store.setPanelType('problems');
      if (!store.panelVisible) {
        store.togglePanel();
      }
      break;
    }
    case 'view.panel.terminal': {
      const store = useLayoutStore.getState();
      store.setPanelType('terminal');
      if (!store.panelVisible) {
        store.togglePanel();
      }
      break;
    }

    // ── No-op items (disabled/informational) ──
    case 'file.recent.none':
    case 'view.layouts.placeholder':
    case 'help.documentation':
    case 'help.about':
    case 'modbus.serverSettings':
      // These items have no action in the JS MenuBar either; silently ignore.
      break;

    // ── Default: delegate to commandRegistry ──
    // Covers: file.save, file.saveAs, file.saveAll, edit.undo, edit.redo,
    //         edit.cut, edit.copy, edit.paste, settings.open,
    //         view.toggleLeftPanel, view.zoomIn, view.zoomOut,
    //         simulation.start, simulation.stop, simulation.pause,
    //         simulation.step, simulation.reset,
    //         modbus.startTcp, modbus.stopTcp, modbus.startRtu,
    //         modbus.stopRtu, modbus.status
    default:
      commandRegistry.execute(commandId).catch((err) => {
        console.error(`Error executing command from native menu (${commandId}):`, err);
      });
  }
}

export default useMacosNativeMenu;
