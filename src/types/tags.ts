/**
 * Tag System Type Definitions
 *
 * Types for the tag-level event system that bridges
 * the Rust backend's CanonicalMemoryBus to the frontend.
 */

export interface TagDefinition {
  tagId: string;
  class: 'raw' | 'semantic';
  displayName: string;
  canonicalAddress: { area: string; index: number; bitIndex?: number };
  access: 'read' | 'readwrite';
  vendorAliases?: string[];
  description?: string;
  engineeringUnit?: string;
  /** Dot-separated folder path for OPC UA Address Space hierarchy (e.g. "Plant.Area1.Motors") */
  folderPath?: string;
}

export interface TagTypedValue {
  type: 'bool' | 'u16';
  data: boolean | number;
}

export interface TagValueChangedEvent {
  tagId: string;
  value: TagTypedValue;
  timestamp: string;
}

export interface TagValue {
  tagId: string;
  value: TagTypedValue;
  timestamp: string;
}

export interface CreateTagRequest {
  tagId?: string;
  displayName: string;
  area: string;
  index: number;
  bitIndex?: number;
  access?: 'read' | 'readwrite';
  description?: string;
  engineeringUnit?: string;
  /** Dot-separated folder path for OPC UA Address Space hierarchy */
  folderPath?: string;
}

export interface UpdateTagRequest {
  tagId: string;
  displayName?: string;
  description?: string | null;
  engineeringUnit?: string | null;
  /** Dot-separated folder path for OPC UA Address Space hierarchy */
  folderPath?: string | null;
}

export const TAG_EVENTS = {
  VALUE_CHANGED: 'tags:value-changed',
  REGISTRY_CHANGED: 'tags:registry-changed',
} as const;
