/**
 * Tag Service - Tauri Command Wrappers
 *
 * Provides type-safe wrappers around Tauri backend commands
 * for tag browsing, reading, writing, and event subscription.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { toast } from 'sonner';
import type {
  CreateTagRequest,
  TagDefinition,
  TagTypedValue,
  TagValue,
  TagValueChangedEvent,
  UpdateTagRequest,
} from '../types/tags';
import { TAG_EVENTS } from '../types/tags';

export const tagService = {
  async listTags(includeRaw?: boolean): Promise<TagDefinition[]> {
    try {
      return await invoke<TagDefinition[]>('list_tags', {
        includeRaw: includeRaw ?? true,
      });
    } catch (error) {
      toast.error('태그 목록 조회 실패', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  async readTags(tagIds: string[]): Promise<TagValue[]> {
    try {
      return await invoke<TagValue[]>('read_tags', { tagIds });
    } catch (error) {
      toast.error('태그 값 읽기 실패', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  async writeTag(tagId: string, value: TagTypedValue): Promise<void> {
    try {
      await invoke('write_tag', { tagId, value });
    } catch (error) {
      toast.error('태그 쓰기 실패', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  async createTag(request: CreateTagRequest): Promise<TagDefinition> {
    try {
      return await invoke<TagDefinition>('create_tag', { request });
    } catch (error) {
      toast.error('태그 생성 실패', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  async deleteTag(tagId: string): Promise<void> {
    try {
      await invoke('delete_tag', { tagId });
    } catch (error) {
      toast.error('태그 삭제 실패', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /** Batch-delete multiple tags in a single IPC round-trip. Returns IDs that were successfully deleted. */
  async deleteTags(tagIds: string[]): Promise<string[]> {
    try {
      return await invoke<string[]>('delete_tags', { tagIds });
    } catch (error) {
      toast.error('태그 일괄 삭제 실패', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  async updateTagDefinition(request: UpdateTagRequest): Promise<TagDefinition> {
    try {
      return await invoke<TagDefinition>('update_tag_definition', { request });
    } catch (error) {
      toast.error('태그 정의 업데이트 실패', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  async checkCanonicalAddressDuplicate(
    area: string,
    index: number,
    bitIndex?: number,
    excludeTagId?: string,
  ): Promise<string[]> {
    try {
      return await invoke<string[]>('check_canonical_address_duplicate', {
        area,
        index,
        bitIndex: bitIndex ?? null,
        excludeTagId: excludeTagId ?? null,
      });
    } catch (error) {
      toast.error('주소 중복 검사 실패', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  async setWatchedTags(tagIds: string[]): Promise<void> {
    try {
      await invoke('set_watched_tags', { tagIds });
    } catch (error) {
      toast.error('태그 구독 설정 실패', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  async onValueChanged(
    cb: (event: TagValueChangedEvent) => void,
  ): Promise<UnlistenFn> {
    return listen<TagValueChangedEvent>(TAG_EVENTS.VALUE_CHANGED, (event) => {
      cb(event.payload);
    });
  },

  async onRegistryChanged(cb: () => void): Promise<UnlistenFn> {
    return listen(TAG_EVENTS.REGISTRY_CHANGED, () => {
      cb();
    });
  },

};

export default tagService;
