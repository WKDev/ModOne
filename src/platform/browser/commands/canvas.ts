/**
 * Canvas / circuit command handlers for the browser runtime.
 *
 * Mirrors `src/services/canvasService.ts`. Circuits are stored in the
 * `circuits` store keyed by their file path; the value is the YAML string the
 * frontend serializes. Loading an unknown path returns a fresh default circuit
 * so newly-created canvas files open as an empty editor instead of throwing.
 */
import { createDefaultCircuitYaml } from '../../../components/OneCanvas/utils/serialization';
import type { CommandMap, CommandContext } from '../types';

function nameFromPath(path: string): string {
  return path.split('/').pop()?.replace(/\.(canvas|ya?ml)$/i, '') ?? 'circuit';
}

async function circuitKeys(ctx: CommandContext): Promise<string[]> {
  return ctx.storage.keys('circuits');
}

export const canvasCommands: CommandMap = {
  async canvas_save_circuit(args, ctx): Promise<null> {
    const path = String(args.path ?? '');
    const content = String(args.content ?? '');
    if (path) await ctx.storage.put('circuits', path, content);
    return null;
  },

  async canvas_load_circuit(args, ctx): Promise<string> {
    const path = String(args.path ?? '');
    const stored = await ctx.storage.get<string>('circuits', path);
    return stored ?? createDefaultCircuitYaml(nameFromPath(path));
  },

  async canvas_create_circuit(args, ctx): Promise<null> {
    const path = String(args.path ?? '');
    const name = String(args.name ?? nameFromPath(path));
    if (path && !(await ctx.storage.get('circuits', path))) {
      await ctx.storage.put('circuits', path, createDefaultCircuitYaml(name));
    }
    return null;
  },

  async canvas_delete_circuit(args, ctx): Promise<null> {
    await ctx.storage.del('circuits', String(args.path ?? ''));
    return null;
  },

  async canvas_list_circuits(args, ctx): Promise<string[]> {
    const dir = String(args.dir ?? '');
    const keys = await circuitKeys(ctx);
    return dir ? keys.filter((k) => k.startsWith(dir)) : keys;
  },

  async canvas_circuit_exists(args, ctx): Promise<boolean> {
    const path = String(args.path ?? '');
    return (await ctx.storage.get('circuits', path)) !== undefined;
  },
};
