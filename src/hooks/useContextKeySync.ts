// 소스 store들을 구독해 context-key store로 흘려보내는 브리지 훅 (App에 한 번만 마운트).
// 소스가 SSOT이고 context-key store는 그 투영(projection)일 뿐이다.

import { useEffect } from 'react';
import { useContextKeyStore } from '../stores/contextKeyStore';
import { useLayoutStore } from '../stores/layoutStore';
import { useScenarioStore } from '../stores/scenarioStore';
import { useModbusStore } from '../stores/modbusStore';
import { useEditorAreaStore } from '../stores/editorAreaStore';

export function useContextKeySync(): void {
  const simulationStatus = useLayoutStore((s) => s.simulationStatus);
  const opcuaRunning = useLayoutStore((s) => s.opcuaRunning);
  const scenarioStatus = useScenarioStore((s) => s.executionState.status);
  const modbusTcpRunning = useModbusStore((s) => Boolean(s.status?.tcp_running));
  const activeEditorType = useEditorAreaStore(
    (s) => s.tabs.find((t) => t.id === s.activeTabId)?.panelType ?? null,
  );

  useEffect(() => {
    useContextKeyStore.getState().setKeys({
      simulationStatus,
      opcuaRunning,
      scenarioStatus,
      modbusTcpRunning,
      activeEditorType,
    });
  }, [simulationStatus, opcuaRunning, scenarioStatus, modbusTcpRunning, activeEditorType]);
}
