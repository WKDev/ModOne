import { beforeEach, describe, expect, it } from 'vitest';
import { useDocumentRegistry } from '../documentRegistry';
import { isCanvasDocument } from '../../types/document';
import type { SerializableCircuitState } from '../../components/OneCanvas/types';
import type { Block } from '../../components/OneCanvas/types';
import type { DocumentSyncPayload } from '../../utils/documentSync';

/**
 * Integration tests for multiwindow document sync flow
 * Tests the real documentRegistry store with applyRemoteCanvasUpdate action
 */

// ============================================================================
// Test Helpers
// ============================================================================

function createTestBlock(id: string, x: number, y: number): Block {
  return {
    id,
    type: 'led',
    position: { x, y },
    size: { width: 10, height: 10 },
    ports: [],
    color: 'red',
    forwardVoltage: 2,
  };
}

function createTestCircuit(components: Record<string, Block> = {}): SerializableCircuitState {
  return {
    components,
    wires: [],
    metadata: {
      name: 'Test Circuit',
      description: '',
      tags: [],
    },
    viewport: {
      zoom: 1,
      panX: 0,
      panY: 0,
    },
  };
}

function createSyncPayload(
  documentId: string,
  revision: number,
  data: SerializableCircuitState,
  timestamp: number = Date.now()
): DocumentSyncPayload {
  return {
    documentId,
    revision,
    data,
    sourceWindowId: 'remote-window',
    timestamp,
  };
}

// ============================================================================
// Tests
// ============================================================================

beforeEach(() => {
  useDocumentRegistry.getState().reset();
});

describe('Document Sync Integration', () => {
  it('Test 1: Remote update with higher revision is accepted', () => {
    // Create a canvas document
    const docId = useDocumentRegistry.getState().createDocument('canvas', 'test');

    // Load initial data (2 components, 1 wire)
    const initialCircuit = createTestCircuit({
      comp1: createTestBlock('comp1', 10, 10),
      comp2: createTestBlock('comp2', 50, 50),
    });
    useDocumentRegistry.getState().loadCanvasCircuit(docId, initialCircuit);

    // Verify initial state
    let doc = useDocumentRegistry.getState().getDocument(docId);
    expect(doc).toBeDefined();
    expect(doc?.revision).toBe(0);
    expect(isCanvasDocument(doc!)).toBe(true);
    expect((doc as any)?.data.components.size).toBe(2);

    // Apply remote update with revision=1 (higher than local revision=0)
    const remoteCircuit = createTestCircuit({
      comp1: createTestBlock('comp1', 20, 20), // Modified position
      comp2: createTestBlock('comp2', 50, 50),
      comp3: createTestBlock('comp3', 100, 100), // New component
    });
    const payload = createSyncPayload(docId, 1, remoteCircuit);
    useDocumentRegistry.getState().applyRemoteCanvasUpdate(payload);

    // Assert: components updated, revision incremented
    doc = useDocumentRegistry.getState().getDocument(docId);
    expect(doc?.revision).toBe(1);
    expect((doc as any)?.data.components.size).toBe(3);
    const comp1 = (doc as any)?.data.components.get('comp1');
    expect(comp1?.position).toEqual({ x: 20, y: 20 });
  });

  it('Test 2: Remote update with lower revision is rejected', () => {
    // Create and load document with some data
    const docId = useDocumentRegistry.getState().createDocument('canvas', 'test');
    const initialCircuit = createTestCircuit({
      comp1: createTestBlock('comp1', 10, 10),
    });
    useDocumentRegistry.getState().loadCanvasCircuit(docId, initialCircuit);

    // Call updateCanvasData to get local revision to 2
    useDocumentRegistry.getState().updateCanvasData(docId, (data) => {
      data.components.set('comp2', createTestBlock('comp2', 50, 50));
    });
    useDocumentRegistry.getState().updateCanvasData(docId, (data) => {
      data.components.set('comp3', createTestBlock('comp3', 100, 100));
    });

    let doc = useDocumentRegistry.getState().getDocument(docId);
    expect(doc?.revision).toBe(2);
    const originalComponents = Array.from((doc as any)?.data.components.keys() ?? []);

    // Call applyRemoteCanvasUpdate with revision=1 (lower than local revision=2)
    const remoteCircuit = createTestCircuit({
      comp_old: createTestBlock('comp_old', 0, 0),
    });
    const payload = createSyncPayload(docId, 1, remoteCircuit);
    useDocumentRegistry.getState().applyRemoteCanvasUpdate(payload);

    // Assert: document unchanged
    doc = useDocumentRegistry.getState().getDocument(docId);
    expect(doc?.revision).toBe(2);
    expect(Array.from((doc as any)?.data.components.keys() ?? [])).toEqual(originalComponents);
  });

  it('Test 3: Remote update merges new components without losing local-only ones', () => {
    // Create doc with components A and B
    const docId = useDocumentRegistry.getState().createDocument('canvas', 'test');
    const initialCircuit = createTestCircuit({
      compA: createTestBlock('compA', 10, 10),
      compB: createTestBlock('compB', 50, 50),
    });
    useDocumentRegistry.getState().loadCanvasCircuit(docId, initialCircuit);

    // Apply remote update that has components B (modified) and C (new)
    const remoteCircuit = createTestCircuit({
      compB: createTestBlock('compB', 60, 60), // Modified position
      compC: createTestBlock('compC', 100, 100), // New component
    });
    const payload = createSyncPayload(docId, 1, remoteCircuit);
    useDocumentRegistry.getState().applyRemoteCanvasUpdate(payload);

    // Assert: A preserved (local-only), B updated (remote wins), C added
    const doc = useDocumentRegistry.getState().getDocument(docId);
    expect((doc as any)?.data.components.size).toBe(3);

    const compA = (doc as any)?.data.components.get('compA');
    expect(compA?.position).toEqual({ x: 10, y: 10 }); // Preserved

    const compB = (doc as any)?.data.components.get('compB');
    expect(compB?.position).toEqual({ x: 60, y: 60 }); // Updated from remote

    const compC = (doc as any)?.data.components.get('compC');
    expect(compC?.position).toEqual({ x: 100, y: 100 }); // Added
  });

  it('Test 4: Remote update does NOT mark document as dirty', () => {
    // Create document, markClean
    const docId = useDocumentRegistry.getState().createDocument('canvas', 'test');
    const initialCircuit = createTestCircuit({
      comp1: createTestBlock('comp1', 10, 10),
    });
    useDocumentRegistry.getState().loadCanvasCircuit(docId, initialCircuit);
    useDocumentRegistry.getState().markClean(docId);

    let doc = useDocumentRegistry.getState().getDocument(docId);
    expect(doc?.isDirty).toBe(false);

    // Apply remote update
    const remoteCircuit = createTestCircuit({
      comp1: createTestBlock('comp1', 20, 20),
      comp2: createTestBlock('comp2', 50, 50),
    });
    const payload = createSyncPayload(docId, 1, remoteCircuit);
    useDocumentRegistry.getState().applyRemoteCanvasUpdate(payload);

    // Assert: isDirty is still false
    doc = useDocumentRegistry.getState().getDocument(docId);
    expect(doc?.isDirty).toBe(false);
  });

  it('Test 5: updateCanvasData increments revision', () => {
    // Create document
    const docId = useDocumentRegistry.getState().createDocument('canvas', 'test');
    const initialCircuit = createTestCircuit();
    useDocumentRegistry.getState().loadCanvasCircuit(docId, initialCircuit);

    let doc = useDocumentRegistry.getState().getDocument(docId);
    expect(doc?.revision).toBe(0);

    // Call updateCanvasData to add a component
    useDocumentRegistry.getState().updateCanvasData(docId, (data) => {
      data.components.set('comp1', createTestBlock('comp1', 10, 10));
    });

    // Assert: revision is now 1
    doc = useDocumentRegistry.getState().getDocument(docId);
    expect(doc?.revision).toBe(1);

    // Call updateCanvasData again
    useDocumentRegistry.getState().updateCanvasData(docId, (data) => {
      data.components.set('comp2', createTestBlock('comp2', 50, 50));
    });

    // Assert: revision is now 2
    doc = useDocumentRegistry.getState().getDocument(docId);
    expect(doc?.revision).toBe(2);
  });
});
