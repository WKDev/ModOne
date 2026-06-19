/**
 * Project Settings module barrel export
 *
 * Exports the category definitions, sidebar component, and layout shell
 * for the refactored sidebar-based project settings panel.
 */

export { PROJECT_SETTINGS_CATEGORIES, filterCategories, getCategoryById } from './categories';
export type { ProjectSettingsCategory, ProjectSettingsCategoryInfo } from './categories';
export { ProjectSettingsSidebar } from './ProjectSettingsSidebar';
export { ProjectSettingsLayout } from './ProjectSettingsLayout';
