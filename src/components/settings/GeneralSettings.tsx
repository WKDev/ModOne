import { useEffect } from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import { Language } from '../../types/settings';
import { useTranslation } from '../../hooks/useTranslation';

interface GeneralSettingsProps {
  searchFilter?: string;
}

export function GeneralSettings({ searchFilter = '' }: GeneralSettingsProps) {
  const { getMergedSettings, updatePending } = useSettingsStore();
  const settings = getMergedSettings();
  const { t, setLanguage, supportedLanguages, languageLabels } = useTranslation();

  // Apply language change immediately for preview
  useEffect(() => {
    setLanguage(settings.language);
  }, [settings.language, setLanguage]);

  const filter = searchFilter.toLowerCase();

  const isVisible = (keywords: string[]) => {
    if (!filter) return true;
    return keywords.some((keyword) => keyword.toLowerCase().includes(filter));
  };

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">일반 설정</h3>

      {/* Language */}
      {isVisible(['language', '언어', '한국어', 'english', '일본어']) && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[var(--text-primary)]">
            {t('settings.general.language')}
          </label>
          <select
            value={settings.language}
            onChange={(e) => updatePending('language', e.target.value as Language)}
            className="w-full max-w-xs px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-color)]"
          >
            {supportedLanguages.map((lng) => (
              <option key={lng} value={lng}>
                {languageLabels[lng]}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Auto-save interval */}
      {isVisible(['autosave', 'auto-save', '자동 저장', '저장', 'interval']) && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[var(--text-primary)]">
            자동 저장 간격
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={30}
              step={10}
              value={settings.autoSaveInterval}
              onChange={(e) => {
                const value = Math.max(30, parseInt(e.target.value) || 30);
                updatePending('autoSaveInterval', value);
              }}
              className="w-24 px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-color)]"
            />
            <span className="text-sm text-[var(--text-secondary)]">초</span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            프로젝트를 자동으로 저장하는 간격입니다. (최소 30초)
          </p>
        </div>
      )}

      {/* Start with last project */}
      {isVisible(['startup', '시작', 'last project', '마지막 프로젝트', '열기']) && (
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="startWithLastProject"
            checked={settings.startWithLastProject}
            onChange={(e) => updatePending('startWithLastProject', e.target.checked)}
            className="mt-1 w-4 h-4 text-[var(--accent-color)] bg-[var(--bg-secondary)] border-[var(--border-color)] rounded focus:ring-[var(--accent-color)]"
          />
          <div>
            <label
              htmlFor="startWithLastProject"
              className="block text-sm font-medium text-[var(--text-primary)] cursor-pointer"
            >
              마지막 프로젝트로 시작
            </label>
            <p className="text-xs text-[var(--text-muted)]">
              앱 시작 시 마지막으로 열었던 프로젝트를 자동으로 엽니다.
            </p>
          </div>
        </div>
      )}

      {/* Telemetry */}
      {isVisible(['telemetry', '원격 측정', '분석', 'analytics', '데이터 수집']) && (
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="telemetryEnabled"
            checked={settings.telemetryEnabled}
            onChange={(e) => updatePending('telemetryEnabled', e.target.checked)}
            className="mt-1 w-4 h-4 text-[var(--accent-color)] bg-[var(--bg-secondary)] border-[var(--border-color)] rounded focus:ring-[var(--accent-color)]"
          />
          <div>
            <label
              htmlFor="telemetryEnabled"
              className="block text-sm font-medium text-[var(--text-primary)] cursor-pointer"
            >
              사용 데이터 수집 허용
            </label>
            <p className="text-xs text-[var(--text-muted)]">
              앱 개선을 위해 익명화된 사용 데이터를 수집합니다. 개인 정보나 프로젝트 데이터는
              수집되지 않습니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
