import { expect, test as base, type Page } from '@playwright/test';

type TauriFixtureFactory = {
  test: typeof base;
  expect: typeof expect;
};

type TauriEvent = {
  event: string;
  id: number;
  payload: unknown;
};

export async function injectTauriMocks(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type Callback = (event: TauriEvent) => void;
    type ListenerBucket = Map<number, Callback>;
    type EventStore = Map<string, ListenerBucket>;
    type MockWindow = Window & {
      __TAURI_CB_ID__?: number;
      __TAURI_INTERNALS__?: {
        invoke: (cmd: string, args?: Record<string, unknown>, options?: unknown) => Promise<unknown>;
        transformCallback: (callback: unknown, once?: boolean) => number;
        convertFileSrc: (filePath: string, protocol?: string) => string;
        metadata: {
          currentWindow: { label: string };
          currentWebview: { label: string; windowLabel: string };
        };
        plugins: Record<string, unknown>;
      };
      __TAURI_MOCKS__?: {
        event: {
          listen: (event: string, handler: Callback) => Promise<() => Promise<void>>;
          emit: (event: string, payload?: unknown) => Promise<void>;
          once: (event: string, handler: Callback) => Promise<() => Promise<void>>;
        };
        window: {
          Window: new (label: string) => {
            label: string;
            minimize: () => Promise<void>;
            maximize: () => Promise<void>;
            close: () => Promise<void>;
            toggleMaximize: () => Promise<void>;
            setTitle: (_title: string) => Promise<void>;
            isMaximized: () => Promise<boolean>;
          };
          getCurrentWindow: () => {
            label: string;
            minimize: () => Promise<void>;
            maximize: () => Promise<void>;
            close: () => Promise<void>;
            toggleMaximize: () => Promise<void>;
            setTitle: (_title: string) => Promise<void>;
            isMaximized: () => Promise<boolean>;
          };
          availableMonitors: () => Promise<Array<Record<string, unknown>>>;
        };
        core: {
          invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
        };
        path: {
          documentDir: () => Promise<string>;
          join: (...parts: string[]) => Promise<string>;
        };
        dialog: {
          open: () => Promise<string | null>;
          save: () => Promise<string | null>;
          ask: () => Promise<boolean>;
        };
        fs: {
          readDir: () => Promise<unknown[]>;
          exists: () => Promise<boolean>;
          readTextFile: () => Promise<string>;
          writeTextFile: () => Promise<void>;
        };
        shell: {
          open: () => Promise<void>;
        };
      };
      [key: string]: unknown;
    };

    const w = window as unknown as MockWindow;
    const listeners: EventStore = new Map();
    let eventIdCounter = 1;
    let lastActiveLayout: string | null = null;
    let restoreLastSession = true;

    const defaultMonitor = {
      name: 'Primary',
      position: { x: 0, y: 0 },
      size: { width: 1920, height: 1080 },
      scaleFactor: 1,
    };

    const makeDefaultLayout = (name: string) => ({
      name,
      grid: { columns: ['1fr'], rows: ['1fr'] },
      panels: [],
      sidebar: { visible: true, width: 280, activePanel: 'explorer' },
      floatingWindows: [],
      updatedAt: new Date().toISOString(),
    });

    const ensureBucket = (eventName: string): ListenerBucket => {
      let bucket = listeners.get(eventName);
      if (!bucket) {
        bucket = new Map();
        listeners.set(eventName, bucket);
      }
      return bucket;
    };

    const resolveCallback = (id: unknown): Callback | null => {
      if (typeof id !== 'number') {
        return null;
      }
      const cb = w[`_${id}`];
      return typeof cb === 'function' ? (cb as Callback) : null;
    };

    const emitEvent = (eventName: string, payload: unknown): void => {
      const bucket = listeners.get(eventName);
      if (!bucket) {
        return;
      }
      const event: TauriEvent = { event: eventName, id: -1, payload };
      for (const callback of bucket.values()) {
        try {
          callback(event);
        } catch {}
      }
    };

    const addListener = (eventName: string, handler: Callback): (() => Promise<void>) => {
      const id = eventIdCounter++;
      ensureBucket(eventName).set(id, handler);
      return async () => {
        listeners.get(eventName)?.delete(id);
      };
    };

    const currentWindow = {
      label: 'main',
      async minimize(): Promise<void> {
        return;
      },
      async maximize(): Promise<void> {
        return;
      },
      async close(): Promise<void> {
        return;
      },
      async toggleMaximize(): Promise<void> {
        return;
      },
      async setTitle(_title: string): Promise<void> {
        return;
      },
      async isMaximized(): Promise<boolean> {
        return false;
      },
      async isMinimized(): Promise<boolean> {
        return false;
      },
      async isFocused(): Promise<boolean> {
        return true;
      },
      async show(): Promise<void> {
        return;
      },
      async hide(): Promise<void> {
        return;
      },
      async setFocus(): Promise<void> {
        return;
      },
    };

    class MockTauriWindow {
      label: string;

      constructor(label: string) {
        this.label = label;
      }

      async minimize(): Promise<void> {
        return;
      }

      async maximize(): Promise<void> {
        return;
      }

      async close(): Promise<void> {
        return;
      }

      async toggleMaximize(): Promise<void> {
        return;
      }

      async setTitle(_title: string): Promise<void> {
        return;
      }

      async isMaximized(): Promise<boolean> {
        return false;
      }
    }

    const invoke = async (cmd: string, args: Record<string, unknown> = {}): Promise<unknown> => {
      switch (cmd) {
        case 'create_project':
          return {
            name: String(args.name ?? 'MockProject'),
            path: String(args.projectDir ?? '/tmp/MockProject/mock.mop'),
            created_at: new Date().toISOString(),
          };
        case 'open_project':
          return {
            config: {
              version: '1.0',
              project: {
                name: 'MockProject',
                description: '',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              plc: { manufacturer: 'LS', model: 'XGK-CPUHN', scan_time_ms: 10 },
              modbus: {
                tcp: { enabled: true, port: 502, unit_id: 1 },
                rtu: { enabled: false, com_port: '', baud_rate: 9600, parity: 'None', stop_bits: 1 },
              },
              memory_map: {
                coil_start: 0,
                coil_count: 1000,
                discrete_input_start: 0,
                discrete_input_count: 1000,
                holding_register_start: 0,
                holding_register_count: 1000,
                input_register_start: 0,
                input_register_count: 1000,
              },
              auto_save: { enabled: true, interval_secs: 300, backup_count: 3 },
            },
            is_modified: false,
          };
        case 'get_recent_projects':
          return [];
        case 'get_project_status':
          return { is_open: false, is_modified: false };
        case 'get_auto_save_settings':
          return { enabled: true, interval_secs: 300, backup_count: 3 };
        case 'save_project':
        case 'close_project':
        case 'close_project_force':
        case 'mark_project_modified':
        case 'remove_from_recent':
        case 'clear_recent_projects':
        case 'set_auto_save_enabled':
        case 'set_auto_save_interval':
        case 'set_backup_count':
        case 'start_auto_save':
        case 'stop_auto_save':
          return null;

        case 'canvas_save_circuit':
        case 'canvas_create_circuit':
        case 'canvas_delete_circuit':
        case 'canvas_sync_init':
        case 'canvas_sync_shutdown':
        case 'canvas_sync_register_mapping':
        case 'canvas_sync_remove_mapping':
        case 'canvas_sync_clear_mappings':
        case 'canvas_sync_handle_input':
        case 'canvas_sync_reset_stats':
          return null;

        case 'save_layout':
          return null;
        case 'load_layout':
          return makeDefaultLayout(String(args.name ?? 'Default'));
        case 'list_layouts':
          return [];
        case 'delete_layout':
          return null;
        case 'set_last_active_layout':
          lastActiveLayout = typeof args.layout_name === 'string' ? args.layout_name : null;
          return null;
        case 'get_last_active_layout':
          return lastActiveLayout;
        case 'set_restore_last_session':
          restoreLastSession = Boolean(args.enabled);
          return null;
        case 'get_restore_last_session':
          return restoreLastSession;

        case 'sim_run':
          return null;
        case 'sim_stop':
          return null;
        case 'sim_pause':
          return null;
        case 'sim_resume':
          return null;
        case 'sim_step':
          return { success: true, stepType: 'network', scanCount: 1 };
        case 'sim_reset':
          return null;
        case 'sim_load_program':
          return null;
        case 'sim_continue':
          return null;
        case 'sim_add_watch':
          return null;
        case 'sim_remove_watch':
          return null;
        case 'sim_remove_breakpoint':
          return null;
        case 'sim_add_breakpoint':
          return `bp-${Date.now()}`;

        case 'modbus_start_tcp':
        case 'modbus_stop_tcp':
        case 'modbus_start_rtu':
        case 'modbus_stop_rtu':
          return null;
        case 'modbus_list_serial_ports':
          return [];
        case 'modbus_get_status':
          return {
            tcp_running: false,
            rtu_running: false,
            tcp_port: 502,
            rtu_port: null,
            connection_count: 0,
            connections: [],
          };
        case 'modbus_read_coils':
        case 'modbus_read_discrete_inputs': {
          const count = Number(args.count ?? 0);
          return Array.from({ length: count }, () => false);
        }
        case 'modbus_read_holding_registers':
        case 'modbus_read_input_registers': {
          const count = Number(args.count ?? 0);
          return Array.from({ length: count }, () => 0);
        }
        case 'modbus_write_coil':
        case 'modbus_write_coils':
        case 'modbus_write_discrete_input':
        case 'modbus_write_holding_register':
        case 'modbus_write_holding_registers':
        case 'modbus_write_input_register':
        case 'modbus_bulk_write':
        case 'modbus_save_memory_csv':
        case 'modbus_load_memory_csv':
          return null;

        case 'scenario_save':
        case 'scenario_export_csv':
        case 'scenario_delete':
        case 'scenario_pause':
        case 'scenario_resume':
        case 'scenario_stop':
        case 'scenario_seek':
          return null;
        case 'scenario_run':
          emitEvent('scenario:status', { status: 'running' });
          return null;

        case 'scope_create':
        case 'scope_delete':
        case 'scope_run_stop':
        case 'scope_reset':
        case 'scope_arm_trigger':
        case 'scope_update_settings':
        case 'scope_add_sample':
        case 'scope_add_samples':
        case 'scope_register_mapping':
        case 'scope_register_mappings':
        case 'scope_remove_mapping':
          return null;

        case 'window_close_floating':
        case 'window_update_bounds':
        case 'window_focus_floating':
        case 'window_minimize_floating':
        case 'window_maximize_floating':
          return null;

        case 'ladder_start_monitoring':
        case 'ladder_stop_monitoring':
        case 'ladder_force_device':
        case 'ladder_release_force':
          return null;

        case 'parser_save_program':
          return null;
        case 'schematic_save':
          return null;
        case 'save_app_settings':
          return null;

        case 'plugin:event|listen': {
          const eventName = String(args.event ?? '');
          const handlerId = args.handler;
          const callback = resolveCallback(handlerId);
          if (eventName && callback && typeof handlerId === 'number') {
            ensureBucket(eventName).set(handlerId, callback);
          }
          return handlerId ?? null;
        }
        case 'plugin:event|once': {
          const eventName = String(args.event ?? '');
          const handlerId = args.handler;
          const callback = resolveCallback(handlerId);
          if (eventName && callback && typeof handlerId === 'number') {
            const wrapped: Callback = (event) => {
              callback(event);
              listeners.get(eventName)?.delete(handlerId);
            };
            ensureBucket(eventName).set(handlerId, wrapped);
          }
          return handlerId ?? null;
        }
        case 'plugin:event|unlisten': {
          const eventName = String(args.event ?? '');
          const id = args.eventId;
          if (eventName && typeof id === 'number') {
            listeners.get(eventName)?.delete(id);
          }
          return null;
        }
        case 'plugin:event|emit': {
          const eventName = String(args.event ?? '');
          if (eventName) {
            emitEvent(eventName, args.payload ?? null);
          }
          return null;
        }

        case 'plugin:window|current_monitor':
          return defaultMonitor;
        case 'plugin:window|available_monitors':
          return [defaultMonitor];
        case 'plugin:window|maximize':
        case 'plugin:window|minimize':
        case 'plugin:window|close':
        case 'plugin:window|toggle_maximize':
        case 'plugin:window|set_title':
        case 'plugin:window|set_focus':
          return null;
        case 'plugin:window|is_maximized':
          return false;
        case 'plugin:window|is_minimized':
          return false;
        case 'plugin:window|is_focused':
          return true;

        case 'plugin:path|document_dir':
          return '/tmp';
        case 'plugin:path|join': {
          const paths = Array.isArray(args.paths) ? args.paths : [];
          return paths.map((part) => String(part)).join('/').replace(/\/{2,}/g, '/');
        }

        case 'plugin:dialog|open':
          return null;
        case 'plugin:dialog|save':
          return null;
        case 'plugin:dialog|ask':
          return false;

        case 'plugin:fs|read_dir':
          return [];
        case 'plugin:fs|exists':
          return false;
        case 'plugin:fs|read_text_file':
          return '';
        case 'plugin:fs|write_text_file':
          return null;

        case 'plugin:shell|open':
          return null;

        default:
          if (cmd.includes('log') || cmd.startsWith('logging_')) {
            return null;
          }
          return null;
      }
    };

    const mockEventApi = {
      listen: async (eventName: string, handler: Callback): Promise<() => Promise<void>> => {
        return addListener(eventName, handler);
      },
      emit: async (eventName: string, payload?: unknown): Promise<void> => {
        emitEvent(eventName, payload ?? null);
      },
      once: async (eventName: string, handler: Callback): Promise<() => Promise<void>> => {
        const unsubscribe = addListener(eventName, async (event) => {
          await unsubscribe();
          handler(event);
        });
        return unsubscribe;
      },
    };

    w.__TAURI_MOCKS__ = {
      event: mockEventApi,
      window: {
        Window: MockTauriWindow,
        getCurrentWindow: () => currentWindow,
        availableMonitors: async () => [defaultMonitor],
      },
      core: { invoke },
      path: {
        documentDir: async () => '/tmp',
        join: async (...parts: string[]) => parts.join('/').replace(/\/{2,}/g, '/'),
      },
      dialog: {
        open: async () => null,
        save: async () => null,
        ask: async () => false,
      },
      fs: {
        readDir: async () => [],
        exists: async () => false,
        readTextFile: async () => '',
        writeTextFile: async () => {},
      },
      shell: {
        open: async () => {},
      },
    };

    w.__TAURI_CB_ID__ = 0;
    w.__TAURI_INTERNALS__ = {
      invoke: async (cmd: string, args?: Record<string, unknown>) => invoke(cmd, args ?? {}),
      transformCallback: (callback: unknown, once?: boolean): number => {
        const id = Number(w.__TAURI_CB_ID__ ?? 0);
        w.__TAURI_CB_ID__ = id + 1;
        if (typeof callback === 'function') {
          w[`_${id}`] = (...payload: unknown[]) => {
            (callback as (...value: unknown[]) => unknown)(...payload);
            if (once) {
              delete w[`_${id}`];
            }
          };
        }
        return id;
      },
      convertFileSrc: (filePath: string): string => filePath,
      metadata: {
        currentWindow: { label: 'main' },
        currentWebview: { label: 'main', windowLabel: 'main' },
      },
      plugins: {},
    };
  });
}

export function createBrowserFixtures(): TauriFixtureFactory {
  const test = base.extend({
    page: async ({ page }, use) => {
      await injectTauriMocks(page);
      await use(page);
    },
  });

  return { test, expect };
}
