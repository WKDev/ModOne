/**
 * Import Service
 *
 * An event-based service for triggering PLC program import dialogs from commands and menus.
 * This allows non-React code (like commands and menus) to trigger React dialogs.
 */

export type PlcVendor = 'xg5000';

export interface ImportRequest {
  vendor: PlcVendor;
  targetDir?: string;
}

type ImportEventType = 'import-plc';

type ImportEventListener = (request: ImportRequest) => void;

class ImportService {
  private listeners: Map<ImportEventType, Set<ImportEventListener>> = new Map();

  /**
   * Subscribe to an import event
   */
  on(event: ImportEventType, listener: ImportEventListener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  /**
   * Emit an import event
   */
  private emit(event: ImportEventType, request: ImportRequest): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((listener) => listener(request));
    }
  }

  /**
   * Request to open the Import dialog for a specific vendor
   */
  requestImport(vendor: PlcVendor, targetDir?: string): void {
    this.emit('import-plc', { vendor, targetDir });
  }

  /**
   * Request to import from XG5000 CSV
   */
  requestImportXG5000(targetDir?: string): void {
    this.requestImport('xg5000', targetDir);
  }
}

/** Singleton instance */
export const importService = new ImportService();

export default importService;
