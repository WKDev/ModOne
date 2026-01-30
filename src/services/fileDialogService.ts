/**
 * File Dialog Service
 *
 * An event-based service for triggering file creation dialogs from commands and menus.
 * This allows non-React code (like commands and menus) to trigger React dialogs.
 */

export type FileType = 'canvas' | 'ladder' | 'scenario';

export interface NewFileRequest {
  fileType: FileType;
  targetDir?: string;
}

type FileDialogEventType = 'new-file';

type FileDialogEventListener = (request: NewFileRequest) => void;

class FileDialogService {
  private listeners: Map<FileDialogEventType, Set<FileDialogEventListener>> = new Map();

  /**
   * Subscribe to a dialog event
   */
  on(event: FileDialogEventType, listener: FileDialogEventListener): () => void {
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
   * Emit a dialog event
   */
  private emit(event: FileDialogEventType, request: NewFileRequest): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((listener) => listener(request));
    }
  }

  /**
   * Request to open the New File dialog
   */
  requestNewFile(fileType: FileType, targetDir?: string): void {
    this.emit('new-file', { fileType, targetDir });
  }

  /**
   * Request to create a new canvas file
   */
  requestNewCanvas(targetDir?: string): void {
    this.requestNewFile('canvas', targetDir);
  }

  /**
   * Request to create a new ladder file
   */
  requestNewLadder(targetDir?: string): void {
    this.requestNewFile('ladder', targetDir);
  }

  /**
   * Request to create a new scenario file
   */
  requestNewScenario(targetDir?: string): void {
    this.requestNewFile('scenario', targetDir);
  }
}

/** Singleton instance */
export const fileDialogService = new FileDialogService();

export default fileDialogService;
