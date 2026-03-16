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

export const TAG_EVENTS = {
  VALUE_CHANGED: 'tags:value-changed',
  REGISTRY_CHANGED: 'tags:registry-changed',
} as const;
