/**
 * Memory Visualizer Panel
 *
 * Main panel component for visualizing and editing Modbus memory.
 * Assembles toolbar, table, favorites, and context menu components.
 */

import { useState, useCallback } from 'react';
import { MemoryToolbar } from '../../MemoryVisualizer/MemoryToolbar';
import { MemoryTable } from '../../MemoryVisualizer/MemoryTable';
import { FavoritesPanel } from '../../MemoryVisualizer/FavoritesPanel';
import { NumberInputPopover } from '../../MemoryVisualizer/NumberInputPopover';
import {
  ContextMenu,
  buildCellMenuItems,
  buildFavoriteMenuItems,
} from '../../MemoryVisualizer/ContextMenu';
import { useFavorites } from '../../MemoryVisualizer/hooks/useFavorites';
import { useModbusMemory } from '../../../hooks/useModbusMemory';
import { modbusService } from '../../../services/modbusService';
import { copyAddress, copyValue } from '../../MemoryVisualizer/utils/clipboard';
import type {
  MemoryViewConfig,
  CellSelection,
  ContextMenuPosition,
  FavoriteItem,
  DisplayFormat,
} from '../../MemoryVisualizer/types';
import type { MemoryType } from '../../../types/modbus';

// ============================================================================
// Types
// ============================================================================

interface PopoverState {
  address: number;
  value: number;
  position: { x: number; y: number };
}

interface CellContextMenuState {
  position: ContextMenuPosition;
  type: 'cell';
  cell: CellSelection;
}

interface FavoriteContextMenuState {
  position: ContextMenuPosition;
  type: 'favorite';
  favorite: FavoriteItem;
  index: number;
}

type ContextMenuState = CellContextMenuState | FavoriteContextMenuState | null;

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: MemoryViewConfig = {
  memoryType: 'holding',
  startAddress: 0,
  count: 100,
  columns: 10,
  displayFormat: 'DEC',
};

// ============================================================================
// Component
// ============================================================================

export function MemoryVisualizerPanel() {
  // View configuration state
  const [config, setConfig] = useState<MemoryViewConfig>(DEFAULT_CONFIG);

  // Memory data subscription
  const { values, isLoading, error, refresh } = useModbusMemory(
    config.memoryType,
    config.startAddress,
    config.count
  );

  // Favorites management
  const {
    favorites,
    addFavorite,
    updateFavorite,
    removeFavorite,
    reorderFavorites,
    isFavorite,
  } = useFavorites();

  // Popover state for register editing
  const [popoverState, setPopoverState] = useState<PopoverState | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);

  // Determine if current memory type is read-only
  const isReadOnly =
    config.memoryType === 'discrete' || config.memoryType === 'input';

  // ============================================================================
  // Handlers
  // ============================================================================

  /**
   * Handle configuration changes from toolbar
   */
  const handleConfigChange = useCallback(
    (updates: Partial<MemoryViewConfig>) => {
      setConfig((prev) => ({ ...prev, ...updates }));
    },
    []
  );

  /**
   * Handle cell click for editing
   */
  const handleCellClick = useCallback(
    (address: number, value: boolean | number) => {
      const isBooleanType =
        config.memoryType === 'coil' || config.memoryType === 'discrete';

      if (isBooleanType) {
        // Toggle coil directly
        if (config.memoryType === 'coil') {
          modbusService.writeCoil(address, !(value as boolean));
        }
        // Discrete inputs are read-only
      } else {
        // Open number input popover for holding registers
        if (config.memoryType === 'holding') {
          setPopoverState({
            address,
            value: value as number,
            position: {
              x: Math.min(window.innerWidth / 2 - 140, window.innerWidth - 300),
              y: Math.min(
                window.innerHeight / 2 - 180,
                window.innerHeight - 400
              ),
            },
          });
        }
        // Input registers are read-only
      }
    },
    [config.memoryType]
  );

  /**
   * Handle cell context menu (right-click)
   */
  const handleCellContextMenu = useCallback(
    (e: React.MouseEvent, address: number, value: boolean | number) => {
      e.preventDefault();
      setContextMenu({
        position: { x: e.clientX, y: e.clientY },
        type: 'cell',
        cell: { memoryType: config.memoryType, address, value },
      });
    },
    [config.memoryType]
  );

  /**
   * Apply value from number input popover
   */
  const handleApplyValue = useCallback(
    async (value: number) => {
      if (popoverState && config.memoryType === 'holding') {
        try {
          await modbusService.writeHoldingRegister(popoverState.address, value);
        } catch (err) {
          console.error('Failed to write holding register:', err);
        }
      }
      setPopoverState(null);
    },
    [popoverState, config.memoryType]
  );

  /**
   * Get value for a specific address (used by favorites panel)
   */
  const getValueForAddress = useCallback(
    (
      memoryType: MemoryType,
      address: number
    ): boolean | number | undefined => {
      // Only return value if it's within the current view
      if (
        memoryType === config.memoryType &&
        address >= config.startAddress &&
        address < config.startAddress + config.count
      ) {
        return values[address - config.startAddress];
      }
      return undefined;
    },
    [config.memoryType, config.startAddress, config.count, values]
  );

  /**
   * Navigate to a specific address (from favorites)
   */
  const handleNavigateToAddress = useCallback(
    (memoryType: MemoryType, address: number) => {
      setConfig((prev) => ({
        ...prev,
        memoryType,
        startAddress: Math.max(0, address - Math.floor(prev.count / 2)),
      }));
    },
    []
  );

  /**
   * Handle favorite edit (placeholder - could open dialog)
   */
  const handleEditFavorite = useCallback((item: FavoriteItem) => {
    // TODO: Open edit dialog
    console.log('Edit favorite:', item);
  }, []);

  /**
   * Handle favorite context menu
   */
  const handleFavoriteContextMenu = useCallback(
    (e: React.MouseEvent, item: FavoriteItem, position: ContextMenuPosition) => {
      e.preventDefault();
      const index = favorites.findIndex((f) => f.id === item.id);
      setContextMenu({
        position,
        type: 'favorite',
        favorite: item,
        index,
      });
    },
    [favorites]
  );

  /**
   * Close context menu
   */
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // ============================================================================
  // Context Menu Items
  // ============================================================================

  const getContextMenuItems = useCallback(() => {
    if (!contextMenu) return [];

    if (contextMenu.type === 'cell') {
      const { cell } = contextMenu;
      const cellIsFavorite = isFavorite(cell.memoryType, cell.address);

      return buildCellMenuItems(cell, isReadOnly, cellIsFavorite, {
        onAddToFavorites: () => {
          addFavorite({
            memoryType: cell.memoryType,
            address: cell.address,
            label: `${cell.memoryType}:${cell.address}`,
            displayFormat: config.displayFormat,
          });
        },
        onRemoveFromFavorites: () => {
          const fav = favorites.find(
            (f) => f.memoryType === cell.memoryType && f.address === cell.address
          );
          if (fav) {
            removeFavorite(fav.id);
          }
        },
        onCopyAddress: () => {
          copyAddress(cell.memoryType, cell.address);
        },
        onCopyValue: () => {
          copyValue(cell.value, config.displayFormat);
        },
        onSetValue: (val) => {
          if (config.memoryType === 'coil') {
            modbusService.writeCoil(cell.address, val === 1);
          } else if (config.memoryType === 'holding') {
            modbusService.writeHoldingRegister(cell.address, val);
          }
        },
      });
    }

    if (contextMenu.type === 'favorite') {
      const { favorite, index } = contextMenu;
      const canMoveUp = index > 0;
      const canMoveDown = index < favorites.length - 1;

      return buildFavoriteMenuItems(
        favorite,
        {
          onEditLabel: () => handleEditFavorite(favorite),
          onChangeColor: () => {
            // TODO: Open color picker
            console.log('Change color for:', favorite.id);
          },
          onChangeFormat: (format: DisplayFormat) => {
            updateFavorite(favorite.id, { displayFormat: format });
          },
          onMoveUp: () => {
            if (canMoveUp) {
              reorderFavorites(index, index - 1);
            }
          },
          onMoveDown: () => {
            if (canMoveDown) {
              reorderFavorites(index, index + 1);
            }
          },
          onRemove: () => {
            removeFavorite(favorite.id);
          },
        },
        canMoveUp,
        canMoveDown
      );
    }

    return [];
  }, [
    contextMenu,
    isReadOnly,
    config.displayFormat,
    config.memoryType,
    favorites,
    isFavorite,
    addFavorite,
    removeFavorite,
    updateFavorite,
    reorderFavorites,
    handleEditFavorite,
  ]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="flex h-full flex-col bg-neutral-900 text-white">
      {/* Toolbar */}
      <MemoryToolbar
        config={config}
        onConfigChange={handleConfigChange}
        onRefresh={refresh}
        isLoading={isLoading}
      />

      {/* Error display */}
      {error && (
        <div className="bg-red-900/50 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Main content - Memory table */}
      <div className="flex-1 overflow-hidden">
        <MemoryTable
          memoryType={config.memoryType}
          startAddress={config.startAddress}
          values={values}
          columns={config.columns}
          displayFormat={config.displayFormat}
          isReadOnly={isReadOnly}
          selectedAddress={popoverState?.address}
          onCellClick={handleCellClick}
          onCellContextMenu={handleCellContextMenu}
        />
      </div>

      {/* Favorites panel */}
      <FavoritesPanel
        favorites={favorites}
        onNavigateToAddress={handleNavigateToAddress}
        getValueForAddress={getValueForAddress}
        onEditFavorite={handleEditFavorite}
        onRemoveFavorite={removeFavorite}
        onContextMenu={handleFavoriteContextMenu}
      />

      {/* Number input popover */}
      {popoverState && (
        <NumberInputPopover
          initialValue={popoverState.value}
          address={popoverState.address}
          onApply={handleApplyValue}
          onCancel={() => setPopoverState(null)}
          position={popoverState.position}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          position={contextMenu.position}
          onClose={handleCloseContextMenu}
          items={getContextMenuItems()}
        />
      )}
    </div>
  );
}

export default MemoryVisualizerPanel;
