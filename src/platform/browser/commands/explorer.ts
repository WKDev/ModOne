/**
 * Explorer / file command handlers for the browser runtime.
 *
 * Mirrors `src/services/explorerService.ts`. In the browser there is no real
 * filesystem tree, so listings return empty and file reads/writes are no-ops
 * for now (real sheet/file persistence arrives in a later increment).
 */
import type { CommandMap } from '../types';

function joinPath(...parts: string[]): string {
  return parts.filter(Boolean).join('/').replace(/\/{2,}/g, '/');
}

export const explorerCommands: CommandMap = {
  list_project_files(): unknown[] {
    return [];
  },

  read_file_contents(): string {
    return '';
  },

  write_file_contents(): null {
    return null;
  },

  path_exists(): boolean {
    return false;
  },

  get_file_info(args): unknown {
    const path = String(args.path ?? '');
    const name = path.split('/').pop() ?? '';
    return { name, path, isDirectory: false, isFile: true, children: [] };
  },

  create_project_file(args): string {
    const fileType = String(args.fileType ?? 'canvas');
    const fileName = String(args.fileName ?? 'untitled');
    const targetDir = String(args.targetDir ?? `/modone/${fileType}`);
    const ext =
      fileType === 'canvas' ? '.canvas' : fileType === 'sheet' ? '.sheet.xml' : `.${fileType}`;
    return joinPath(targetDir, `${fileName}${ext}`);
  },
};
