import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '@tauri-apps/api/core';

export type LicenseStatusType = 'Valid' | 'Trial' | 'Expired' | 'Unlicensed';

export interface LicenseInfo {
  status: LicenseStatusType;
  trialDaysLeft?: number;
  machineId: string;
  leaseExpiry: string | null;
}

interface LicenseStore {
  licenseInfo: LicenseInfo | null;
  isLoading: boolean;
  error: string | null;
  dialogOpen: boolean;
  fetchLicenseInfo: () => Promise<void>;
  activate: (key: string) => Promise<void>;
  checkout: (key: string) => Promise<void>;
  deactivate: () => Promise<void>;
  openDialog: () => void;
  closeDialog: () => void;
}

export const useLicenseStore = create<LicenseStore>((set, get) => ({
  licenseInfo: null,
  isLoading: true,
  error: null,
  dialogOpen: false,

  fetchLicenseInfo: async () => {
    if (!isTauri()) {
      // Browser fallback for testing UI
      set({ 
        licenseInfo: { status: 'Valid', machineId: 'browser-mock-id', leaseExpiry: null },
        isLoading: false 
      });
      return;
    }
    
    set({ isLoading: true, error: null });
    try {
      const info: any = await invoke('get_license_info');
      // The Rust backend returns an enum for status, need to parse it
      let status: LicenseStatusType = 'Unlicensed';
      let trialDaysLeft: number | undefined;

      if (typeof info.status === 'string') {
        status = info.status as LicenseStatusType;
      } else if (typeof info.status === 'object' && info.status.Trial) {
        status = 'Trial';
        trialDaysLeft = info.status.Trial.days_left;
      } else if (info.status === 'Valid') {
        status = 'Valid';
      }

      set({
        licenseInfo: {
          status,
          trialDaysLeft,
          machineId: info.machine_id,
          leaseExpiry: info.lease_expiry,
        },
        isLoading: false,
      });

      // If unlicensed, force open the dialog
      if (status === 'Unlicensed' || status === 'Expired') {
        set({ dialogOpen: true });
      }

    } catch (error) {
      console.error('Failed to get license info', error);
      set({ error: String(error), isLoading: false });
    }
  },

  activate: async (key: string) => {
    set({ isLoading: true, error: null });
    try {
      await invoke('activate_license', { key });
      await get().fetchLicenseInfo();
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  checkout: async (key: string) => {
    set({ isLoading: true, error: null });
    try {
      await invoke('checkout_license', { key });
      await get().fetchLicenseInfo();
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  deactivate: async () => {
    set({ isLoading: true, error: null });
    try {
      await invoke('deactivate_license');
      await get().fetchLicenseInfo();
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  openDialog: () => set({ dialogOpen: true }),
  closeDialog: () => {
    // Only allow closing if valid or trial
    const status = get().licenseInfo?.status;
    if (status === 'Valid' || status === 'Trial') {
      set({ dialogOpen: false });
    }
  },
}));
