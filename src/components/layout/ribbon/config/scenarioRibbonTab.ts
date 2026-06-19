import type { RibbonTabConfig } from '../types';

export const scenarioRibbonTab: RibbonTabConfig = {
  id: 'scenario',
  label: 'Scenario',
  groups: [
    {
      id: 'scenario-file',
      title: 'Scenario',
      actions: [
        { id: 'scenario-file-new', label: 'New', commandId: 'scenario.new', icon: 'filePlus' },
        { id: 'scenario-file-open', label: 'Open', commandId: 'scenario.open', icon: 'folderOpen' },
        { id: 'scenario-file-save', label: 'Save', commandId: 'scenario.save', icon: 'save' },
        { id: 'scenario-file-save-as', label: 'Save As', commandId: 'scenario.saveAs', icon: 'fileDown' },
      ],
    },
    {
      id: 'scenario-execution',
      title: 'Execution',
      actions: [
        { id: 'scenario-run', label: 'Run', commandId: 'scenario.run', icon: 'play', disabled: (ctx) => ctx.scenarioStatus === 'running' },
        { id: 'scenario-pause', label: 'Pause', commandId: 'scenario.pause', icon: 'pause', disabled: (ctx) => ctx.scenarioStatus !== 'running' },
        { id: 'scenario-resume', label: 'Resume', commandId: 'scenario.resume', icon: 'play', disabled: (ctx) => ctx.scenarioStatus !== 'paused' },
        {
          id: 'scenario-stop',
          label: 'Stop',
          commandId: 'scenario.stop',
          icon: 'square',
          disabled: (ctx) => ctx.scenarioStatus !== 'running' && ctx.scenarioStatus !== 'paused',
        },
      ],
    },
    {
      id: 'scenario-data',
      title: 'Data',
      actions: [
        { id: 'scenario-import-csv', label: 'Import CSV', commandId: 'scenario.importCsv', icon: 'fileUp' },
        { id: 'scenario-export-csv', label: 'Export CSV', commandId: 'scenario.exportCsv', icon: 'fileDown' },
      ],
    },
  ],
};
