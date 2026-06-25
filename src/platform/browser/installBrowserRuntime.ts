/**
 * Installs a Tauri-compatible runtime onto `window.__TAURI_INTERNALS__` so the
 * app runs as a pure web app, with no Rust backend.
 *
 * `@tauri-apps/api` dispatches every `invoke()` / event / window call through
 * `window.__TAURI_INTERNALS__`. By providing that object we make all 27 service
 * modules work unchanged in the browser — their `invoke()` calls land in the JS
 * command handlers (see `router.ts`) backed by IndexedDB.
 *
 * Guard: if `__TAURI_INTERNALS__` already exists (native Tauri, or the e2e
 * `tauri-mocks` fixture) we do nothing. We intentionally never set
 * `window.isTauri`, so `isTauri()` stays false and existing browser fallbacks
 * (e.g. licenseStore) keep working.
 */
import { IndexedDbStorage, type BrowserStorage } from './storage';
import { createInvoke } from './router';
import type { CommandMap } from './types';

type AnyFn = (...args: unknown[]) => unknown;

interface TauriInternals {
  invoke: (cmd: string, args?: Record<string, unknown>, options?: unknown) => Promise<unknown>;
  transformCallback: (callback: unknown, once?: boolean) => number;
  convertFileSrc: (filePath: string, protocol?: string) => string;
  unregisterCallback?: (id: number) => void;
  metadata: {
    currentWindow: { label: string };
    currentWebview: { label: string; windowLabel: string };
  };
  plugins: Record<string, unknown>;
}

type RuntimeWindow = Window & {
  __TAURI_INTERNALS__?: TauriInternals;
  __TAURI_CB_ID__?: number;
  [key: string]: unknown;
};

const DEFAULT_MONITOR = {
  name: 'Primary',
  position: { x: 0, y: 0 },
  size: { width: 1920, height: 1080 },
  scaleFactor: 1,
};

/**
 * @returns true if the runtime was installed, false if a Tauri host was already present.
 */
export function installBrowserRuntime(storage: BrowserStorage = new IndexedDbStorage()): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as RuntimeWindow;
  if (w.__TAURI_INTERNALS__) return false; // native Tauri or test mock already present

  // --- Event system --------------------------------------------------------
  type EventCallback = (event: { event: string; id: number; payload: unknown }) => void;
  const listeners = new Map<string, Map<number, EventCallback>>();
  let eventIdCounter = 1;

  const bucketFor = (name: string): Map<number, EventCallback> => {
    let bucket = listeners.get(name);
    if (!bucket) {
      bucket = new Map();
      listeners.set(name, bucket);
    }
    return bucket;
  };

  const emit = (name: string, payload: unknown): void => {
    const bucket = listeners.get(name);
    if (!bucket) return;
    for (const cb of bucket.values()) {
      try {
        cb({ event: name, id: -1, payload });
      } catch {
        /* listener errors must not break emit */
      }
    }
  };

  const resolveCallback = (id: unknown): EventCallback | null => {
    if (typeof id !== 'number') return null;
    const cb = w[`_${id}`];
    return typeof cb === 'function' ? (cb as EventCallback) : null;
  };

  // --- Command dispatch ----------------------------------------------------
  const baseInvoke = createInvoke(storage, emit);

  // Event + window/monitor plugin commands need the registry/state above,
  // so they are handled here and override the base map.
  const localCommands: CommandMap = {
    'plugin:event|listen'(args) {
      const name = String(args.event ?? '');
      const handlerId = args.handler;
      const cb = resolveCallback(handlerId);
      if (name && cb && typeof handlerId === 'number') {
        bucketFor(name).set(handlerId, cb);
      }
      return (handlerId as number) ?? eventIdCounter++;
    },
    'plugin:event|once'(args) {
      const name = String(args.event ?? '');
      const handlerId = args.handler;
      const cb = resolveCallback(handlerId);
      if (name && cb && typeof handlerId === 'number') {
        bucketFor(name).set(handlerId, (event) => {
          cb(event);
          listeners.get(name)?.delete(handlerId);
        });
      }
      return (handlerId as number) ?? eventIdCounter++;
    },
    'plugin:event|unlisten'(args) {
      const name = String(args.event ?? '');
      const id = args.eventId;
      if (name && typeof id === 'number') listeners.get(name)?.delete(id);
      return null;
    },
    'plugin:event|emit'(args) {
      const name = String(args.event ?? '');
      if (name) emit(name, args.payload ?? null);
      return null;
    },
    'plugin:event|emit_to'(args) {
      const name = String(args.event ?? '');
      if (name) emit(name, args.payload ?? null);
      return null;
    },
    'plugin:window|current_monitor': () => DEFAULT_MONITOR,
    'plugin:window|primary_monitor': () => DEFAULT_MONITOR,
    'plugin:window|available_monitors': () => [DEFAULT_MONITOR],
    'plugin:window|is_maximized': () => false,
    'plugin:window|is_minimized': () => false,
    'plugin:window|is_focused': () => true,
    'plugin:window|scale_factor': () => 1,
    'plugin:window|inner_size': () => ({ width: 1280, height: 800 }),
    'plugin:window|outer_size': () => ({ width: 1280, height: 800 }),
  };
  const windowNoops = [
    'plugin:window|maximize',
    'plugin:window|minimize',
    'plugin:window|unmaximize',
    'plugin:window|unminimize',
    'plugin:window|close',
    'plugin:window|destroy',
    'plugin:window|toggle_maximize',
    'plugin:window|set_title',
    'plugin:window|set_focus',
    'plugin:window|set_size',
    'plugin:window|set_position',
    'plugin:window|show',
    'plugin:window|hide',
    'plugin:window|start_dragging',
  ];
  for (const name of windowNoops) localCommands[name] = () => null;

  const invoke = (
    cmd: string,
    args: Record<string, unknown> = {},
    _options?: unknown
  ): Promise<unknown> => {
    const local = localCommands[cmd];
    if (local) return Promise.resolve(local(args, { storage, emit }));
    return baseInvoke(cmd, args);
  };

  // --- Install internals ---------------------------------------------------
  w.__TAURI_CB_ID__ = 0;
  w.__TAURI_INTERNALS__ = {
    invoke,
    transformCallback(callback: unknown, once?: boolean): number {
      const id = Number(w.__TAURI_CB_ID__ ?? 0);
      w.__TAURI_CB_ID__ = id + 1;
      if (typeof callback === 'function') {
        w[`_${id}`] = (...payload: unknown[]) => {
          (callback as AnyFn)(...payload);
          if (once) delete w[`_${id}`];
        };
      }
      return id;
    },
    convertFileSrc: (filePath: string): string => filePath,
    unregisterCallback(id: number) {
      delete w[`_${id}`];
    },
    metadata: {
      currentWindow: { label: 'main' },
      currentWebview: { label: 'main', windowLabel: 'main' },
    },
    plugins: {},
  };

  return true;
}
