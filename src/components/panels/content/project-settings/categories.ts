/**
 * Project Settings Categories
 *
 * Defines all manifest categories for the sidebar-based project settings panel.
 * Each category corresponds to a section of the .mop project manifest file.
 */

/** All available project settings category identifiers */
export type ProjectSettingsCategory =
  | 'project-metadata'
  | 'plc'
  | 'modbus'
  | 'memory-map'
  | 'auto-save'
  | 'canvas'
  | 'network'
  | 'opcua'
  | 'sheet'
  | 'tag-watch'
  | 'opcua-mappings';

export interface ProjectSettingsCategoryInfo {
  /** Unique identifier used as navigation key */
  id: ProjectSettingsCategory;
  /** Display label shown in the sidebar */
  label: string;
  /** Optional icon component (lucide-react) */
  iconName: string;
  /** Brief description shown as tooltip or subtitle */
  description: string;
  /** Search keywords to support the search/filter feature */
  keywords: string[];
}

/**
 * Ordered list of all project settings categories.
 * The order here determines the sidebar display order.
 */
export const PROJECT_SETTINGS_CATEGORIES: ProjectSettingsCategoryInfo[] = [
  {
    id: 'project-metadata',
    label: 'Project Metadata',
    iconName: 'FileText',
    description: 'Project name, description, and manifest info',
    keywords: ['name', 'description', 'manifest', 'project', 'identity', 'mop'],
  },
  {
    id: 'plc',
    label: 'PLC',
    iconName: 'Cpu',
    description: 'PLC manufacturer, model, and scan time',
    keywords: ['plc', 'manufacturer', 'model', 'scan', 'hardware', 'ls', 'mitsubishi', 'siemens'],
  },
  {
    id: 'modbus',
    label: 'Modbus',
    iconName: 'Network',
    description: 'Modbus simulation, exposure, and protocol settings',
    keywords: ['modbus', 'tcp', 'rtu', 'simulation', 'exposure', 'protocol', 'transport', 'unit id'],
  },
  {
    id: 'memory-map',
    label: 'Memory Map',
    iconName: 'MemoryStick',
    description: 'Coil, discrete input, holding/input register address ranges',
    keywords: ['memory', 'map', 'coil', 'register', 'discrete', 'holding', 'input', 'address'],
  },
  {
    id: 'auto-save',
    label: 'Auto-save',
    iconName: 'Save',
    description: 'Auto-save interval and backup settings',
    keywords: ['auto', 'save', 'backup', 'interval', 'automatic'],
  },
  {
    id: 'canvas',
    label: 'Canvas',
    iconName: 'Grid3X3',
    description: 'Canvas grid, snap, and display preferences',
    keywords: ['canvas', 'grid', 'snap', 'dots', 'lines', 'style', 'size', 'unit'],
  },
  {
    id: 'network',
    label: 'Network',
    iconName: 'Globe',
    description: 'PLC IP, interface, and subnet mask configuration',
    keywords: ['network', 'ip', 'interface', 'subnet', 'mask', 'bind', 'address'],
  },
  {
    id: 'opcua',
    label: 'OPC UA',
    iconName: 'Server',
    description: 'OPC UA server, port, security policies, and authentication',
    keywords: ['opcua', 'opc', 'ua', 'server', 'port', 'security', 'policy', 'authentication', 'anonymous'],
  },
  {
    id: 'sheet',
    label: 'Sheet',
    iconName: 'Sheet',
    description: 'Active sheet file configuration',
    keywords: ['sheet', 'file', 'active', 'directory'],
  },
  {
    id: 'tag-watch',
    label: 'Tag Watch',
    iconName: 'Eye',
    description: 'Watched tag IDs for the tag browser',
    keywords: ['tag', 'watch', 'browser', 'pin', 'monitor'],
  },
  {
    id: 'opcua-mappings',
    label: 'OPC UA Mappings',
    iconName: 'ArrowLeftRight',
    description: 'Modbus exposure rules mapped to OPC UA address space',
    keywords: ['opcua', 'mapping', 'exposure', 'rule', 'address', 'space'],
  },
];

/**
 * Get a category info by its ID.
 */
export function getCategoryById(id: ProjectSettingsCategory): ProjectSettingsCategoryInfo | undefined {
  return PROJECT_SETTINGS_CATEGORIES.find((cat) => cat.id === id);
}

/**
 * Filter categories by search query. Matches against label, description, and keywords.
 */
export function filterCategories(query: string): ProjectSettingsCategoryInfo[] {
  if (!query.trim()) return PROJECT_SETTINGS_CATEGORIES;
  const lowerQuery = query.toLowerCase().trim();
  return PROJECT_SETTINGS_CATEGORIES.filter(
    (cat) =>
      cat.label.toLowerCase().includes(lowerQuery) ||
      cat.description.toLowerCase().includes(lowerQuery) ||
      cat.keywords.some((kw) => kw.toLowerCase().includes(lowerQuery)),
  );
}
