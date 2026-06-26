import { useEffect, useMemo, useState } from 'react';

import { commandRegistry } from '../CommandPalette/commandRegistry';
import { useContextKeyStore } from '../../stores/contextKeyStore';
import {
  renderRibbonIcon,
  resolveRibbonTabs,
  useRibbonTabsConfig,
  type RibbonResolvedAction,
  type RibbonResolvedGroup,
  type RibbonTabId,
} from './ribbon';

function RibbonActionButton({ label, commandId, icon, disabled, active, dataTestId }: RibbonResolvedAction) {
  return (
    <button
      type="button"
      data-testid={dataTestId}
      disabled={disabled}
      title={label}
      onClick={() => { commandRegistry.execute(commandId).catch((err) => console.error(`Ribbon command failed: ${commandId}`, err)); }}
      className={`min-w-[58px] h-[52px] px-1.5 rounded-md text-[11px] flex flex-col items-center justify-center gap-1 transition-colors ${
        disabled
          ? 'cursor-not-allowed opacity-40 text-[var(--color-text-muted)]'
          : active
            ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]'
      }`}
    >
      <span className="flex items-center justify-center">{renderRibbonIcon(icon, 20)}</span>
      <span className="leading-none text-center">{label}</span>
    </button>
  );
}

function RibbonGroupView({ title, actions }: RibbonResolvedGroup) {
  return (
    <div className="flex shrink-0 flex-col px-1.5">
      <div className="flex flex-1 items-center gap-0.5">{actions.map((action) => <RibbonActionButton key={action.id} {...action} />)}</div>
      <div className="pt-0.5 text-center text-[10px] tracking-wide text-[var(--color-text-muted)]">{title}</div>
    </div>
  );
}

export function Toolbar() {
  const [activeTab, setActiveTab] = useState<RibbonTabId>('canvas');
  // Read enablement context from the shared context-key store (single vocabulary).
  const simulationStatus = useContextKeyStore((s) => s.simulationStatus);
  const scenarioStatus = useContextKeyStore((s) => s.scenarioStatus);
  const modbusTcpRunning = useContextKeyStore((s) => s.modbusTcpRunning);
  const opcuaRunning = useContextKeyStore((s) => s.opcuaRunning);
  const ribbonTabsConfig = useRibbonTabsConfig();

  const ribbonTabs = useMemo(
    () =>
      resolveRibbonTabs(ribbonTabsConfig, {
        simulationStatus,
        scenarioStatus,
        modbusTcpRunning,
        opcuaRunning,
      }),
    [ribbonTabsConfig, modbusTcpRunning, opcuaRunning, scenarioStatus, simulationStatus]
  );

  useEffect(() => {
    if (!ribbonTabs.some((tab) => tab.id === activeTab) && ribbonTabs.length > 0) {
      setActiveTab(ribbonTabs[0].id);
    }
  }, [activeTab, ribbonTabs]);

  const activeGroups = useMemo(
    () => ribbonTabs.find((tab) => tab.id === activeTab)?.groups ?? [],
    [activeTab, ribbonTabs]
  );

  return (
    <div
      data-testid="toolbar"
      className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
    >
      <div className="h-8 px-2 flex items-end gap-1 border-b border-[var(--color-border)]">
        {ribbonTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            data-testid={`ribbon-tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`h-7 px-3 rounded-t-md text-sm border-x border-t transition-colors ${
              activeTab === tab.id
                ? 'bg-[var(--color-bg-primary)] border-[var(--color-border)] text-[var(--color-text-primary)]'
                : 'border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="h-[68px] px-2 py-1.5 overflow-x-auto scrollbar-hide bg-[var(--color-bg-primary)]">
        <div className="flex h-full items-stretch min-w-max animate-tab-fade-in divide-x divide-[var(--color-border)]">
          {activeGroups.map((group) => (
            <RibbonGroupView key={group.id} {...group} />
          ))}
        </div>
      </div>
    </div>
  );
}
