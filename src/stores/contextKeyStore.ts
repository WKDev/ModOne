// 명령의 가시성/활성 판단에 쓰이는 공유 컨텍스트 키를 모으는 반응형 store.
// 리본 predicate(RibbonContext)와 Command when() 클로저가 같은 어휘를 읽도록 단일화한다.
// 값 자체는 소스 store들에서 useContextKeySync 훅이 흘려보낸다 (SSOT는 소스 store).

import { create } from 'zustand';
import type { PanelType } from '../types/panel';

export interface ContextKeys {
  /** 현재 활성 에디터 탭의 패널 타입 (없으면 null) */
  activeEditorType: PanelType | null;
  simulationStatus: 'running' | 'paused' | 'stopped';
  scenarioStatus: 'idle' | 'running' | 'paused' | 'stopped';
  modbusTcpRunning: boolean;
  opcuaRunning: boolean;
}

interface ContextKeyStore extends ContextKeys {
  /** 변경된 키만 부분 갱신 (useContextKeySync 전용) */
  setKeys: (partial: Partial<ContextKeys>) => void;
}

const initialKeys: ContextKeys = {
  activeEditorType: null,
  simulationStatus: 'stopped',
  scenarioStatus: 'idle',
  modbusTcpRunning: false,
  opcuaRunning: false,
};

export const useContextKeyStore = create<ContextKeyStore>((set) => ({
  ...initialKeys,
  setKeys: (partial) => set(partial),
}));
