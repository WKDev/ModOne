import { memo, useCallback } from 'react';
import { useCanvasFacade } from '../../../../hooks/useCanvasFacade';
import { useProjectStore } from '../../../../stores/projectStore';
import { Settings2 } from 'lucide-react';
import type { RuntimeGridUnit } from '../../../../components/OneCanvas/types';

interface CanvasPropertiesProps {
  documentId: string | null;
}

export const CanvasProperties = memo(function CanvasProperties({
  documentId,
}: CanvasPropertiesProps) {
  const facade = useCanvasFacade(documentId);
  const canvasSettings = useProjectStore((s) => s.currentProject?.config.canvas);

  const showGrid = canvasSettings?.show_grid ?? facade.showGrid;
  const snapToGrid = canvasSettings?.snap_to_grid ?? facade.snapToGrid;
  const gridSize = canvasSettings?.grid_size ?? facade.gridSize;
  const gridStyle = canvasSettings?.grid_style ?? facade.gridStyle;
  const gridUnit = facade.gridUnit;

  const handleToggleGrid = useCallback(() => {
    facade.toggleGrid();
  }, [facade]);

  const handleToggleSnap = useCallback(() => {
    facade.toggleSnap();
  }, [facade]);

  const handleGridSizeChange = useCallback((size: number) => {
    facade.setGridSize(size);
  }, [facade]);

  const handleGridStyleChange = useCallback((style: 'dots' | 'lines') => {
    facade.setGridStyle(style);
  }, [facade]);

  const handleGridUnitChange = useCallback((unit: RuntimeGridUnit) => {
    facade.setGridUnit(unit);
  }, [facade]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col items-center justify-center p-4 pb-2 border-b border-neutral-800">
        <Settings2 size={32} className="text-neutral-500 mb-2" />
        <h3 className="text-sm font-medium text-neutral-300">Canvas Properties</h3>
        <p className="text-xs text-neutral-500 text-center mt-1">
          Project-wide settings
        </p>
      </div>

      <div className="space-y-3 px-2">
        {/* Section Header */}
        <h4 className="text-xs font-semibold uppercase text-neutral-400">
          Grid Settings
        </h4>

        {/* Show Grid Toggle */}
        <div className="flex items-center justify-between">
          <label className="text-sm text-neutral-300">Show Grid</label>
          <button
            onClick={handleToggleGrid}
            className={`w-10 h-5 rounded-full relative transition-colors ${showGrid ? 'bg-blue-600' : 'bg-neutral-600'
              }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${showGrid ? 'translate-x-[22px]' : 'translate-x-0.5'
                }`}
            />
          </button>
        </div>

        {/* Snap to Grid Toggle */}
        <div className="flex items-center justify-between">
          <label className="text-sm text-neutral-300">Snap to Grid</label>
          <button
            onClick={handleToggleSnap}
            className={`w-10 h-5 rounded-full relative transition-colors ${snapToGrid ? 'bg-blue-600' : 'bg-neutral-600'
              }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${snapToGrid ? 'translate-x-[22px]' : 'translate-x-0.5'
                }`}
            />
          </button>
        </div>

        {/* Grid Unit Select */}
        <div className="space-y-1">
          <label className="text-xs text-neutral-500">Grid Unit</label>
          <select
            value={gridUnit}
            onChange={(e) => handleGridUnitChange(e.target.value as RuntimeGridUnit)}
            className="w-full px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer"
          >
            <option value="mil">mil (1/1000 inch)</option>
            <option value="mm">mm (millimeters)</option>
          </select>
        </div>

        {/* Grid Size Select */}
        <div className="space-y-1">
          <label className="text-xs text-neutral-500">Grid Size ({gridUnit})</label>
          <select
            value={gridSize}
            onChange={(e) => handleGridSizeChange(Number(e.target.value))}
            className="w-full px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer"
          >
            {gridUnit === 'mil' && <>
              <option value={5}>5 mil</option>
              <option value={10}>10 mil</option>
              <option value={25}>25 mil (PCB standard)</option>
              <option value={50}>50 mil</option>
              <option value={100}>100 mil (100mil = 2.54mm)</option>
            </>}
            {gridUnit === 'mm' && <>
              <option value={1}>1 mm</option>
              <option value={2.5}>2.5 mm</option>
              <option value={5}>5 mm (Default)</option>
              <option value={10}>10 mm</option>
              <option value={20}>20 mm</option>
            </>}
          </select>
        </div>

        {/* Grid Style Select */}
        <div className="space-y-1">
          <label className="text-xs text-neutral-500">Grid Style</label>
          <select
            value={gridStyle}
            onChange={(e) => handleGridStyleChange(e.target.value as 'dots' | 'lines')}
            className="w-full px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer"
          >
            <option value="dots">Dots</option>
            <option value="lines">Lines</option>
          </select>
        </div>
      </div>
    </div>
  );
});

export default CanvasProperties;
