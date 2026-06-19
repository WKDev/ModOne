import type {
  ProjectConfig,
  ProjectConfigPatch,
} from '../../types/project';

/**
 * All navigable categories in the project settings sidebar.
 * Each maps to a distinct form section in the content area.
 */
export type ProjectSettingsCategory =
  | 'manifest'
  | 'network'
  | 'modbus-simulation'
  | 'modbus-exposure'
  | 'opcua'
  | 'canvas'
  | 'info';

export interface ProjectSettingsCategoryDef {
  id: ProjectSettingsCategory;
  label: string;
  description: string;
}

/**
 * Props shared by every category form section component.
 */
export interface CategorySectionProps {
  config: ProjectConfig;
  searchFilter: string;
  onPatch: (patch: ProjectConfigPatch) => void;
  /** Extra context passed to certain sections */
  extra?: {
    /** Current project file path */
    projectPath?: string | null;
    /** Whether the OPC UA server is currently running */
    opcuaRunning?: boolean;
    /** Whether the project has unsaved changes */
    isModified?: boolean;
  };
}

/**
 * Centralized list of all project-settings categories.
 * Order here determines sidebar rendering order.
 */
export const PROJECT_SETTINGS_CATEGORIES: ProjectSettingsCategoryDef[] = [
  {
    id: 'manifest',
    label: 'Manifest',
    description: 'Project identity and PLC configuration',
  },
  {
    id: 'network',
    label: 'Network',
    description: 'IP and interface bindings',
  },
  {
    id: 'modbus-simulation',
    label: 'Modbus Simulation',
    description: 'Project-owned Modbus runtime',
  },
  {
    id: 'modbus-exposure',
    label: 'Modbus Exposure',
    description: 'Register layout mapping',
  },
  {
    id: 'opcua',
    label: 'OPC UA',
    description: 'OPC UA server definition',
  },
  {
    id: 'canvas',
    label: 'Canvas',
    description: 'Grid and canvas preferences',
  },
  {
    id: 'info',
    label: 'Info',
    description: 'Project metadata',
  },
];
