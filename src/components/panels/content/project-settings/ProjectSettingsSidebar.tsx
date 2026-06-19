/**
 * ProjectSettingsSidebar — Left navigation sidebar for project settings categories
 *
 * Follows the SettingsPanel.tsx pattern with:
 * - w-48 sidebar width
 * - Category buttons with icons and labels
 * - Active category highlighting with accent color and right border
 * - Search-filtered category visibility
 */

import {
  FileText,
  Cpu,
  Network,
  MemoryStick,
  Save,
  Grid3X3,
  Globe,
  Server,
  Sheet,
  Eye,
  ArrowLeftRight,
} from 'lucide-react';
import type { ProjectSettingsCategory } from './categories';
import { filterCategories } from './categories';

/** Maps iconName strings to actual lucide-react icon components */
const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  FileText,
  Cpu,
  Network,
  MemoryStick,
  Save,
  Grid3X3,
  Globe,
  Server,
  Sheet,
  Eye,
  ArrowLeftRight,
};

interface ProjectSettingsSidebarProps {
  /** Currently active category */
  activeCategory: ProjectSettingsCategory;
  /** Callback when a category is selected */
  onCategoryChange: (category: ProjectSettingsCategory) => void;
  /** Search filter string to narrow visible categories */
  searchFilter: string;
  /** Optional: map of category IDs that have validation errors */
  categoriesWithErrors?: Set<ProjectSettingsCategory>;
  /** Optional: whether there are unsaved changes (shows indicator) */
  hasUnsavedChanges?: boolean;
}

export function ProjectSettingsSidebar({
  activeCategory,
  onCategoryChange,
  searchFilter,
  categoriesWithErrors,
  hasUnsavedChanges: _hasUnsavedChanges,
}: ProjectSettingsSidebarProps) {
  const visibleCategories = filterCategories(searchFilter);

  return (
    <nav className="w-48 border-r border-[var(--border-color)] py-2 shrink-0 overflow-y-auto">
      {visibleCategories.length === 0 ? (
        <div className="px-4 py-3 text-sm text-[var(--text-muted)]">
          No matching categories
        </div>
      ) : (
        visibleCategories.map((category) => {
          const IconComponent = ICON_MAP[category.iconName];
          const isActive = activeCategory === category.id;
          const hasError = categoriesWithErrors?.has(category.id) ?? false;

          return (
            <button
              key={category.id}
              onClick={() => onCategoryChange(category.id)}
              title={category.description}
              className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)] border-r-2 border-[var(--accent-color)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {IconComponent && <IconComponent size={18} />}
              <span className="truncate flex-1 text-left">{category.label}</span>
              {hasError && (
                <span
                  className="w-2 h-2 rounded-full bg-[var(--color-error)] shrink-0"
                  title="Has validation errors"
                />
              )}
            </button>
          );
        })
      )}
    </nav>
  );
}
