/**
 * Tauri plugin command handlers (path / dialog / fs / shell).
 *
 * These back `@tauri-apps/plugin-*` and `@tauri-apps/api/path` calls, which all
 * route through `invoke('plugin:<name>|<cmd>', ...)`. Event and window plugins
 * need the listener registry and are handled inside `installBrowserRuntime.ts`.
 */
import type { CommandMap } from '../types';

export const pluginCommands: CommandMap = {
  // ---- path ---------------------------------------------------------------
  'plugin:path|document_dir'(): string {
    return '/modone';
  },
  'plugin:path|join'(args): string {
    const paths = Array.isArray(args.paths) ? args.paths : [];
    return paths.map((p) => String(p)).join('/').replace(/\/{2,}/g, '/');
  },
  'plugin:path|resolve_directory'(): string {
    return '/modone';
  },

  // ---- dialog -------------------------------------------------------------
  // No native pickers in the browser. The New Project dialog auto-fills its
  // path, so returning null here is harmless.
  'plugin:dialog|open'(): string | null {
    return null;
  },
  'plugin:dialog|save'(): string | null {
    return null;
  },
  'plugin:dialog|ask'(): boolean {
    return false;
  },
  'plugin:dialog|confirm'(): boolean {
    return false;
  },
  'plugin:dialog|message'(): null {
    return null;
  },

  // ---- fs -----------------------------------------------------------------
  'plugin:fs|read_dir'(): unknown[] {
    return [];
  },
  'plugin:fs|exists'(): boolean {
    return false;
  },
  'plugin:fs|read_text_file'(): string {
    return '';
  },
  'plugin:fs|write_text_file'(): null {
    return null;
  },
  'plugin:fs|mkdir'(): null {
    return null;
  },

  // ---- shell --------------------------------------------------------------
  'plugin:shell|open'(): null {
    return null;
  },
};
