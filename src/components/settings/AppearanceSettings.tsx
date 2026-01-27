import { useEffect } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { Theme } from '../../types/settings';
import { useTheme } from '../../providers/ThemeProvider';

interface AppearanceSettingsProps {
  searchFilter?: string;
}

const themeOptions: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: '라이트', icon: <Sun size={18} /> },
  { value: 'dark', label: '다크', icon: <Moon size={18} /> },
  { value: 'system', label: '시스템', icon: <Monitor size={18} /> },
];

export function AppearanceSettings({ searchFilter = '' }: AppearanceSettingsProps) {
  const { getMergedSettings, updatePending } = useSettingsStore();
  const settings = getMergedSettings();
  const { setTheme } = useTheme();

  const filter = searchFilter.toLowerCase();

  const isVisible = (keywords: string[]) => {
    if (!filter) return true;
    return keywords.some((keyword) => keyword.toLowerCase().includes(filter));
  };

  // Sync theme with ThemeProvider for immediate preview
  useEffect(() => {
    setTheme(settings.theme);
  }, [settings.theme, setTheme]);

  // Apply font size immediately for preview
  useEffect(() => {
    document.documentElement.style.setProperty('--app-font-size', `${settings.fontSize}px`);
  }, [settings.fontSize]);

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">외관 설정</h3>

      {/* Theme */}
      {isVisible(['theme', '테마', 'dark', 'light', '다크', '라이트', '시스템']) && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[var(--text-primary)]">테마</label>
          <div className="flex gap-2">
            {themeOptions.map((option) => (
              <label
                key={option.value}
                className={`flex items-center gap-2 px-4 py-2 rounded cursor-pointer transition-colors ${
                  settings.theme === option.value
                    ? 'bg-[var(--accent-color)] text-white'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                }`}
              >
                <input
                  type="radio"
                  name="theme"
                  value={option.value}
                  checked={settings.theme === option.value}
                  onChange={() => updatePending('theme', option.value)}
                  className="sr-only"
                />
                {option.icon}
                <span className="text-sm font-medium">{option.label}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            애플리케이션 테마를 선택합니다. 시스템은 OS 설정을 따릅니다.
          </p>
        </div>
      )}

      {/* Font size */}
      {isVisible(['font', 'size', '폰트', '글꼴', '크기', '글자']) && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[var(--text-primary)]">
            글꼴 크기: {settings.fontSize}px
          </label>
          <input
            type="range"
            min={12}
            max={20}
            value={settings.fontSize}
            onChange={(e) => updatePending('fontSize', parseInt(e.target.value))}
            className="w-full max-w-xs h-2 bg-[var(--bg-secondary)] rounded-lg appearance-none cursor-pointer accent-[var(--accent-color)]"
          />
          <div className="flex justify-between text-xs text-[var(--text-muted)] max-w-xs">
            <span>12px</span>
            <span>20px</span>
          </div>
        </div>
      )}

      {/* Grid display */}
      {isVisible(['grid', '그리드', '격자', 'display', '표시']) && (
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="gridDisplay"
            checked={settings.gridDisplay}
            onChange={(e) => updatePending('gridDisplay', e.target.checked)}
            className="mt-1 w-4 h-4 text-[var(--accent-color)] bg-[var(--bg-secondary)] border-[var(--border-color)] rounded focus:ring-[var(--accent-color)]"
          />
          <div>
            <label
              htmlFor="gridDisplay"
              className="block text-sm font-medium text-[var(--text-primary)] cursor-pointer"
            >
              그리드 표시
            </label>
            <p className="text-xs text-[var(--text-muted)]">
              캔버스 및 에디터에서 그리드를 표시합니다.
            </p>
          </div>
        </div>
      )}

      {/* Animation */}
      {isVisible(['animation', '애니메이션', '효과', '모션']) && (
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="animationEnabled"
            checked={settings.animationEnabled}
            onChange={(e) => updatePending('animationEnabled', e.target.checked)}
            className="mt-1 w-4 h-4 text-[var(--accent-color)] bg-[var(--bg-secondary)] border-[var(--border-color)] rounded focus:ring-[var(--accent-color)]"
          />
          <div>
            <label
              htmlFor="animationEnabled"
              className="block text-sm font-medium text-[var(--text-primary)] cursor-pointer"
            >
              애니메이션 활성화
            </label>
            <p className="text-xs text-[var(--text-muted)]">
              UI 전환 애니메이션을 활성화합니다. 비활성화하면 성능이 향상될 수 있습니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
