import { useState } from 'react';
import { Moon, Save, MessageSquare, ChevronRight } from 'lucide-react';

interface ToggleProps {
  label: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function Toggle({ label, icon, checked, onChange }: ToggleProps) {
  return (
    <label className="flex items-center justify-between py-2 cursor-pointer hover:bg-gray-700 px-3 -mx-3 rounded">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm text-gray-300">{label}</span>
      </div>
      <div
        className={`w-10 h-5 rounded-full relative transition-colors ${
          checked ? 'bg-blue-600' : 'bg-gray-600'
        }`}
        onClick={() => onChange(!checked)}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </div>
    </label>
  );
}

interface SettingsLinkProps {
  label: string;
  onClick: () => void;
}

function SettingsLink({ label, onClick }: SettingsLinkProps) {
  return (
    <button
      className="w-full flex items-center justify-between py-2 px-3 -mx-3 hover:bg-gray-700 rounded text-sm text-gray-300"
      onClick={onClick}
    >
      <span>{label}</span>
      <ChevronRight size={16} className="text-gray-500" />
    </button>
  );
}

export function SettingsPanel() {
  // Local state for quick toggles - will be connected to actual settings store
  const [darkMode, setDarkMode] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [showTooltips, setShowTooltips] = useState(true);

  const handleOpenSettings = (section: string) => {
    console.log('Open settings:', section);
    // TODO: Open settings dialog at specific section
  };

  return (
    <div className="p-3 space-y-4">
      {/* Quick Toggles */}
      <div className="bg-gray-900 rounded-lg p-3">
        <h3 className="text-xs font-semibold uppercase text-gray-400 mb-2">
          Quick Settings
        </h3>

        <div className="space-y-1">
          <Toggle
            label="Dark Mode"
            icon={<Moon size={16} className="text-gray-400" />}
            checked={darkMode}
            onChange={setDarkMode}
          />
          <Toggle
            label="Auto Save"
            icon={<Save size={16} className="text-gray-400" />}
            checked={autoSave}
            onChange={setAutoSave}
          />
          <Toggle
            label="Show Tooltips"
            icon={<MessageSquare size={16} className="text-gray-400" />}
            checked={showTooltips}
            onChange={setShowTooltips}
          />
        </div>
      </div>

      {/* Settings Links */}
      <div className="bg-gray-900 rounded-lg p-3">
        <h3 className="text-xs font-semibold uppercase text-gray-400 mb-2">
          All Settings
        </h3>

        <div>
          <SettingsLink
            label="General"
            onClick={() => handleOpenSettings('general')}
          />
          <SettingsLink
            label="Simulation"
            onClick={() => handleOpenSettings('simulation')}
          />
          <SettingsLink
            label="Modbus"
            onClick={() => handleOpenSettings('modbus')}
          />
          <SettingsLink
            label="Appearance"
            onClick={() => handleOpenSettings('appearance')}
          />
          <SettingsLink
            label="Keyboard Shortcuts"
            onClick={() => handleOpenSettings('shortcuts')}
          />
        </div>
      </div>

      {/* Version Info */}
      <div className="text-xs text-gray-500 text-center pt-2">
        <p>ModOne v0.1.0</p>
        <p className="mt-1">Built with Tauri 2.x</p>
      </div>
    </div>
  );
}
