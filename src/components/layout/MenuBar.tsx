import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Check } from 'lucide-react';
import { useLayoutStore } from '../../stores/layoutStore';
import { useLayoutPersistenceStore } from '../../stores/layoutPersistenceStore';
import { SaveLayoutDialog } from './SaveLayoutDialog';
import { projectDialogService } from '../../services/projectDialogService';
import { fileDialogService } from '../../services/fileDialogService';
import { importService } from '../../services/importService';
import { commandRegistry } from '../CommandPalette/commandRegistry';

interface MenuItem {
  label: string;
  shortcut?: string;
  action?: () => void;
  separator?: boolean;
  disabled?: boolean;
  submenu?: MenuItem[];
  checked?: boolean;
}

interface Menu {
  label: string;
  items: MenuItem[];
}

const baseMenus: Menu[] = [
  {
    label: 'File',
    items: [
      {
        label: 'New Project',
        shortcut: 'Ctrl+N',
        action: () => projectDialogService.requestNewProject(),
      },
      {
        label: 'Open Project',
        shortcut: 'Ctrl+O',
        action: () => projectDialogService.requestOpenProject(),
      },
      { separator: true, label: '' },
      {
        label: 'Save',
        shortcut: 'Ctrl+S',
        action: () => commandRegistry.execute('file.save'),
      },
      {
        label: 'Save As...',
        shortcut: 'Ctrl+Shift+S',
        action: () => commandRegistry.execute('file.saveAs'),
      },
      {
        label: 'Save All',
        shortcut: 'Ctrl+Alt+S',
        action: () => commandRegistry.execute('file.saveAll'),
      },
      { separator: true, label: '' },
      {
        label: 'Add',
        submenu: [
          {
            label: 'New Canvas',
            shortcut: 'Ctrl+Shift+C',
            action: () => fileDialogService.requestNewCanvas(),
          },
          {
            label: 'New Ladder',
            shortcut: 'Ctrl+Shift+L',
            action: () => fileDialogService.requestNewLadder(),
          },
          {
            label: 'New Scenario',
            shortcut: 'Ctrl+Shift+N',
            action: () => fileDialogService.requestNewScenario(),
          },
        ],
      },
      {
        label: 'Import',
        submenu: [
          {
            label: 'Import program from XG5000',
            action: () => importService.requestImportXG5000(),
          },
        ],
      },
      { separator: true, label: '' },
      {
        label: 'Recent Projects',
        submenu: [
          { label: 'No recent projects', disabled: true },
        ],
      },
      { separator: true, label: '' },
      { label: 'Exit' },
    ],
  },
  {
    label: 'Edit',
    items: [
      { label: 'Undo', shortcut: 'Ctrl+Z' },
      { label: 'Redo', shortcut: 'Ctrl+Y' },
      { separator: true, label: '' },
      { label: 'Cut', shortcut: 'Ctrl+X' },
      { label: 'Copy', shortcut: 'Ctrl+C' },
      { label: 'Paste', shortcut: 'Ctrl+V' },
      { separator: true, label: '' },
      { label: 'Preferences' },
    ],
  },
  {
    label: 'View',
    items: [
      {
        label: 'Toggle Sidebar',
        shortcut: 'Ctrl+B',
        action: () => commandRegistry.execute('view.toggleLeftPanel'),
      },
      {
        label: 'Toggle Panel',
        submenu: [
          {
            label: 'Output',
            action: () => {
              useLayoutStore.getState().setPanelType('output');
              if (!useLayoutStore.getState().panelVisible) {
                useLayoutStore.getState().togglePanel();
              }
            },
          },
          {
            label: 'Problems',
            action: () => {
              useLayoutStore.getState().setPanelType('problems');
              if (!useLayoutStore.getState().panelVisible) {
                useLayoutStore.getState().togglePanel();
              }
            },
          },
          {
            label: 'Terminal',
            action: () => {
              useLayoutStore.getState().setPanelType('terminal');
              if (!useLayoutStore.getState().panelVisible) {
                useLayoutStore.getState().togglePanel();
              }
            },
          },
        ],
      },
      { separator: true, label: '' },
      // Layouts submenu will be injected dynamically
      { label: '__LAYOUTS_PLACEHOLDER__' },
      { separator: true, label: '' },
      {
        label: 'Zoom In',
        shortcut: 'Ctrl++',
        action: () => commandRegistry.execute('view.zoomIn'),
      },
      {
        label: 'Zoom Out',
        shortcut: 'Ctrl+-',
        action: () => commandRegistry.execute('view.zoomOut'),
      },
    ],
  },
  {
    label: 'Simulation',
    items: [
      {
        label: 'Start',
        shortcut: 'F5',
        action: () => commandRegistry.execute('simulation.start'),
      },
      {
        label: 'Stop',
        shortcut: 'Shift+F5',
        action: () => commandRegistry.execute('simulation.stop'),
      },
      {
        label: 'Pause',
        shortcut: 'F6',
        action: () => commandRegistry.execute('simulation.pause'),
      },
      {
        label: 'Step',
        shortcut: 'F10',
        action: () => commandRegistry.execute('simulation.step'),
      },
      { separator: true, label: '' },
      {
        label: 'Reset',
        action: () => commandRegistry.execute('simulation.reset'),
      },
    ],
  },
  {
    label: 'Modbus',
    items: [
      { label: 'Server Settings' },
      { separator: true, label: '' },
      {
        label: 'Start TCP Server',
        action: () => commandRegistry.execute('modbus.startTcp'),
      },
      {
        label: 'Stop TCP Server',
        action: () => commandRegistry.execute('modbus.stopTcp'),
      },
      { separator: true, label: '' },
      {
        label: 'Start RTU Server',
        action: () => commandRegistry.execute('modbus.startRtu'),
      },
      {
        label: 'Stop RTU Server',
        action: () => commandRegistry.execute('modbus.stopRtu'),
      },
      { separator: true, label: '' },
      {
        label: 'Connection Status',
        action: () => commandRegistry.execute('modbus.status'),
      },
    ],
  },
  {
    label: 'Help',
    items: [
      { label: 'Documentation' },
      { separator: true, label: '' },
      { label: 'About' },
    ],
  },
];

export function MenuBar() {
  const { menuOpen, setMenuOpen } = useLayoutStore();
  const menuRef = useRef<HTMLDivElement>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  const {
    currentLayoutName,
    getAvailableLayouts,
    loadLayout,
    resetToDefault,
  } = useLayoutPersistenceStore();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setMenuOpen]);

  const handleMenuClick = (label: string) => {
    setMenuOpen(menuOpen === label ? null : label);
  };

  const getMenuTestId = (label: string) => {
    return `menu-${label.toLowerCase().replace(/\s+/g, '-')}`;
  };

  // Build the Layouts submenu dynamically
  const buildLayoutsSubmenu = useCallback((): MenuItem[] => {
    const availableLayouts = getAvailableLayouts();
    const builtInLayouts = availableLayouts.filter((l) => l.isBuiltIn);
    const userLayouts = availableLayouts.filter((l) => !l.isBuiltIn);

    const submenuItems: MenuItem[] = [];

    // Built-in layouts
    builtInLayouts.forEach((layout) => {
      submenuItems.push({
        label: layout.name,
        checked: currentLayoutName === layout.name,
        action: () => loadLayout(layout.name),
      });
    });

    // User layouts (if any)
    if (userLayouts.length > 0) {
      submenuItems.push({ separator: true, label: '' });
      userLayouts.forEach((layout) => {
        submenuItems.push({
          label: layout.name,
          checked: currentLayoutName === layout.name,
          action: () => loadLayout(layout.name),
        });
      });
    }

    // Actions
    submenuItems.push({ separator: true, label: '' });
    submenuItems.push({
      label: 'Save Layout As...',
      action: () => setSaveDialogOpen(true),
    });
    submenuItems.push({
      label: 'Reset to Default',
      action: () => resetToDefault(),
    });

    return submenuItems;
  }, [currentLayoutName, getAvailableLayouts, loadLayout, resetToDefault]);

  // Build menus with dynamic Layouts submenu
  const menus = useMemo((): Menu[] => {
    return baseMenus.map((menu) => {
      if (menu.label !== 'View') return menu;

      // Replace the placeholder with the Layouts submenu
      const items = menu.items.map((item) => {
        if (item.label === '__LAYOUTS_PLACEHOLDER__') {
          return {
            label: 'Layouts',
            submenu: buildLayoutsSubmenu(),
          } as MenuItem;
        }
        return item;
      });

      return { ...menu, items };
    });
  }, [buildLayoutsSubmenu]);

  return (
    <>
      <SaveLayoutDialog
        isOpen={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
      />
    <div
      ref={menuRef}
      data-testid="menu-bar"
      className="h-8 bg-gray-800 border-b border-gray-700 flex items-center px-2 text-sm"
    >
      {menus.map((menu) => (
        <div key={menu.label} className="relative">
          <button
            data-testid={getMenuTestId(menu.label)}
            className={`px-3 py-1 rounded hover:bg-gray-700 ${
              menuOpen === menu.label ? 'bg-gray-700' : ''
            }`}
            onClick={() => handleMenuClick(menu.label)}
          >
            {menu.label}
          </button>

          {menuOpen === menu.label && (
            <div className="absolute left-0 top-full mt-0.5 bg-gray-800 border border-gray-700 rounded shadow-lg min-w-48 py-1 z-50">
              {menu.items.map((item, index) =>
                item.separator ? (
                  <div
                    key={index}
                    className="h-px bg-gray-700 my-1 mx-2"
                  />
                ) : (
                  <MenuItemComponent
                    key={item.label}
                    item={item}
                    onClose={() => setMenuOpen(null)}
                  />
                )
              )}
            </div>
          )}
        </div>
      ))}
      </div>
    </>
  );
}

interface MenuItemComponentProps {
  item: MenuItem;
  onClose: () => void;
}

function MenuItemComponent({ item, onClose }: MenuItemComponentProps) {
  const handleClick = () => {
    if (!item.disabled && !item.submenu) {
      item.action?.();
      onClose();
    }
  };

  const getItemTestId = (label: string) => {
    return `menu-${label.toLowerCase().replace(/\s+/g, '-').replace(/\.\.\./g, '')}`;
  };

  return (
    <div className="relative group">
      <button
        data-testid={getItemTestId(item.label)}
        className={`w-full px-4 py-1.5 text-left flex items-center justify-between ${
          item.disabled
            ? 'text-gray-500 cursor-not-allowed'
            : 'hover:bg-gray-700'
        }`}
        onClick={handleClick}
        disabled={item.disabled}
      >
        <span className="flex items-center gap-2">
          {item.checked !== undefined && (
            <span className="w-4 h-4 flex items-center justify-center">
              {item.checked && <Check size={14} className="text-blue-400" />}
            </span>
          )}
          {item.label}
        </span>
        <span className="text-gray-500 text-xs ml-8">
          {item.shortcut}
          {item.submenu && '\u25B6'}
        </span>
      </button>

      {item.submenu && (
        <div className="absolute left-full top-0 ml-0.5 bg-gray-800 border border-gray-700 rounded shadow-lg min-w-40 py-1 hidden group-hover:block">
          {item.submenu.map((subItem, index) =>
            subItem.separator ? (
              <div key={index} className="h-px bg-gray-700 my-1 mx-2" />
            ) : (
              <button
                key={subItem.label}
                className={`w-full px-4 py-1.5 text-left flex items-center ${
                  subItem.disabled
                    ? 'text-gray-500 cursor-not-allowed'
                    : 'hover:bg-gray-700'
                }`}
                disabled={subItem.disabled}
                onClick={() => {
                  subItem.action?.();
                  onClose();
                }}
              >
                {subItem.checked !== undefined && (
                  <span className="w-4 h-4 mr-2 flex items-center justify-center">
                    {subItem.checked && <Check size={14} className="text-blue-400" />}
                  </span>
                )}
                {subItem.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
