import type { RibbonTabConfig } from '../types';

export const layoutRibbonTab: RibbonTabConfig = {
  id: 'layout',
  label: 'Layout',
  groups: [
    {
      id: 'layout-editors',
      title: 'Editors',
      actions: [
        {
          id: 'layout-open-sheet-editor',
          label: 'Sheet Editor',
          commandId: 'layout.openSheetEditor',
          icon: 'table',
          dataTestId: 'ribbon-sheet-editor',
        },
      ],
    },
    {
      id: 'layout-tools',
      title: 'Tools',
      actions: [
        {
          id: 'layout-sheet-editor-popup',
          label: 'Sheet Editor (Popup)',
          commandId: 'tools.openSheetEditorPopup',
          icon: 'fileSpreadsheet',
          dataTestId: 'ribbon-sheet-editor-popup',
        },
      ],
    },
  ],
};
