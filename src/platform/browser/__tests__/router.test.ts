import { describe, it, expect } from 'vitest';
import { createInvoke } from '../router';
import { MemoryStorage } from '../storage';
import type { SymbolDefinition } from '../../../types/symbol';

function makeInvoke() {
  const storage = new MemoryStorage();
  const invoke = createInvoke(storage, () => {});
  return { invoke, storage };
}

function makeSymbol(id: string): SymbolDefinition {
  return {
    id,
    name: `Symbol ${id}`,
    version: '1.0.0',
    category: 'test',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    width: 80,
    height: 60,
    graphics: [],
    pins: [],
    properties: [],
  };
}

describe('browser runtime router', () => {
  it('persists and reloads a project (create → recent → open)', async () => {
    const { invoke } = makeInvoke();

    const info = (await invoke('create_project', {
      name: 'Demo',
      projectDir: '/modone/Demo',
      plcManufacturer: 'LS',
      plcModel: 'XGK',
    })) as { name: string; path: string };

    expect(info.name).toBe('Demo');
    expect(info.path).toBe('/modone/Demo/Demo.mop');

    const recent = (await invoke('get_recent_projects')) as Array<{ path: string }>;
    expect(recent.map((r) => r.path)).toContain(info.path);

    const data = (await invoke('open_project', { path: info.path })) as {
      config: { project: { name: string } };
    };
    expect(data.config.project.name).toBe('Demo');

    const status = (await invoke('get_project_status')) as { is_open: boolean; name?: string };
    expect(status.is_open).toBe(true);
    expect(status.name).toBe('Demo');
  });

  it('round-trips symbols (save → list → load → delete)', async () => {
    const { invoke } = makeInvoke();
    const symbol = makeSymbol('abc');

    await invoke('symbol_save', { projectDir: '/p', symbol, scope: 'project' });

    const list = (await invoke('symbol_list', { projectDir: '/p', scope: 'project' })) as Array<{
      id: string;
      scope: string;
    }>;
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('abc');
    expect(list[0].scope).toBe('project');

    // Scope isolation: a global listing should not see the project symbol.
    const globalList = (await invoke('symbol_list', { projectDir: '/p', scope: 'global' })) as unknown[];
    expect(globalList).toHaveLength(0);

    const loaded = (await invoke('symbol_load', {
      projectDir: '/p',
      id: 'abc',
      scope: 'project',
    })) as SymbolDefinition;
    expect(loaded.id).toBe('abc');
    expect(loaded.width).toBe(80);

    await invoke('symbol_delete', { projectDir: '/p', id: 'abc', scope: 'project' });
    const afterDelete = (await invoke('symbol_list', { projectDir: '/p', scope: 'project' })) as unknown[];
    expect(afterDelete).toHaveLength(0);
  });

  it('round-trips circuits and returns a default for unknown paths', async () => {
    const { invoke } = makeInvoke();
    const path = '/modone/Demo/canvas/main.canvas';

    // Unknown path → a valid default circuit YAML (not empty), so new files open.
    const fresh = (await invoke('canvas_load_circuit', { path })) as string;
    expect(typeof fresh).toBe('string');
    expect(fresh.length).toBeGreaterThan(0);
    expect(await invoke('canvas_circuit_exists', { path })).toBe(false);

    await invoke('canvas_save_circuit', { path, content: 'circuit-yaml-payload' });
    expect(await invoke('canvas_circuit_exists', { path })).toBe(true);
    expect(await invoke('canvas_load_circuit', { path })).toBe('circuit-yaml-payload');

    const list = (await invoke('canvas_list_circuits', { dir: '/modone/Demo/canvas' })) as string[];
    expect(list).toContain(path);
  });

  it('returns null for unknown commands instead of throwing', async () => {
    const { invoke } = makeInvoke();
    await expect(invoke('totally_unknown_command', {})).resolves.toBeNull();
  });
});
