/**
 * Project Dialog Service
 *
 * A simple event-based service for triggering project dialogs from commands.
 * This allows non-React code (like commands) to trigger React dialogs.
 */

type DialogEventType = 'new-project' | 'open-project' | 'save-as';

type DialogEventListener = () => void;

class ProjectDialogService {
  private listeners: Map<DialogEventType, Set<DialogEventListener>> = new Map();

  /**
   * Subscribe to a dialog event
   */
  on(event: DialogEventType, listener: DialogEventListener): () => void {
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
  emit(event: DialogEventType): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((listener) => listener());
    }
  }

  /**
   * Request to open the New Project dialog
   */
  requestNewProject(): void {
    this.emit('new-project');
  }

  /**
   * Request to open the Open Project picker
   */
  requestOpenProject(): void {
    this.emit('open-project');
  }

  /**
   * Request to open the Save As dialog
   */
  requestSaveAs(): void {
    this.emit('save-as');
  }
}

/** Singleton instance */
export const projectDialogService = new ProjectDialogService();

export default projectDialogService;
