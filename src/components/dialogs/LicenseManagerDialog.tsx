import React, { useState } from 'react';
import { useLicenseStore } from '../../stores/licenseStore';
import { X, Key, ShieldCheck, ShieldAlert, Monitor, Calendar } from 'lucide-react';

export const LicenseManagerDialog: React.FC = () => {
  const {
    licenseInfo,
    isLoading,
    error,
    dialogOpen,
    closeDialog,
    activate,
    checkout,
    deactivate
  } = useLicenseStore();

  const [licenseKey, setLicenseKey] = useState('');
  const [actionError, setActionError] = useState('');

  if (!dialogOpen) return null;

  const isBlocked = licenseInfo?.status === 'Unlicensed' || licenseInfo?.status === 'Expired';

  const handleActivate = async () => {
    setActionError('');
    try {
      await activate(licenseKey);
    } catch (err) {
      setActionError(String(err));
    }
  };

  const handleCheckout = async () => {
    setActionError('');
    try {
      await checkout(licenseKey);
    } catch (err) {
      setActionError(String(err));
    }
  };

  const handleDeactivate = async () => {
    if (!window.confirm('Are you sure you want to deactivate this machine? You will need internet access to activate again.')) return;
    setActionError('');
    try {
      await deactivate();
    } catch (err) {
      setActionError(String(err));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Key size={20} className="text-[var(--color-accent)]" />
            License Manager
          </h2>
          {!isBlocked && (
            <button
              onClick={closeDialog}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-6">
          {/* Status Banner */}
          <div className={`p-4 rounded-md flex items-start gap-3 ${
            licenseInfo?.status === 'Valid' ? 'bg-green-500/10 border border-green-500/20 text-green-400' :
            licenseInfo?.status === 'Trial' ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400' :
            'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}>
            {licenseInfo?.status === 'Valid' ? <ShieldCheck size={24} className="mt-0.5" /> : <ShieldAlert size={24} className="mt-0.5" />}
            <div>
              <h3 className="font-medium text-base">
                {licenseInfo?.status === 'Valid' ? 'License is Active' :
                 licenseInfo?.status === 'Trial' ? `Trial Mode (${licenseInfo.trialDaysLeft} days left)` :
                 'Activation Required'}
              </h3>
              <p className="text-sm opacity-80 mt-1">
                {licenseInfo?.status === 'Valid' ? 'Thank you for purchasing ModOne. Your machine is successfully registered and licensed.' :
                 licenseInfo?.status === 'Trial' ? 'You are currently evaluating ModOne. Please purchase a license to unlock full access.' :
                 'ModOne requires a valid license to run. Please enter your license key to activate.'}
              </p>
            </div>
          </div>

          {/* Machine Info */}
          <div className="bg-[var(--color-bg-secondary)] p-4 rounded-md border border-[var(--color-border)] flex flex-col gap-3">
            <div className="flex items-center gap-3 text-sm">
              <Monitor size={16} className="text-[var(--color-text-muted)]" />
              <span className="text-[var(--color-text-secondary)] w-24">Machine ID:</span>
              <span className="font-mono text-[var(--color-text-primary)] select-all bg-[var(--color-bg-tertiary)] px-2 py-0.5 rounded">
                {licenseInfo?.machineId || 'Loading...'}
              </span>
            </div>
            {licenseInfo?.leaseExpiry && (
              <div className="flex items-center gap-3 text-sm">
                <Calendar size={16} className="text-[var(--color-text-muted)]" />
                <span className="text-[var(--color-text-secondary)] w-24">Lease Expiry:</span>
                <span className="text-[var(--color-text-primary)]">
                  {new Date(licenseInfo.leaseExpiry).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Error Message */}
          {(error || actionError) && (
            <div className="text-red-400 text-sm p-3 bg-red-500/10 border border-red-500/20 rounded-md">
              {error || actionError}
            </div>
          )}

          {/* Key Input & Actions */}
          {licenseInfo?.status !== 'Valid' ? (
            <div className="flex flex-col gap-3">
              <label className="text-sm text-[var(--color-text-secondary)]">License Key</label>
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                className="w-full bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md px-3 py-2 font-mono focus:outline-none focus:border-[var(--color-accent)] transition-colors"
              />
              <div className="flex gap-3 mt-2">
                <button
                  onClick={handleActivate}
                  disabled={isLoading || !licenseKey.trim()}
                  className="flex-1 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white py-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Activating...' : 'Activate Online'}
                </button>
                <button
                  onClick={handleCheckout}
                  disabled={isLoading || !licenseKey.trim()}
                  className="flex-1 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] py-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Checkout a 7-day offline lease"
                >
                  Offline Checkout
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={handleDeactivate}
                disabled={isLoading}
                className="px-4 py-2 border border-red-500/30 text-red-500 hover:bg-red-500/10 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Deactivate Machine
              </button>
              <button
                onClick={closeDialog}
                className="px-6 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-md font-medium transition-colors"
              >
                Close
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
