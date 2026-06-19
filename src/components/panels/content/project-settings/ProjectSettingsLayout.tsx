/**
 * ProjectSettingsLayout — Main layout shell for the refactored Project Settings Panel
 *
 * Follows the SettingsPanel.tsx pattern:
 * - Top search bar
 * - Left sidebar (w-48) with category navigation
 * - Right content area for category-specific forms
 * - Bottom footer with Save/Cancel/Apply buttons
 *
 * This component owns the layout structure. Category content rendering
 * and state management are handled by child components / sibling modules.
 */

import { useState, useCallback, memo } from 'react';
import { Search } from 'lucide-react';
import { ProjectSettingsSidebar } from './ProjectSettingsSidebar';
import type { ProjectSettingsCategory } from './categories';

interface ProjectSettingsLayoutProps {
  /** Render function for the active category's form content */
  renderContent: (category: ProjectSettingsCategory, searchFilter: string) => React.ReactNode;
  /** Whether there are unsaved changes across any category */
  hasUnsavedChanges: boolean;
  /** Whether save should be blocked (e.g., validation errors) */
  saveBlocked: boolean;
  /** Whether the panel is currently loading */
  isLoading: boolean;
  /** Error message to display, if any */
  error?: string | null;
  /** Callback for Save button */
  onSave: () => void;
  /** Callback for Cancel/Discard button */
  onCancel: () => void;
  /** Callback for Apply button (save without closing) */
  onApply: () => void;
  /** Optional: set of category IDs that have validation errors */
  categoriesWithErrors?: Set<ProjectSettingsCategory>;
}

export const ProjectSettingsLayout = memo(function ProjectSettingsLayout({
  renderContent,
  hasUnsavedChanges,
  saveBlocked,
  isLoading,
  error,
  onSave,
  onCancel,
  onApply,
  categoriesWithErrors,
}: ProjectSettingsLayoutProps) {
  const [activeCategory, setActiveCategory] = useState<ProjectSettingsCategory>('project-metadata');
  const [searchFilter, setSearchFilter] = useState('');

  const handleCategoryChange = useCallback((category: ProjectSettingsCategory) => {
    setActiveCategory(category);
  }, []);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      {/* Search */}
      <div className="px-4 py-2 border-b border-[var(--border-color)]">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <input
            type="text"
            placeholder="Search project settings..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-color)]"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <ProjectSettingsSidebar
          activeCategory={activeCategory}
          onCategoryChange={handleCategoryChange}
          searchFilter={searchFilter}
          categoriesWithErrors={categoriesWithErrors}
          hasUnsavedChanges={hasUnsavedChanges}
        />

        {/* Settings Form */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
              Loading...
            </div>
          ) : (
            renderContent(activeCategory, searchFilter)
          )}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="px-4 py-2 bg-[var(--color-error)]/10 text-[var(--color-error)] text-sm border-t border-[var(--color-error)]/20">
          Error: {error}
        </div>
      )}

      {/* Footer with action buttons */}
      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--border-color)]">
        <button
          onClick={onCancel}
          disabled={isLoading || !hasUnsavedChanges}
          className="px-4 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          onClick={onApply}
          disabled={isLoading || !hasUnsavedChanges || saveBlocked}
          className="px-4 py-1.5 text-sm bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Apply
        </button>
        <button
          onClick={onSave}
          disabled={isLoading || !hasUnsavedChanges || saveBlocked}
          className="px-4 py-1.5 text-sm bg-[var(--accent-color)] text-white hover:bg-[var(--accent-color-hover)] rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  );
});
