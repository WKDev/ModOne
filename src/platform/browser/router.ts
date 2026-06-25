/**
 * Command router: merges all handler maps and produces the `invoke`
 * implementation installed onto `window.__TAURI_INTERNALS__`.
 */
import type { BrowserStorage } from './storage';
import type { CommandContext, CommandMap } from './types';
import { projectCommands } from './commands/project';
import { explorerCommands } from './commands/explorer';
import { miscCommands } from './commands/misc';
import { pluginCommands } from './commands/plugins';
import { symbolCommands } from './commands/symbol';
import { canvasCommands } from './commands/canvas';
import { stubCommands } from './commands/stubs';

/** Commands handled directly inside installBrowserRuntime (need the event registry). */
export type ExtraCommands = CommandMap;

export function buildCommandMap(extra: ExtraCommands = {}): CommandMap {
  return {
    // stubs first so the real handlers below override any overlap
    ...stubCommands,
    ...symbolCommands,
    ...canvasCommands,
    ...projectCommands,
    ...explorerCommands,
    ...miscCommands,
    ...pluginCommands,
    ...extra,
  };
}

export type BrowserInvoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

export function createInvoke(
  storage: BrowserStorage,
  emit: (event: string, payload: unknown) => void,
  extra: ExtraCommands = {}
): BrowserInvoke {
  const commands = buildCommandMap(extra);
  const ctx: CommandContext = { storage, emit };

  return async (cmd: string, args: Record<string, unknown> = {}): Promise<unknown> => {
    const handler = commands[cmd];
    if (handler) {
      return handler(args, ctx);
    }
    // Logging commands are fire-and-forget; stay quiet for them.
    if (!/^(log_|logging_)/.test(cmd) && !cmd.includes('log')) {
      console.debug(`[browser-runtime] unhandled command: ${cmd}`, args);
    }
    return null;
  };
}
