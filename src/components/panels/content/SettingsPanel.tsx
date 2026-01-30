import { useEffect, useState, useCallback } from 'react';
import { Settings, MonitorCog, Network, Palette, Search } from 'lucide-react';
import { useSettingsStore } from '../../../stores/settingsStore';
import { GeneralSettings } from '../../settings/GeneralSettings';
import { SimulationSettings } from '../../settings/SimulationSettings';
import { ModbusSettings } from '../../settings/ModbusSettings';
import { AppearanceSettings } from '../../settings/AppearanceSettings';

type SettingsCategory = 'general' | 'simulation' | 'modbus' | 'appearance';

const categories: { id: SettingsCategory; label: string; icon: React.ReactNode }[] = [
  { id: 'general', label: '일반', icon: <Settings size={18} /> },
  { id: 'simulation', label: '시뮬레이션', icon: <MonitorCog size={18} /> },
  { id: 'modbus', label: 'Modbus', icon: <Network size={18} /> },
  { id: 'appearance', label: '외관', icon: <Palette size={18} /> },
];

/**
 * Settings Panel for tab-based display
 * Reuses logic from SettingsDialog but without modal elements
 */
export function SettingsPanel() {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('general');
  const [searchFilter, setSearchFilter] = useState('');

  const { loadSettings, applyPending, discardPending, hasUnsavedChanges, isLoading, error } =
    useSettingsStore();

  // Load settings when panel mounts
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleApply = useCallback(async () => {
    try {
      await applyPending();
    } catch (err) {
      console.error('Failed to apply settings:', err);
    }
  }, [applyPending]);

  const handleSave = useCallback(async () => {
    try {
      await applyPending();
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  }, [applyPending]);

  const handleDiscard = useCallback(() => {
    discardPending();
  }, [discardPending]);

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
            placeholder="설정 검색..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-color)]"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <nav className="w-48 border-r border-[var(--border-color)] py-2 shrink-0">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                activeCategory === category.id
                  ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)] border-r-2 border-[var(--accent-color)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {category.icon}
              <span>{category.label}</span>
            </button>
          ))}
        </nav>

        {/* Settings Form */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
              로딩 중...
            </div>
          ) : (
            <>
              {activeCategory === 'general' && <GeneralSettings searchFilter={searchFilter} />}
              {activeCategory === 'simulation' && (
                <SimulationSettings searchFilter={searchFilter} />
              )}
              {activeCategory === 'modbus' && <ModbusSettings searchFilter={searchFilter} />}
              {activeCategory === 'appearance' && (
                <AppearanceSettings searchFilter={searchFilter} />
              )}
            </>
          )}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 text-red-500 text-sm border-t border-red-500/20">
          오류: {error}
        </div>
      )}

      {/* Footer with action buttons */}
      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--border-color)]">
        <button
          onClick={handleDiscard}
          disabled={isLoading || !hasUnsavedChanges()}
          className="px-4 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          변경 취소
        </button>
        <button
          onClick={handleApply}
          disabled={isLoading || !hasUnsavedChanges()}
          className="px-4 py-1.5 text-sm bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          적용
        </button>
        <button
          onClick={handleSave}
          disabled={isLoading || !hasUnsavedChanges()}
          className="px-4 py-1.5 text-sm bg-[var(--accent-color)] text-white hover:bg-[var(--accent-color-hover)] rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          저장
        </button>
      </div>
    </div>
  );
}
