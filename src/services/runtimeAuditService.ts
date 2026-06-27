// 런타임 운영 감사 로그(force 설정·해제, 시뮬 제어) 조회 서비스 래퍼
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import type { AuditSeverity } from './opcuaService';

export type { AuditSeverity };

/** 런타임 감사 항목 (백엔드 camelCase serde). 카테고리/이벤트타입은 문자열. */
export interface RuntimeAuditEntry {
  id: number;
  timestamp: string;
  /** 항상 'runtime_control'. */
  category: string;
  /** force_set | force_release | sim_start | sim_stop | sim_pause | sim_resume | sim_reset */
  eventType?: string | null;
  severity: AuditSeverity;
  message: string;
  /** 추가 상세(force는 {address,value} JSON). */
  detail?: string | null;
  source?: string | null;
}

/** 런타임 감사 조회 필터. */
export interface RuntimeAuditQuery {
  eventType?: string;
  severity?: AuditSeverity;
  from?: string;
  to?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

/** 조회 결과 + 전체 매칭 수. */
export interface RuntimeAuditResult {
  entries: RuntimeAuditEntry[];
  totalCount: number;
}

export const runtimeAuditService = {
  /** 런타임 운영 감사 로그를 필터로 조회한다. */
  async query(query: RuntimeAuditQuery = {}): Promise<RuntimeAuditResult> {
    try {
      return await invoke<RuntimeAuditResult>('runtime_query_audit_log', { query });
    } catch (error) {
      toast.error('런타임 감사 로그 조회 실패', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
};
