// Modbus 요청/응답 트래픽 로그를 보관하는 링버퍼 스토어 (클라이언트 통계는 여기서 파생)

import { create } from 'zustand';
import type { ModbusTrafficEvent } from '../types/modbus';

/** 보관할 최대 트래픽 항목 수 (오래된 것부터 버림) */
const MAX_ENTRIES = 500;

/** 링버퍼에 들어가는 트래픽 항목 (React key 용 id 부여) */
export interface TrafficEntry extends ModbusTrafficEvent {
  /** 단조 증가 id */
  id: number;
}

/** 클라이언트 한 명에 대한 파생 통계 */
export interface ClientStat {
  clientAddr: string;
  protocol: 'tcp' | 'rtu';
  requestCount: number;
  exceptionCount: number;
  /** 가장 최근 활동 타임스탬프(ISO 8601) */
  lastActivity: string;
  /** function code 별 호출 횟수 */
  fcCounts: Record<number, number>;
}

interface TrafficState {
  /** 최신순(newest-first) 트래픽 항목 */
  entries: TrafficEntry[];
  /** 일시정지 시 신규 트래픽을 버린다 */
  paused: boolean;
}

interface TrafficActions {
  appendTraffic: (event: ModbusTrafficEvent) => void;
  clearTraffic: () => void;
  setPaused: (paused: boolean) => void;
}

let nextId = 1;

export const useModbusTrafficStore = create<TrafficState & TrafficActions>()((set) => ({
  entries: [],
  paused: false,

  appendTraffic: (event) =>
    set((state) => {
      if (state.paused) return state;
      const entry: TrafficEntry = { ...event, id: nextId++ };
      const entries = [entry, ...state.entries];
      if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
      return { entries };
    }),

  clearTraffic: () => set({ entries: [] }),

  setPaused: (paused) => set({ paused }),
}));

/**
 * 트래픽 항목 배열에서 클라이언트별 통계를 집계한다.
 * (컴포넌트에서 useMemo로 감싸 호출 — 셀렉터가 매번 새 배열을 만들지 않도록.)
 */
export function aggregateClientStats(entries: TrafficEntry[]): ClientStat[] {
  const byClient = new Map<string, ClientStat>();

  // entries는 최신순이므로, 각 클라이언트의 첫 등장이 곧 lastActivity.
  for (const e of entries) {
    let stat = byClient.get(e.client_addr);
    if (!stat) {
      stat = {
        clientAddr: e.client_addr,
        protocol: e.protocol,
        requestCount: 0,
        exceptionCount: 0,
        lastActivity: e.timestamp,
        fcCounts: {},
      };
      byClient.set(e.client_addr, stat);
    }
    stat.requestCount += 1;
    if (!e.success) stat.exceptionCount += 1;
    stat.fcCounts[e.function_code] = (stat.fcCounts[e.function_code] ?? 0) + 1;
  }

  return Array.from(byClient.values());
}

export default useModbusTrafficStore;
