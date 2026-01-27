import { useEffect, useRef } from 'react';
import { X, XCircle, Trash2, ArrowRight, Copy, ExternalLink } from 'lucide-react';
import { TabContextAction, TAB_CONTEXT_MENU_ITEMS } from '../../types/tab';
import { usePanelStore } from '../../stores/panelStore';

export interface TabContextMenuProps {
  panelId: string;
  tabId: string;
  tabIndex: number;
  totalTabs: number;
  position: { x: number; y: number };
  onClose: () => void;
}

const ACTION_ICONS: Record<TabContextAction, React.ReactNode> = {
  close: <X size={14} />,
  closeOthers: <XCircle size={14} />,
  closeAll: <Trash2 size={14} />,
  closeToRight: <ArrowRight size={14} />,
  duplicate: <Copy size={14} />,
  moveToNewPanel: <ExternalLink size={14} />,
};

export function TabContextMenu({
  panelId,
  tabId,
  tabIndex,
  totalTabs,
  position,
  onClose,
}: TabContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { removeTab, closeOtherTabs, closeAllTabs, closeTabsToRight, duplicateTab, moveTabToNewPanel } =
    usePanelStore();

  // Close on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Adjust position to keep menu in viewport
  useEffect(() => {
    if (!menuRef.current) return;

    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let adjustedX = position.x;
    let adjustedY = position.y;

    if (rect.right > viewportWidth) {
      adjustedX = viewportWidth - rect.width - 8;
    }
    if (rect.bottom > viewportHeight) {
      adjustedY = viewportHeight - rect.height - 8;
    }

    menu.style.left = `${adjustedX}px`;
    menu.style.top = `${adjustedY}px`;
  }, [position]);

  const handleAction = (action: TabContextAction) => {
    switch (action) {
      case 'close':
        removeTab(panelId, tabId);
        break;
      case 'closeOthers':
        closeOtherTabs(panelId, tabId);
        break;
      case 'closeAll':
        closeAllTabs(panelId);
        break;
      case 'closeToRight':
        closeTabsToRight(panelId, tabId);
        break;
      case 'duplicate':
        duplicateTab(panelId, tabId);
        break;
      case 'moveToNewPanel':
        moveTabToNewPanel(panelId, tabId);
        break;
    }
    onClose();
  };

  const isActionDisabled = (action: TabContextAction): boolean => {
    switch (action) {
      case 'closeOthers':
        return totalTabs <= 1;
      case 'closeToRight':
        return tabIndex >= totalTabs - 1;
      default:
        return false;
    }
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] py-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl"
      style={{ left: position.x, top: position.y }}
    >
      {TAB_CONTEXT_MENU_ITEMS.map((item, index) => {
        const disabled = isActionDisabled(item.action);

        return (
          <div key={item.action}>
            {item.separator && index > 0 && (
              <div className="my-1 border-t border-gray-700" />
            )}
            <button
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left
                ${disabled
                  ? 'text-gray-500 cursor-not-allowed'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              onClick={() => !disabled && handleAction(item.action)}
              disabled={disabled}
            >
              <span className="w-4 h-4 flex items-center justify-center text-gray-400">
                {ACTION_ICONS[item.action]}
              </span>
              <span className="flex-1">{item.label}</span>
              {item.shortcut && (
                <span className="text-xs text-gray-500">{item.shortcut}</span>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
