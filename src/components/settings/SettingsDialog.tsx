import { useEffect, useState, useCallback } from 'react';
import { Settings, MonitorCog, Network, Palette, X, Search } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { GeneralSettings } from './GeneralSettings';
import { SimulationSettings } from './SimulationSettings';
import { ModbusSettings } from './ModbusSettings';
import { AppearanceSettings } from './AppearanceSettings';

type SettingsCategory = 'general' | 'simulation' | 'modbus' | 'appearance';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const categories: { id: SettingsCategory; label: string; icon: React.ReactNode }[] = [
  { id: 'general', label: '일반', icon: <Settings size={18} /> },
  { id: 'simulation', label: '시뮬레이션', icon: <MonitorCog size={18} /> },
  { id: 'modbus', label: 'Modbus', icon: <Network size={18} /> },
  { id: 'appearance', label: '외관', icon: <Palette size={18} /> },
];

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('general');
  const [searchFilter, setSearchFilter] = useState('');
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

  const { loadSettings, applyPending, discardPending, hasUnsavedChanges, isLoading, error } =
    useSettingsStore();

  // Load settings when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen, loadSettings]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasUnsavedChanges]);

  const handleClose = useCallback(() => {
    if (hasUnsavedChanges()) {
      setShowUnsavedWarning(true);
    } else {
      onClose();
    }
  }, [hasUnsavedChanges, onClose]);

  const handleCancel = useCallback(() => {
    discardPending();
    onClose();
  }, [discardPending, onClose]);

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
      onClose();
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  }, [applyPending, onClose]);

  const handleDiscardAndClose = useCallback(() => {
    discardPending();
    setShowUnsavedWarning(false);
    onClose();
  }, [discardPending, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div
          className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg shadow-xl flex flex-col"
          style={{
            width: 'min(80vw, 800px)',
            height: 'min(80vh, 600px)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
            <h2 className="text-lg font-medium text-[var(--text-primary)]">설정</h2>
            <button
              onClick={handleClose}
              className="p-1 hover:bg-[var(--bg-secondary)] rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <X size={20} />
            </button>
          </div>

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
            {/* Sidebar */}
            <nav className="w-48 border-r border-[var(--border-color)] py-2">
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

            {/* Settings Panel */}
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

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--border-color)]">
            <button
              onClick={handleCancel}
              className="px-4 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] rounded transition-colors"
            >
              취소
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
              disabled={isLoading}
              className="px-4 py-1.5 text-sm bg-[var(--accent-color)] text-white hover:bg-[var(--accent-color-hover)] rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              저장
            </button>
          </div>
        </div>
      </div>

      {/* Unsaved Changes Warning */}
      {showUnsavedWarning && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[60]" />
          <div className="fixed inset-0 flex items-center justify-center z-[60]">
            <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg shadow-xl p-6 max-w-sm">
              <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
                저장되지 않은 변경 사항
              </h3>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                변경 사항이 저장되지 않았습니다. 저장하지 않고 닫으시겠습니까?
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowUnsavedWarning(false)}
                  className="px-4 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] rounded"
                >
                  계속 편집
                </button>
                <button
                  onClick={handleDiscardAndClose}
                  className="px-4 py-1.5 text-sm bg-red-500 text-white hover:bg-red-600 rounded"
                >
                  변경 사항 버리기
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
