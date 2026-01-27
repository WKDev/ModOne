import { useEffect, useRef } from 'react';
import { useLayoutStore } from '../../stores/layoutStore';

interface MenuItem {
  label: string;
  shortcut?: string;
  action?: () => void;
  separator?: boolean;
  disabled?: boolean;
  submenu?: MenuItem[];
}

interface Menu {
  label: string;
  items: MenuItem[];
}

const menus: Menu[] = [
  {
    label: 'File',
    items: [
      { label: 'New Project', shortcut: 'Ctrl+N' },
      { label: 'Open Project', shortcut: 'Ctrl+O' },
      { separator: true, label: '' },
      { label: 'Save', shortcut: 'Ctrl+S' },
      { label: 'Save As...', shortcut: 'Ctrl+Shift+S' },
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
      { label: 'Toggle Sidebar', shortcut: 'Ctrl+B' },
      {
        label: 'Toggle Panel',
        submenu: [
          { label: 'Output' },
          { label: 'Problems' },
          { label: 'Terminal' },
        ],
      },
      { separator: true, label: '' },
      { label: 'Reset Layout' },
      { separator: true, label: '' },
      { label: 'Zoom In', shortcut: 'Ctrl++' },
      { label: 'Zoom Out', shortcut: 'Ctrl+-' },
    ],
  },
  {
    label: 'Simulation',
    items: [
      { label: 'Start', shortcut: 'F5' },
      { label: 'Stop', shortcut: 'Shift+F5' },
      { label: 'Pause', shortcut: 'F6' },
      { label: 'Step', shortcut: 'F10' },
      { separator: true, label: '' },
      { label: 'Reset' },
    ],
  },
  {
    label: 'Modbus',
    items: [
      { label: 'Server Settings' },
      { separator: true, label: '' },
      { label: 'Start Server' },
      { label: 'Stop Server' },
      { separator: true, label: '' },
      { label: 'Connection Status' },
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

  return (
    <div
      ref={menuRef}
      className="h-8 bg-gray-800 border-b border-gray-700 flex items-center px-2 text-sm"
    >
      {menus.map((menu) => (
        <div key={menu.label} className="relative">
          <button
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

  return (
    <div className="relative group">
      <button
        className={`w-full px-4 py-1.5 text-left flex items-center justify-between ${
          item.disabled
            ? 'text-gray-500 cursor-not-allowed'
            : 'hover:bg-gray-700'
        }`}
        onClick={handleClick}
        disabled={item.disabled}
      >
        <span>{item.label}</span>
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
                className={`w-full px-4 py-1.5 text-left ${
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
                {subItem.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
