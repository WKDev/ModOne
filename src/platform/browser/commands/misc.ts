/**
 * Miscellaneous command handlers: app settings, window layout persistence,
 * licensing and logging. All state is persisted in the `kv` store so it
 * survives a browser reload.
 */
import { defaultSettings, type AppSettings } from '../../../types/settings';
import type { CommandMap, CommandContext } from '../types';

const KEY_SETTINGS = 'appSettings';
const KEY_LAST_LAYOUT = 'lastActiveLayout';
const KEY_RESTORE_SESSION = 'restoreLastSession';
const layoutKey = (name: string) => `layout:${name}`;

function makeDefaultLayout(name: string) {
  return {
    name,
    grid: { columns: ['1fr'], rows: ['1fr'] },
    panels: [],
    sidebar: { visible: true, width: 280, activePanel: 'explorer' },
    floatingWindows: [],
    updatedAt: new Date().toISOString(),
  };
}

export const miscCommands: CommandMap = {
  // ---- App settings -------------------------------------------------------
  async get_app_settings(_args, ctx: CommandContext): Promise<AppSettings> {
    return (await ctx.storage.get<AppSettings>('kv', KEY_SETTINGS)) ?? defaultSettings;
  },

  async save_app_settings(args, ctx): Promise<null> {
    if (args.settings) {
      await ctx.storage.put('kv', KEY_SETTINGS, args.settings);
    }
    return null;
  },

  // ---- Layout persistence -------------------------------------------------
  async save_layout(args, ctx): Promise<null> {
    const layout = args.layout as { name?: string } | undefined;
    const name = String(layout?.name ?? args.name ?? 'Default');
    await ctx.storage.put('kv', layoutKey(name), args.layout ?? makeDefaultLayout(name));
    return null;
  },

  async load_layout(args, ctx): Promise<unknown> {
    const name = String(args.name ?? 'Default');
    return (await ctx.storage.get('kv', layoutKey(name))) ?? makeDefaultLayout(name);
  },

  async list_layouts(_args, ctx): Promise<string[]> {
    const keys = await ctx.storage.keys('kv');
    return keys.filter((k) => k.startsWith('layout:')).map((k) => k.slice('layout:'.length));
  },

  async delete_layout(args, ctx): Promise<null> {
    await ctx.storage.del('kv', layoutKey(String(args.name ?? '')));
    return null;
  },

  async set_last_active_layout(args, ctx): Promise<null> {
    await ctx.storage.put('kv', KEY_LAST_LAYOUT, args.layoutName ?? args.layout_name ?? null);
    return null;
  },

  async get_last_active_layout(_args, ctx): Promise<string | null> {
    return (await ctx.storage.get<string>('kv', KEY_LAST_LAYOUT)) ?? null;
  },

  async set_restore_last_session(args, ctx): Promise<null> {
    await ctx.storage.put('kv', KEY_RESTORE_SESSION, Boolean(args.enabled));
    return null;
  },

  async get_restore_last_session(_args, ctx): Promise<boolean> {
    const value = await ctx.storage.get<boolean>('kv', KEY_RESTORE_SESSION);
    return value ?? true;
  },

  // ---- Licensing (web build is always unlocked) ---------------------------
  get_license_info(): unknown {
    return {
      status: 'Valid',
      tier: 'web',
      activated_at: null,
      expires_at: null,
      machine_id: 'browser',
    };
  },
  activate_license(): unknown {
    return { status: 'Valid', tier: 'web' };
  },
  deactivate_license(): null {
    return null;
  },
  checkout_license(): unknown {
    return { status: 'Valid', tier: 'web' };
  },

  // ---- Logging ------------------------------------------------------------
  get_log_path(): string {
    return 'browser://logs';
  },
  get_recent_errors(): unknown[] {
    return [];
  },
  clear_error_logs(): null {
    return null;
  },
  open_logs_directory(): null {
    return null;
  },
};
