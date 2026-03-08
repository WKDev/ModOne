/**
 * WelcomePage Component
 *
 * Welcome page shown when no project is open.
 * Provides quick actions for creating/opening projects and shows recent projects.
 */

import { useCallback, useEffect, useState } from 'react';
import { FolderOpen, Plus, CheckSquare, Square, Trash2 } from 'lucide-react';
import { useProject } from '../hooks/useProject';
import { useProjectDialogs } from '../contexts/ProjectDialogContext';
import { useSettingsStore } from '../stores/settingsStore';
import { RecentProjectsList } from './project/RecentProjectsList';

interface WelcomePageProps {
  /** Callback when a project is successfully opened */
  onProjectOpened?: () => void;
  data?: unknown;
}

/**
 * Welcome Page Component
 * 
 * Displays:
 * - Open Project button
 * - New Project button
 * - Recent Projects list
 * - Show welcome page on startup checkbox
 */
export function WelcomePage({ onProjectOpened }: WelcomePageProps) {
  const { recentProjects, refreshRecentProjects, clearRecentProjects } = useProject();
  const { openNewProjectDialog, openOpenProjectPicker } = useProjectDialogs();
  const { settings, loadSettings, saveSettings, updatePending } = useSettingsStore();
  const [isLoading, setIsLoading] = useState(true);

  // Load settings on mount
  useEffect(() => {
    const init = async () => {
      await loadSettings();
      setIsLoading(false);
    };
    init();
  }, [loadSettings]);

  // Load recent projects
  useEffect(() => {
    refreshRecentProjects();
  }, [refreshRecentProjects]);

  const handleOpenProject = useCallback(async () => {
    const result = await openOpenProjectPicker();
    if (result) {
      onProjectOpened?.();
    }
  }, [openOpenProjectPicker, onProjectOpened]);

  const handleNewProject = useCallback(() => {
    openNewProjectDialog();
  }, [openNewProjectDialog]);

  const handleClearRecent = useCallback(async () => {
    await clearRecentProjects();
    await refreshRecentProjects();
  }, [clearRecentProjects, refreshRecentProjects]);

  const handleToggleWelcomePage = useCallback(async () => {
    const newValue = !settings.showWelcomePageOnStartup;
    updatePending('showWelcomePageOnStartup', newValue);
    // Save immediately
    try {
      await saveSettings();
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }, [settings.showWelcomePageOnStartup, updatePending, saveSettings]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--color-bg-primary)]">
        <div className="text-[var(--color-text-muted)]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-primary)]">
      {/* Welcome Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-8 py-12">
          {/* Logo / App Name */}
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
              ModOne
            </h1>
            <p className="text-[var(--color-text-muted)]">
              Industrial Automation Design Tool
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center mb-12">
            <button
              onClick={handleOpenProject}
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white transition-colors font-medium"
            >
              <FolderOpen size={20} />
              <span>Open Project</span>
            </button>
            <button
              onClick={handleNewProject}
              className="flex items-center gap-2 px-6 py-3 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] transition-colors font-medium"
            >
              <Plus size={20} />
              <span>New Project</span>
            </button>
          </div>

          {/* Recent Projects */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                Recent Projects
              </h2>
              {recentProjects.length > 0 && (
                <button
                  onClick={handleClearRecent}
                  className="flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <Trash2 size={14} />
                  <span>Clear</span>
                </button>
              )}
            </div>
            <RecentProjectsList 
              onProjectOpen={onProjectOpened}
              maxItems={5}
              compact={false}
            />
          </div>
        </div>
      </div>

      {/* Bottom Settings */}
      <div className="flex-shrink-0 border-t border-[var(--color-border)] px-8 py-4">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={handleToggleWelcomePage}
            className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            {settings.showWelcomePageOnStartup ? (
              <CheckSquare size={16} className="text-[var(--color-accent)]" />
            ) : (
              <Square size={16} />
            )}
            <span>Show welcome page on startup</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default WelcomePage;
