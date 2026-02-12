import type { SerializableCircuitState } from '../components/OneCanvas/types';

export const DOC_SYNC_EVENT = 'modone:document-sync';

type TauriEventApi = typeof import('@tauri-apps/api/event');
type UnlistenFn = () => void;

export interface DocumentSyncPayload {
  documentId: string;
  revision: number;
  /** Serializable canvas data snapshot */
  data: SerializableCircuitState;
  sourceWindowId: string;
  timestamp: number;
}

let tauriEventApiPromise: Promise<TauriEventApi | null> | null = null;

export function getSyncWindowId(): string {
  if (typeof window === 'undefined') return 'main';
  const params = new URLSearchParams(window.location.search);
  return params.get('windowId') || 'main';
}

async function getTauriEventApi(): Promise<TauriEventApi | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!tauriEventApiPromise) {
    tauriEventApiPromise = import('@tauri-apps/api/event').catch(() => null);
  }

  return tauriEventApiPromise;
}

export function shouldAcceptRemoteUpdate(
  localRevision: number,
  localTimestamp: number,
  remoteRevision: number,
  remoteTimestamp: number,
): boolean {
  if (remoteRevision > localRevision) return true;
  if (remoteRevision < localRevision) return false;
  return remoteTimestamp > localTimestamp;
}

export function mergeCanvasDocumentData(
  local: SerializableCircuitState,
  remote: SerializableCircuitState,
): SerializableCircuitState {
  return {
    components: { ...local.components, ...remote.components },
    junctions: { ...(local.junctions ?? {}), ...(remote.junctions ?? {}) },
    wires: remote.wires,
    metadata: remote.metadata,
    viewport: remote.viewport ?? local.viewport,
  };
}

export function mergeCanvasData(
  local: SerializableCircuitState,
  remote: SerializableCircuitState,
): SerializableCircuitState {
  return mergeCanvasDocumentData(local, remote);
}

export async function broadcastDocumentSync(payload: DocumentSyncPayload): Promise<void> {
  const eventApi = await getTauriEventApi();
  if (!eventApi) {
    return;
  }

  await eventApi.emit(DOC_SYNC_EVENT, payload);
}

export async function listenDocumentSync(
  listener: (payload: DocumentSyncPayload) => void,
): Promise<UnlistenFn> {
  const eventApi = await getTauriEventApi();
  if (!eventApi) {
    return () => {
      // noop outside Tauri runtime
    };
  }

  return eventApi.listen<DocumentSyncPayload>(DOC_SYNC_EVENT, (event) => {
    listener(event.payload);
  });
}
