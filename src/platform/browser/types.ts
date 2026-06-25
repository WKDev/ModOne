/**
 * Shared types for the browser runtime command handlers.
 */
import type { BrowserStorage } from './storage';

/** Context passed to every command handler. */
export interface CommandContext {
  storage: BrowserStorage;
  /** Emit a Tauri-style event to any registered `listen()` callbacks. */
  emit: (event: string, payload: unknown) => void;
}

export type CommandArgs = Record<string, unknown>;

export type CommandHandler = (
  args: CommandArgs,
  ctx: CommandContext
) => unknown | Promise<unknown>;

export type CommandMap = Record<string, CommandHandler>;
