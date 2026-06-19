import { useEffect, useMemo, useState } from 'react';

import { commandRegistry } from '../CommandPalette/commandRegistry';
import { useLayoutStore } from '../../stores/layoutStore';
import { useScenarioStore } from '../../stores/scenarioStore';
import { useModbusStore } from '../../stores/modbusStore';
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
      className={`group min-w-[82px] h-[74px] px-2 py-1.5 rounded-md border text-xs flex flex-col items-center justify-center gap-1 transition-colors ${
        disabled
          ? 'cursor-not-allowed opacity-45 border-[var(--color-border)] text-[var(--color-text-muted)]'
          : active
            ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-text-primary)]'
            : 'border-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]'
      }`}
    >
      <span className="flex items-center justify-center">{renderRibbonIcon(icon)}</span>
      <span className="leading-tight text-center">{label}</span>
    </button>
  );
}

function RibbonGroupView({ title, actions }: RibbonResolvedGroup) {
  return (
    <div className="flex h-[86px] shrink-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
      <div className="flex items-start gap-1 px-2 py-1.5">{actions.map((action) => <RibbonActionButton key={action.id} {...action} />)}</div>
      <div className="w-7 border-l border-[var(--color-border)] flex items-end justify-center pb-1">
        <span className="text-[10px] tracking-wide [writing-mode:vertical-rl] rotate-180 text-[var(--color-text-muted)]">{title}</span>
      </div>
    </div>
  );
}

export function Toolbar() {
  const [activeTab, setActiveTab] = useState<RibbonTabId>('canvas');
  const { simulationStatus, opcuaRunning } = useLayoutStore();
  const scenarioStatus = useScenarioStore((state) => state.executionState.status);
  const modbusStatus = useModbusStore((state) => state.status);
  const ribbonTabsConfig = useRibbonTabsConfig();

  const ribbonTabs = useMemo(
    () =>
      resolveRibbonTabs(ribbonTabsConfig, {
        simulationStatus,
        scenarioStatus,
        modbusTcpRunning: Boolean(modbusStatus?.tcp_running),
        opcuaRunning,
      }),
    [ribbonTabsConfig, modbusStatus?.tcp_running, opcuaRunning, scenarioStatus, simulationStatus]
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

      <div className="h-[92px] px-2 py-1 overflow-x-auto scrollbar-hide bg-[var(--color-bg-primary)]">
        <div className="flex items-stretch gap-2 min-w-max animate-tab-fade-in">
          {activeGroups.map((group) => (
            <RibbonGroupView key={group.id} {...group} />
          ))}
        </div>
      </div>
    </div>
  );
}
