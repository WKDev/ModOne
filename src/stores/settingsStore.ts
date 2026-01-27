import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
import { AppSettings, defaultSettings } from '../types/settings';

interface SettingsState {
  /** Current saved settings */
  settings: AppSettings;
  /** Pending changes not yet applied */
  pendingChanges: Partial<AppSettings>;
  /** Whether settings are being loaded */
  isLoading: boolean;
  /** Whether there's an error */
  error: string | null;
}

interface SettingsActions {
  /** Load settings from backend */
  loadSettings: () => Promise<void>;
  /** Save current settings to backend */
  saveSettings: () => Promise<void>;
  /** Update a pending change (doesn't save yet) */
  updatePending: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  /** Apply pending changes to settings and save */
  applyPending: () => Promise<void>;
  /** Discard all pending changes */
  discardPending: () => void;
  /** Check if there are unsaved changes */
  hasUnsavedChanges: () => boolean;
  /** Get merged settings (current + pending) for display */
  getMergedSettings: () => AppSettings;
  /** Reset settings to defaults */
  resetToDefaults: () => Promise<void>;
}

type SettingsStore = SettingsState & SettingsActions;

export const useSettingsStore = create<SettingsStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      settings: defaultSettings,
      pendingChanges: {},
      isLoading: false,
      error: null,

      // Actions
      loadSettings: async () => {
        set({ isLoading: true, error: null }, false, 'loadSettings/start');
        try {
          const settings = await invoke<AppSettings>('get_app_settings');
          set({ settings, isLoading: false }, false, 'loadSettings/success');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('Failed to load settings:', errorMessage);
          // Use defaults on error
          set({ settings: defaultSettings, isLoading: false, error: errorMessage }, false, 'loadSettings/error');
        }
      },

      saveSettings: async () => {
        const { settings } = get();
        set({ isLoading: true, error: null }, false, 'saveSettings/start');
        try {
          await invoke('save_app_settings', { settings });
          set({ isLoading: false }, false, 'saveSettings/success');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('Failed to save settings:', errorMessage);
          set({ isLoading: false, error: errorMessage }, false, 'saveSettings/error');
          throw error;
        }
      },

      updatePending: (key, value) => {
        set(
          (state) => ({
            pendingChanges: { ...state.pendingChanges, [key]: value },
          }),
          false,
          `updatePending/${key}`
        );
      },

      applyPending: async () => {
        const { settings, pendingChanges } = get();
        const newSettings = { ...settings, ...pendingChanges };

        set({ settings: newSettings, pendingChanges: {}, isLoading: true, error: null }, false, 'applyPending/start');

        try {
          await invoke('save_app_settings', { settings: newSettings });
          set({ isLoading: false }, false, 'applyPending/success');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('Failed to apply settings:', errorMessage);
          // Rollback on error
          set({ settings, isLoading: false, error: errorMessage }, false, 'applyPending/error');
          throw error;
        }
      },

      discardPending: () => {
        set({ pendingChanges: {}, error: null }, false, 'discardPending');
      },

      hasUnsavedChanges: () => {
        return Object.keys(get().pendingChanges).length > 0;
      },

      getMergedSettings: () => {
        const { settings, pendingChanges } = get();
        return { ...settings, ...pendingChanges };
      },

      resetToDefaults: async () => {
        set({ settings: defaultSettings, pendingChanges: {}, isLoading: true, error: null }, false, 'resetToDefaults/start');
        try {
          await invoke('save_app_settings', { settings: defaultSettings });
          set({ isLoading: false }, false, 'resetToDefaults/success');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('Failed to reset settings:', errorMessage);
          set({ isLoading: false, error: errorMessage }, false, 'resetToDefaults/error');
          throw error;
        }
      },
    }),
    { name: 'settings-store' }
  )
);
