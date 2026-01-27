import { PanelType } from './panel';

/**
 * Represents the state of a single tab within a panel
 */
export interface TabState {
  /** Unique identifier for the tab */
  id: string;
  /** Type of panel content this tab displays */
  panelType: PanelType;
  /** Display title for the tab */
  title: string;
  /** Whether the tab has unsaved changes */
  isModified: boolean;
  /** Optional data associated with the tab (e.g., file path, document ID) */
  data?: TabData;
}

/**
 * Data that can be associated with a tab
 */
export interface TabData {
  /** File path if the tab represents a file */
  filePath?: string;
  /** Document or entity ID */
  documentId?: string;
  /** Custom metadata */
  [key: string]: unknown;
}

/**
 * Props for the Tab component
 */
export interface TabProps {
  /** Tab state */
  tab: TabState;
  /** Whether this tab is currently active */
  isActive: boolean;
  /** Callback when tab is clicked */
  onClick: () => void;
  /** Callback when tab close button is clicked */
  onClose: () => void;
  /** Callback for drag start */
  onDragStart?: (e: React.DragEvent) => void;
  /** Callback for drag over */
  onDragOver?: (e: React.DragEvent) => void;
  /** Callback for drop */
  onDrop?: (e: React.DragEvent) => void;
}

/**
 * Props for the TabBar component
 */
export interface TabBarProps {
  /** Panel ID this tab bar belongs to */
  panelId: string;
  /** Array of tabs to display */
  tabs: TabState[];
  /** ID of the currently active tab */
  activeTabId: string | null;
  /** Callback when a tab is selected */
  onTabSelect: (tabId: string) => void;
  /** Callback when a tab is closed */
  onTabClose: (tabId: string) => void;
  /** Callback when tabs are reordered */
  onTabReorder: (fromIndex: number, toIndex: number) => void;
  /** Callback to add a new tab */
  onAddTab?: () => void;
}

/**
 * Context menu actions for tabs
 */
export type TabContextAction =
  | 'close'
  | 'closeOthers'
  | 'closeAll'
  | 'closeToRight'
  | 'duplicate'
  | 'moveToNewPanel';

/**
 * Context menu item for tab actions
 */
export interface TabContextMenuItem {
  action: TabContextAction;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  separator?: boolean;
}

/**
 * Default context menu items for tabs
 */
export const TAB_CONTEXT_MENU_ITEMS: TabContextMenuItem[] = [
  { action: 'close', label: 'Close', shortcut: 'Ctrl+W' },
  { action: 'closeOthers', label: 'Close Others' },
  { action: 'closeToRight', label: 'Close to the Right' },
  { action: 'closeAll', label: 'Close All', separator: true },
  { action: 'duplicate', label: 'Duplicate Tab' },
  { action: 'moveToNewPanel', label: 'Move to New Panel' },
];
