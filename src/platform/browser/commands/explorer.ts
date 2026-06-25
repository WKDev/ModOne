/**
 * Explorer / virtual filesystem command handlers for the browser runtime.
 *
 * Mirrors `src/services/explorerService.ts`. Since there is no real filesystem,
 * a virtual file index is kept in the `kv` store (key `vfs`) listing the files
 * the user has created. `list_project_files` builds a folder tree from it so
 * created documents appear in the Explorer and can be re-opened after reload.
 *
 * File *contents* live elsewhere: canvas circuits in the `circuits` store
 * (see canvas.ts), everything else (e.g. sheet XML) in `kv` under `file:<path>`.
 */
import type { CommandMap, CommandContext } from '../types';

interface VfsEntry {
  name: string;
  path: string; // absolute path (also the canvas/circuit key)
}

const KEY_VFS = 'vfs';
const KEY_CURRENT_PATH = 'currentProjectPath';
const fileKey = (path: string) => `file:${path}`;

const FILE_LAYOUT: Record<string, { dir: string; ext: string }> = {
  canvas: { dir: 'canvas', ext: '.yaml' },
  ladder: { dir: 'ladder', ext: '.lad' },
  scenario: { dir: 'scenario', ext: '.json' },
  sheet: { dir: 'sheets', ext: '.sheet.xml' },
};

function joinPath(...parts: string[]): string {
  return parts.filter(Boolean).join('/').replace(/\/{2,}/g, '/');
}

async function projectDir(ctx: CommandContext): Promise<string> {
  const mopPath = await ctx.storage.get<string>('kv', KEY_CURRENT_PATH);
  return mopPath ? mopPath.replace(/[\\/][^\\/]+\.mop$/i, '') : '/modone';
}

async function getVfs(ctx: CommandContext): Promise<VfsEntry[]> {
  return (await ctx.storage.get<VfsEntry[]>('kv', KEY_VFS)) ?? [];
}

async function addVfsEntry(ctx: CommandContext, entry: VfsEntry): Promise<void> {
  const vfs = await getVfs(ctx);
  if (!vfs.some((e) => e.path === entry.path)) {
    vfs.push(entry);
    await ctx.storage.put('kv', KEY_VFS, vfs);
  }
}

interface TreeNode {
  name: string;
  path: string;
  absolute_path: string;
  is_dir: boolean;
  children?: TreeNode[];
}

/** Build a FileNodeResult tree from the flat vfs list, rooted at projectRoot. */
function buildTree(root: string, entries: VfsEntry[]): TreeNode[] {
  const rootNode: TreeNode = { name: '', path: root, absolute_path: root, is_dir: true, children: [] };
  const dirIndex = new Map<string, TreeNode>([[root, rootNode]]);

  const ensureDir = (absPath: string): TreeNode => {
    const existing = dirIndex.get(absPath);
    if (existing) return existing;
    const parentPath = absPath.slice(0, absPath.lastIndexOf('/')) || root;
    const parent = parentPath === absPath ? rootNode : ensureDir(parentPath);
    const node: TreeNode = {
      name: absPath.split('/').pop() ?? absPath,
      path: absPath,
      absolute_path: absPath,
      is_dir: true,
      children: [],
    };
    parent.children!.push(node);
    dirIndex.set(absPath, node);
    return node;
  };

  for (const entry of entries) {
    if (!entry.path.startsWith(root)) continue;
    const dirPath = entry.path.slice(0, entry.path.lastIndexOf('/')) || root;
    const parent = dirPath === root ? rootNode : ensureDir(dirPath);
    parent.children!.push({
      name: entry.name,
      path: entry.path,
      absolute_path: entry.path,
      is_dir: false,
    });
  }

  return rootNode.children ?? [];
}

export const explorerCommands: CommandMap = {
  async list_project_files(args, ctx): Promise<TreeNode[]> {
    const root = String(args.projectRoot ?? (await projectDir(ctx)));
    return buildTree(root, await getVfs(ctx));
  },

  async create_project_file(args, ctx): Promise<string> {
    const fileType = String(args.fileType ?? 'canvas');
    const fileName = String(args.fileName ?? 'untitled');
    const layout = FILE_LAYOUT[fileType] ?? { dir: fileType, ext: `.${fileType}` };
    const baseDir = args.targetDir
      ? String(args.targetDir)
      : joinPath(await projectDir(ctx), layout.dir);
    const name = `${fileName}${layout.ext}`;
    const path = joinPath(baseDir, name);
    await addVfsEntry(ctx, { name, path });
    return path;
  },

  async read_file_contents(args, ctx): Promise<string> {
    return (await ctx.storage.get<string>('kv', fileKey(String(args.path ?? '')))) ?? '';
  },

  async write_file_contents(args, ctx): Promise<null> {
    const path = String(args.path ?? '');
    if (path) {
      await ctx.storage.put('kv', fileKey(path), String(args.content ?? ''));
      await addVfsEntry(ctx, { name: path.split('/').pop() ?? path, path });
    }
    return null;
  },

  async path_exists(args, ctx): Promise<boolean> {
    const path = String(args.path ?? '');
    if (!path) return false;
    if ((await getVfs(ctx)).some((e) => e.path === path)) return true;
    if ((await ctx.storage.get('circuits', path)) !== undefined) return true;
    return (await ctx.storage.get('kv', fileKey(path))) !== undefined;
  },

  async get_file_info(args, ctx): Promise<TreeNode> {
    const path = String(args.path ?? '');
    const name = path.split('/').pop() ?? '';
    const isDir = !/\.[^/]+$/.test(name);
    void ctx;
    return { name, path, absolute_path: path, is_dir: isDir, children: isDir ? [] : undefined };
  },
};
