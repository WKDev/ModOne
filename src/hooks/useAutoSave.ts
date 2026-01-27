import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

interface AutoSaveSettings {
  enabled: boolean;
  interval_secs: number;
  backup_count: number;
}

interface UseAutoSaveReturn {
  settings: AutoSaveSettings;
  isLoading: boolean;
  error: string | null;
  lastSaveTime: Date | null;
  updateEnabled: (enabled: boolean) => Promise<void>;
  updateInterval: (secs: number) => Promise<void>;
  updateBackupCount: (count: number) => Promise<void>;
  startAutoSave: () => Promise<void>;
  stopAutoSave: () => Promise<void>;
}

const defaultSettings: AutoSaveSettings = {
  enabled: true,
  interval_secs: 300,
  backup_count: 3,
};

export function useAutoSave(): UseAutoSaveReturn {
  const [settings, setSettings] = useState<AutoSaveSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);

  // Fetch settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      try {
        const result = await invoke<AutoSaveSettings>('get_auto_save_settings');
        setSettings(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // Subscribe to auto-save events
  useEffect(() => {
    let unlistenCompleted: UnlistenFn | null = null;
    let unlistenFailed: UnlistenFn | null = null;

    const setupListeners = async () => {
      unlistenCompleted = await listen('auto-save-completed', () => {
        setLastSaveTime(new Date());
      });

      unlistenFailed = await listen<string>('auto-save-failed', (event) => {
        console.error('Auto-save failed:', event.payload);
        setError(`Auto-save failed: ${event.payload}`);
      });
    };

    setupListeners();

    return () => {
      unlistenCompleted?.();
      unlistenFailed?.();
    };
  }, []);

  const updateEnabled = useCallback(async (enabled: boolean) => {
    setIsLoading(true);
    try {
      await invoke('set_auto_save_enabled', { enabled });
      setSettings((prev) => ({ ...prev, enabled }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateInterval = useCallback(async (secs: number) => {
    if (secs < 30) {
      throw new Error('Interval must be at least 30 seconds');
    }
    setIsLoading(true);
    try {
      await invoke('set_auto_save_interval', { secs });
      setSettings((prev) => ({ ...prev, interval_secs: secs }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateBackupCount = useCallback(async (count: number) => {
    if (count < 1 || count > 10) {
      throw new Error('Backup count must be between 1 and 10');
    }
    setIsLoading(true);
    try {
      await invoke('set_backup_count', { count });
      setSettings((prev) => ({ ...prev, backup_count: count }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startAutoSave = useCallback(async () => {
    try {
      await invoke('start_auto_save');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, []);

  const stopAutoSave = useCallback(async () => {
    try {
      await invoke('stop_auto_save');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, []);

  return {
    settings,
    isLoading,
    error,
    lastSaveTime,
    updateEnabled,
    updateInterval,
    updateBackupCount,
    startAutoSave,
    stopAutoSave,
  };
}
