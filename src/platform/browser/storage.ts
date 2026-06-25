/**
 * Browser persistence backend for the Tauri-less web runtime.
 *
 * The browser runtime shim (see `installBrowserRuntime.ts`) routes every
 * `invoke()` call into JS command handlers. Those handlers persist data through
 * this storage abstraction instead of the Rust filesystem.
 *
 * Two implementations are provided:
 *  - `IndexedDbStorage` — real persistence in the browser (`modone-db`).
 *  - `MemoryStorage`     — in-memory map, used by unit tests (jsdom has no IndexedDB).
 *
 * Keeping the backend behind an interface lets us inject `MemoryStorage` in
 * vitest while shipping `IndexedDbStorage` to the browser.
 */

export const STORE_NAMES = ['kv', 'symbols', 'circuits', 'sheets'] as const;
export type StoreName = (typeof STORE_NAMES)[number];

export interface BrowserStorage {
  get<T>(store: StoreName, key: string): Promise<T | undefined>;
  put(store: StoreName, key: string, value: unknown): Promise<void>;
  del(store: StoreName, key: string): Promise<void>;
  keys(store: StoreName): Promise<string[]>;
  values<T>(store: StoreName): Promise<T[]>;
}

// ---------------------------------------------------------------------------
// IndexedDB implementation
// ---------------------------------------------------------------------------

const DB_NAME = 'modone-db';
const DB_VERSION = 1;

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class IndexedDbStorage implements BrowserStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const name of STORE_NAMES) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name);
          }
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.dbPromise;
  }

  private async tx(store: StoreName, mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.openDb();
    return db.transaction(store, mode).objectStore(store);
  }

  async get<T>(store: StoreName, key: string): Promise<T | undefined> {
    const os = await this.tx(store, 'readonly');
    return (await promisify(os.get(key))) as T | undefined;
  }

  async put(store: StoreName, key: string, value: unknown): Promise<void> {
    const os = await this.tx(store, 'readwrite');
    await promisify(os.put(value, key));
  }

  async del(store: StoreName, key: string): Promise<void> {
    const os = await this.tx(store, 'readwrite');
    await promisify(os.delete(key));
  }

  async keys(store: StoreName): Promise<string[]> {
    const os = await this.tx(store, 'readonly');
    return (await promisify(os.getAllKeys())) as string[];
  }

  async values<T>(store: StoreName): Promise<T[]> {
    const os = await this.tx(store, 'readonly');
    return (await promisify(os.getAll())) as T[];
  }
}

// ---------------------------------------------------------------------------
// In-memory implementation (tests)
// ---------------------------------------------------------------------------

export class MemoryStorage implements BrowserStorage {
  private stores = new Map<StoreName, Map<string, unknown>>();

  private bucket(store: StoreName): Map<string, unknown> {
    let bucket = this.stores.get(store);
    if (!bucket) {
      bucket = new Map();
      this.stores.set(store, bucket);
    }
    return bucket;
  }

  async get<T>(store: StoreName, key: string): Promise<T | undefined> {
    return this.bucket(store).get(key) as T | undefined;
  }

  async put(store: StoreName, key: string, value: unknown): Promise<void> {
    // Clone so callers can't mutate stored references (mirrors IndexedDB semantics).
    this.bucket(store).set(key, structuredClone(value));
  }

  async del(store: StoreName, key: string): Promise<void> {
    this.bucket(store).delete(key);
  }

  async keys(store: StoreName): Promise<string[]> {
    return [...this.bucket(store).keys()];
  }

  async values<T>(store: StoreName): Promise<T[]> {
    return [...this.bucket(store).values()].map((v) => structuredClone(v)) as T[];
  }
}
