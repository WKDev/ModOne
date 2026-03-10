import {
  Square,
  Circle,
  Minus,
  ArrowRight,
  PlusSquare,
  MinusSquare,
  ArrowUp,
  ArrowDown,
  Box,
  Trash2,
  Edit2,
  GitBranch,
  Copy,
  Scissors,
  Clipboard
} from 'lucide-react';
import { commandRegistry } from '../commandRegistry';
import { useLadderUIStore } from '../../../stores/ladderUIStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { useEditorAreaStore } from '../../../stores/editorAreaStore';
import { useDocumentRegistry } from '../../../stores/documentRegistry';
import { ladderActions } from '../../LadderEditor/utils/ladderActions';
import type { Command } from '../types';
import type { LadderShortcutProfile } from '../../../types/settings';

/**
 * Get active ladder document ID based on current active tab
 */
function getActiveLadderDocumentId(): string | null {
  const activeTabId = useEditorAreaStore.getState().activeTabId;
  if (!activeTabId) return null;
  const documents = useDocumentRegistry.getState().documents;
  for (const doc of documents.values()) {
    if (doc.tabId === activeTabId && doc.type === 'ladder') {
      return doc.id;
    }
  }
  return null;
}

/**
 * Get profile-based default shortcuts
 */
function getLadderDefaults(profile: LadderShortcutProfile): Record<string, string> {
  if (profile === 'xg5000') {
    return {
      'ladder.addContactNO': 'F3',
      'ladder.addContactNC': 'F4',
      'ladder.addContactP': 'Shift+F1',
      'ladder.addContactPNC': 'Ctrl+Shift+A',
      'ladder.addContactN': 'Shift+F2',
      'ladder.addContactNNC': 'Ctrl+Shift+S',
      'ladder.addWireH': 'F5',
      'ladder.addWireV': 'F6',
      'ladder.addWireHFill': 'Shift+F8',
      'ladder.addContactReverse': 'Shift+F9',
      'ladder.addCoil': 'F9',
      'ladder.addCoilNC': 'F11',
      'ladder.addCoilSet': 'Shift+F3',
      'ladder.addCoilReset': 'Shift+F4',
      'ladder.addCoilP': 'Shift+F5',
      'ladder.addCoilN': 'Shift+F6',
      'ladder.addFunction': 'F10',
      'ladder.editLine': 'F10',
      'ladder.deleteLine': 'Alt+F9',
    };
  } else if (profile === 'gxworks') {
    return {
      'ladder.addContactNO': 'F5',
      'ladder.addContactNC': 'F6',
      'ladder.addContactP': 'Shift+F7',
      'ladder.addContactPNC': 'Shift+Alt+F5',
      'ladder.addContactN': 'Shift+F8',
      'ladder.addContactNNC': 'Shift+Alt+F6',
      'ladder.addWireH': 'F9',
      'ladder.addWireV': 'Shift+F9',
      'ladder.addCoil': 'F7',
      'ladder.addFunction': 'F8',
      'ladder.addCoilP': 'Alt+F5',
      'ladder.addCoilN': 'Ctrl+Alt+F5',
      'ladder.deleteWireH': 'Ctrl+F9',
      'ladder.deleteWireV': 'Ctrl+F10',
      'ladder.invertResults': 'Ctrl+Alt+F10',
    };
  }

  // Default profile (Generic)
  return {
    'ladder.addContactNO': 'F3',
    'ladder.addContactNC': 'F4',
    'ladder.addCoil': 'F9',
    'ladder.addWireH': 'F5',
  };
}

/**
 * Register all ladder editor commands.
 */
export function registerLadderCommands(): void {
  const profile = useSettingsStore.getState().getMergedSettings().ladderShortcutProfile;
  const defaults = getLadderDefaults(profile);

  const commands: Command[] = [
    // --- Contacts ---
    {
      id: 'ladder.addContactNO',
      category: 'ladder',
      label: 'NO Contact',
      description: 'Add a Normally Open contact',
      icon: <Square size={16} />,
      execute: () => useLadderUIStore.getState().setActiveTool('contact_no'),
    },
    {
      id: 'ladder.addContactNC',
      category: 'ladder',
      label: 'NC Contact',
      description: 'Add a Normally Closed contact',
      icon: <MinusSquare size={16} />,
      execute: () => useLadderUIStore.getState().setActiveTool('contact_nc'),
    },
    {
      id: 'ladder.addContactP',
      category: 'ladder',
      label: 'Rising Pulse (P)',
      description: 'Add a rising edge transition contact',
      icon: <ArrowUp size={16} />,
      shortcut: defaults['ladder.addContactP'],
      execute: () => useLadderUIStore.getState().setActiveTool('contact_p'),
    },
    {
      id: 'ladder.addContactPNC',
      category: 'ladder',
      label: 'NC Rising Pulse (P/)',
      description: 'Add a normally closed rising edge transition contact',
      shortcut: defaults['ladder.addContactPNC'],
      execute: () => useLadderUIStore.getState().setActiveTool('contact_p_nc'),
    },
    {
      id: 'ladder.addContactN',
      category: 'ladder',
      label: 'Falling Pulse (N)',
      description: 'Add a falling edge transition contact',
      icon: <ArrowDown size={16} />,
      shortcut: defaults['ladder.addContactN'],
      execute: () => useLadderUIStore.getState().setActiveTool('contact_n'),
    },
    {
      id: 'ladder.addContactNNC',
      category: 'ladder',
      label: 'NC Falling Pulse (N/)',
      description: 'Add a normally closed falling edge transition contact',
      shortcut: defaults['ladder.addContactNNC'],
      execute: () => useLadderUIStore.getState().setActiveTool('contact_n_nc'),
    },
    {
      id: 'ladder.addContactReverse',
      category: 'ladder',
      label: 'Reverse Contact',
      description: 'Add a reverse contact (*)',
      icon: <GitBranch size={16} />,
      shortcut: defaults['ladder.addContactReverse'],
      execute: () => useLadderUIStore.getState().setActiveTool('contact_reverse'),
    },
    {
      id: 'ladder.invertResults',
      category: 'ladder',
      label: 'Invert Results',
      description: 'Invert operation results',
      icon: <GitBranch size={16} />,
      shortcut: defaults['ladder.invertResults'],
      execute: () => useLadderUIStore.getState().setActiveTool('contact_inv'),
    },

    // --- Coils ---
    {
      id: 'ladder.addCoil',
      category: 'ladder',
      label: 'Coil',
      description: 'Add an output coil',
      icon: <Circle size={16} />,
      execute: () => useLadderUIStore.getState().setActiveTool('coil'),
    },
    {
      id: 'ladder.addCoilNC',
      category: 'ladder',
      label: 'NC Coil',
      description: 'Add a normally closed output coil',
      shortcut: defaults['ladder.addCoilNC'],
      execute: () => useLadderUIStore.getState().setActiveTool('coil_inverted'),
    },
    {
      id: 'ladder.addCoilSet',
      category: 'ladder',
      label: 'SET Coil',
      description: 'Add a SET coil',
      icon: <PlusSquare size={16} />,
      shortcut: defaults['ladder.addCoilSet'],
      execute: () => useLadderUIStore.getState().setActiveTool('coil_set'),
    },
    {
      id: 'ladder.addCoilReset',
      category: 'ladder',
      label: 'RESET Coil',
      description: 'Add a RESET coil',
      icon: <MinusSquare size={16} />,
      shortcut: defaults['ladder.addCoilReset'],
      execute: () => useLadderUIStore.getState().setActiveTool('coil_reset'),
    },
    {
      id: 'ladder.addCoilP',
      category: 'ladder',
      label: 'Rising Edge Coil',
      description: 'Add a rising edge output coil',
      shortcut: defaults['ladder.addCoilP'],
      execute: () => useLadderUIStore.getState().setActiveTool('coil_p'),
    },
    {
      id: 'ladder.addCoilN',
      category: 'ladder',
      label: 'Falling Edge Coil',
      description: 'Add a falling edge output coil',
      shortcut: defaults['ladder.addCoilN'],
      execute: () => useLadderUIStore.getState().setActiveTool('coil_n'),
    },

    // --- Lines ---
    {
      id: 'ladder.addWireH',
      category: 'ladder',
      label: 'Horizontal Line',
      description: 'Add a horizontal connection line',
      icon: <Minus size={16} />,
      execute: () => useLadderUIStore.getState().setActiveTool('wire_h'),
    },
    {
      id: 'ladder.addWireV',
      category: 'ladder',
      label: 'Vertical Line',
      description: 'Add a vertical connection line',
      icon: <Minus className="rotate-90" size={16} />,
      execute: () => useLadderUIStore.getState().setActiveTool('wire_v'),
    },
    {
      id: 'ladder.addWireHFill',
      category: 'ladder',
      label: 'Fill Horizontal Line',
      description: 'Fill horizontal line to the right',
      icon: <ArrowRight size={16} />,
      shortcut: defaults['ladder.addWireHFill'],
      execute: () => {
        // TODO: Implement fill logic if needed, or just set tool
        useLadderUIStore.getState().setActiveTool('wire_h');
      },
    },

    // --- Others ---
    {
      id: 'ladder.addFunction',
      category: 'ladder',
      label: 'Function / FB',
      description: 'Add a function or function block',
      icon: <Box size={16} />,
      shortcut: defaults['ladder.addFunction'],
      execute: () => {
        // Placeholder for function block tool
      },
    },
    {
      id: 'ladder.editLine',
      category: 'ladder',
      label: 'Edit Line',
      description: 'Edit current line/instruction',
      icon: <Edit2 size={16} />,
      shortcut: defaults['ladder.editLine'],
      execute: () => {
        // Logic for opening editor for current cursor
      },
    },
    {
      id: 'ladder.deleteLine',
      category: 'ladder',
      label: 'Delete Line',
      description: 'Delete current line/rung',
      icon: <Trash2 size={16} />,
      shortcut: defaults['ladder.deleteLine'],
      execute: () => {
        // Logic for deleting current rung
      },
    },

    {
      id: 'ladder.cutSelection',
      category: 'ladder',
      label: 'Cut Selection',
      description: 'Cut selected elements to clipboard',
      icon: <Scissors size={16} />,
      shortcut: 'Ctrl+X',
      execute: () => {
        const docId = getActiveLadderDocumentId();
        if (docId) ladderActions.cutSelected(docId);
      },
    },
    {
      id: 'ladder.copySelection',
      category: 'ladder',
      label: 'Copy Selection',
      description: 'Copy selected elements to clipboard',
      icon: <Copy size={16} />,
      shortcut: 'Ctrl+C',
      execute: () => {
        const docId = getActiveLadderDocumentId();
        if (docId) ladderActions.copySelected(docId);
      },
    },
    {
      id: 'ladder.pasteFromClipboard',
      category: 'ladder',
      label: 'Paste',
      description: 'Paste elements from clipboard',
      icon: <Clipboard size={16} />,
      shortcut: 'Ctrl+V',
      execute: () => {
        const docId = getActiveLadderDocumentId();
        if (docId) ladderActions.pasteFromClipboard(docId);
      },
    },
    {
      id: 'ladder.duplicateSelection',
      category: 'ladder',
      label: 'Duplicate',
      description: 'Duplicate selected elements',
      shortcut: 'Ctrl+D',
      execute: () => {
        const docId = getActiveLadderDocumentId();
        if (docId) ladderActions.duplicateSelected(docId);
      },
    },
    {
      id: 'ladder.selectAll',
      category: 'ladder',
      label: 'Select All',
      description: 'Select all elements',
      shortcut: 'Ctrl+A',
      execute: () => {
        const docId = getActiveLadderDocumentId();
        if (docId) ladderActions.selectAll(docId);
      },
    },
    {
      id: 'ladder.deleteSelected',
      category: 'ladder',
      label: 'Delete',
      description: 'Delete selected elements',
      icon: <Trash2 size={16} />,
      shortcut: 'Delete',
      execute: () => {
        const docId = getActiveLadderDocumentId();
        if (docId) ladderActions.deleteSelected(docId);
      },
    },
    {
      id: 'ladder.clearSelection',
      category: 'ladder',
      label: 'Clear Selection',
      description: 'Clear the current selection',
      shortcut: 'Escape',
      execute: () => {
        useLadderUIStore.getState().clearSelection();
      },
    },
  ];

  commandRegistry.registerAll(commands);
}
