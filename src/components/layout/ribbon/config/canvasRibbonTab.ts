import type { RibbonTabConfig } from '../types';

export const canvasRibbonTab: RibbonTabConfig = {
  id: 'canvas',
  label: 'Canvas',
  groups: [
    {
      id: 'project',
      title: 'Project',
      actions: [
        { id: 'canvas-project-new', label: 'New', commandId: 'file.new', icon: 'filePlus', dataTestId: 'toolbar-new' },
        { id: 'canvas-project-open', label: 'Open', commandId: 'file.open', icon: 'folderOpen', dataTestId: 'toolbar-open' },
        { id: 'canvas-project-save', label: 'Save', commandId: 'file.save', icon: 'save', dataTestId: 'toolbar-save' },
      ],
    },
    {
      id: 'canvas-tools',
      title: 'Canvas',
      actions: [
        { id: 'canvas-tool-symbol', label: 'Symbol', commandId: 'canvas.openSymbolEditor', icon: 'sigma', dataTestId: 'open-symbol-editor' },
        { id: 'canvas-tool-button', label: 'Button', commandId: 'canvas.addButton', icon: 'circle' },
        { id: 'canvas-tool-led', label: 'LED', commandId: 'canvas.addLed', icon: 'lightbulb' },
        { id: 'canvas-tool-scope', label: 'Scope', commandId: 'canvas.addScope', icon: 'workflow' },
      ],
    },
    {
      id: 'canvas-view',
      title: 'View',
      actions: [
        { id: 'canvas-view-zoom-in', label: 'Zoom +', commandId: 'canvas.zoomIn', icon: 'zoomIn' },
        { id: 'canvas-view-zoom-out', label: 'Zoom -', commandId: 'canvas.zoomOut', icon: 'zoomOut' },
        { id: 'canvas-view-grid', label: 'Grid', commandId: 'canvas.toggleGrid', icon: 'grid3x3' },
        { id: 'canvas-view-snap', label: 'Snap', commandId: 'canvas.toggleSnap', icon: 'magnet' },
      ],
    },
  ],
};
