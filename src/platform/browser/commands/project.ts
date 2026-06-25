/**
 * Project command handlers for the browser runtime.
 *
 * Mirrors the Rust project commands wrapped by `src/services/projectService.ts`.
 * Projects are persisted in the `kv` store keyed by their `.mop` path.
 */
import {
  DEFAULT_PROJECT_CONFIG,
  DEFAULT_AUTO_SAVE_SETTINGS,
  type ProjectConfig,
  type ProjectData,
  type ProjectInfo,
  type ProjectStatus,
  type RecentProject,
  type AutoSaveSettings,
  type ProjectConfigPatch,
} from '../../../types/project';
import type { CommandMap, CommandContext, CommandArgs } from '../types';

const KEY_RECENT = 'recentProjects';
const KEY_CURRENT_PATH = 'currentProjectPath';
const KEY_AUTOSAVE = 'autoSaveSettings';
const projectKey = (path: string) => `project:${path}`;

function nowIso(): string {
  return new Date().toISOString();
}

function joinPath(...parts: string[]): string {
  return parts.join('/').replace(/\/{2,}/g, '/');
}

/** Deep-merge a partial patch into a config object (objects recurse, scalars/arrays replace). */
function deepMerge<T>(base: T, patch: unknown): T {
  if (patch === null || patch === undefined) return base;
  if (Array.isArray(patch) || typeof patch !== 'object') return patch as T;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    const prev = out[key];
    out[key] =
      value && typeof value === 'object' && !Array.isArray(value) && prev && typeof prev === 'object'
        ? deepMerge(prev, value)
        : value;
  }
  return out as T;
}

function buildConfig(args: CommandArgs): ProjectConfig {
  const timestamp = nowIso();
  const base = structuredClone(DEFAULT_PROJECT_CONFIG);
  return {
    ...base,
    project: {
      ...base.project,
      name: String(args.name ?? 'Untitled'),
      created_at: timestamp,
      updated_at: timestamp,
    },
    plc: {
      ...base.plc,
      manufacturer: (args.plcManufacturer as ProjectConfig['plc']['manufacturer']) ?? base.plc.manufacturer,
      model: String(args.plcModel ?? base.plc.model),
      scan_time_ms: typeof args.scanTimeMs === 'number' ? args.scanTimeMs : base.plc.scan_time_ms,
    },
  };
}

async function getRecent(ctx: CommandContext): Promise<RecentProject[]> {
  return (await ctx.storage.get<RecentProject[]>('kv', KEY_RECENT)) ?? [];
}

async function upsertRecent(ctx: CommandContext, entry: RecentProject): Promise<void> {
  const recent = (await getRecent(ctx)).filter((p) => p.path !== entry.path);
  recent.unshift(entry);
  await ctx.storage.put('kv', KEY_RECENT, recent.slice(0, 20));
}

async function currentProject(ctx: CommandContext): Promise<ProjectData | undefined> {
  const path = await ctx.storage.get<string>('kv', KEY_CURRENT_PATH);
  if (!path) return undefined;
  return ctx.storage.get<ProjectData>('kv', projectKey(path));
}

export const projectCommands: CommandMap = {
  async create_project(args, ctx): Promise<ProjectInfo> {
    const name = String(args.name ?? 'Untitled');
    const projectDir = String(args.projectDir ?? joinPath('/modone', name));
    const path = joinPath(projectDir, `${name}.mop`);

    const data: ProjectData = { config: buildConfig(args), is_modified: false };
    await ctx.storage.put('kv', projectKey(path), data);
    await ctx.storage.put('kv', KEY_CURRENT_PATH, path);
    await upsertRecent(ctx, { name, path, last_opened: nowIso() });

    return { name, path, created_at: data.config.project.created_at };
  },

  async open_project(args, ctx): Promise<ProjectData> {
    const path = String(args.path ?? '');
    let data = await ctx.storage.get<ProjectData>('kv', projectKey(path));
    if (!data) {
      // Opening a path we never created (e.g. a stale recent entry): synthesize a blank project.
      const name = path.split('/').pop()?.replace(/\.mop$/i, '') ?? 'Untitled';
      data = { config: buildConfig({ name }), is_modified: false };
      await ctx.storage.put('kv', projectKey(path), data);
    }
    await ctx.storage.put('kv', KEY_CURRENT_PATH, path);
    await upsertRecent(ctx, {
      name: data.config.project.name,
      path,
      last_opened: nowIso(),
    });
    return data;
  },

  async save_project(args, ctx): Promise<null> {
    const path =
      (args.path as string | null | undefined) ??
      (await ctx.storage.get<string>('kv', KEY_CURRENT_PATH));
    if (path) {
      const data = await ctx.storage.get<ProjectData>('kv', projectKey(path));
      if (data) {
        data.is_modified = false;
        data.config.project.updated_at = nowIso();
        await ctx.storage.put('kv', projectKey(path), data);
      }
    }
    return null;
  },

  async update_project_config(args, ctx): Promise<ProjectData> {
    const path = await ctx.storage.get<string>('kv', KEY_CURRENT_PATH);
    const data = path ? await ctx.storage.get<ProjectData>('kv', projectKey(path)) : undefined;
    if (!path || !data) {
      // No open project — return a transient default rather than throwing.
      return { config: structuredClone(DEFAULT_PROJECT_CONFIG), is_modified: false };
    }
    data.config = deepMerge(data.config, args.patch as ProjectConfigPatch);
    data.config.project.updated_at = nowIso();
    data.is_modified = true;
    await ctx.storage.put('kv', projectKey(path), data);
    return data;
  },

  async mark_project_modified(_args, ctx): Promise<null> {
    const path = await ctx.storage.get<string>('kv', KEY_CURRENT_PATH);
    const data = path ? await ctx.storage.get<ProjectData>('kv', projectKey(path)) : undefined;
    if (path && data) {
      data.is_modified = true;
      await ctx.storage.put('kv', projectKey(path), data);
    }
    return null;
  },

  async close_project(_args, ctx): Promise<null> {
    await ctx.storage.del('kv', KEY_CURRENT_PATH);
    return null;
  },

  async close_project_force(_args, ctx): Promise<null> {
    await ctx.storage.del('kv', KEY_CURRENT_PATH);
    return null;
  },

  async get_project_status(_args, ctx): Promise<ProjectStatus> {
    const path = await ctx.storage.get<string>('kv', KEY_CURRENT_PATH);
    const data = await currentProject(ctx);
    if (!path || !data) return { is_open: false, is_modified: false };
    return {
      is_open: true,
      is_modified: data.is_modified,
      name: data.config.project.name,
      path,
    };
  },

  async get_recent_projects(_args, ctx): Promise<RecentProject[]> {
    return getRecent(ctx);
  },

  async remove_from_recent(args, ctx): Promise<null> {
    const path = String(args.path ?? '');
    const recent = (await getRecent(ctx)).filter((p) => p.path !== path);
    await ctx.storage.put('kv', KEY_RECENT, recent);
    return null;
  },

  async clear_recent_projects(_args, ctx): Promise<null> {
    await ctx.storage.put('kv', KEY_RECENT, []);
    return null;
  },

  // ---- CLI / startup ------------------------------------------------------
  get_cli_project_path(): null {
    return null;
  },

  // ---- Auto-save ----------------------------------------------------------
  async get_auto_save_settings(_args, ctx): Promise<AutoSaveSettings> {
    return (
      (await ctx.storage.get<AutoSaveSettings>('kv', KEY_AUTOSAVE)) ??
      DEFAULT_AUTO_SAVE_SETTINGS
    );
  },

  async set_auto_save_enabled(args, ctx): Promise<null> {
    const settings =
      (await ctx.storage.get<AutoSaveSettings>('kv', KEY_AUTOSAVE)) ?? { ...DEFAULT_AUTO_SAVE_SETTINGS };
    settings.enabled = Boolean(args.enabled);
    await ctx.storage.put('kv', KEY_AUTOSAVE, settings);
    return null;
  },

  async set_auto_save_interval(args, ctx): Promise<null> {
    const settings =
      (await ctx.storage.get<AutoSaveSettings>('kv', KEY_AUTOSAVE)) ?? { ...DEFAULT_AUTO_SAVE_SETTINGS };
    settings.interval_secs = Number(args.secs ?? settings.interval_secs);
    await ctx.storage.put('kv', KEY_AUTOSAVE, settings);
    return null;
  },

  async set_backup_count(args, ctx): Promise<null> {
    const settings =
      (await ctx.storage.get<AutoSaveSettings>('kv', KEY_AUTOSAVE)) ?? { ...DEFAULT_AUTO_SAVE_SETTINGS };
    settings.backup_count = Number(args.count ?? settings.backup_count);
    await ctx.storage.put('kv', KEY_AUTOSAVE, settings);
    return null;
  },

  start_auto_save(): null {
    return null;
  },

  stop_auto_save(): null {
    return null;
  },
};
