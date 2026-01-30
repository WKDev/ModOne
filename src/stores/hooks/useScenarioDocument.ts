/**
 * useScenarioDocument Hook
 *
 * Provides scenario-specific operations for a document in the registry.
 * This hook bridges the documentRegistry with scenario editor UI components.
 */

import { useCallback, useMemo } from 'react';
import { useDocumentRegistry } from '../documentRegistry';
import { isScenarioDocument } from '../../types/document';
import type {
  Scenario,
  ScenarioEvent,
  ScenarioMetadata,
  ScenarioSettings,
  ScenarioExecutionState,
} from '../../types/scenario';
import {
  createEmptyScenario,
  createScenarioEvent,
  sortEventsByTime,
} from '../../types/scenario';

// ============================================================================
// Types
// ============================================================================

/** Return type for useScenarioDocument hook */
export interface UseScenarioDocumentReturn {
  // Data
  scenario: Scenario | null;
  events: ScenarioEvent[];
  metadata: ScenarioMetadata | null;
  settings: ScenarioSettings | null;
  executionState: ScenarioExecutionState;
  isDirty: boolean;

  // Scenario operations
  newScenario: () => void;
  loadScenario: (scenario: Scenario) => void;
  updateMetadata: (metadata: Partial<ScenarioMetadata>) => void;
  updateSettings: (settings: Partial<ScenarioSettings>) => void;

  // Event operations
  addEvent: (event: Omit<ScenarioEvent, 'id'>) => string;
  updateEvent: (id: string, updates: Partial<ScenarioEvent>) => void;
  removeEvent: (id: string) => void;
  duplicateEvent: (id: string) => string | null;
  toggleEventEnabled: (id: string) => void;

  // Execution control
  setExecutionState: (state: Partial<ScenarioExecutionState>) => void;
  resetExecution: () => void;

  // History operations
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Utility
  markSaved: () => void;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for accessing and manipulating scenario document state.
 *
 * @param documentId - The document ID to operate on
 * @returns Scenario document state and operations, or null if document not found
 */
export function useScenarioDocument(documentId: string | null): UseScenarioDocumentReturn | null {
  const document = useDocumentRegistry((state) =>
    documentId ? state.documents.get(documentId) : undefined
  );
  const updateScenarioData = useDocumentRegistry((state) => state.updateScenarioData);
  const updateScenarioExecution = useDocumentRegistry((state) => state.updateScenarioExecution);
  const pushHistory = useDocumentRegistry((state) => state.pushHistory);
  const undoAction = useDocumentRegistry((state) => state.undo);
  const redoAction = useDocumentRegistry((state) => state.redo);
  const canUndoCheck = useDocumentRegistry((state) => state.canUndo);
  const canRedoCheck = useDocumentRegistry((state) => state.canRedo);
  const markClean = useDocumentRegistry((state) => state.markClean);

  // Early return if no document or wrong type
  const scenarioDoc = document && isScenarioDocument(document) ? document : null;
  const data = scenarioDoc?.data;
  const executionState = scenarioDoc?.executionState;

  // Scenario operations
  const newScenario = useCallback(() => {
    if (!documentId) return;

    pushHistory(documentId);
    updateScenarioData(documentId, createEmptyScenario());
    updateScenarioExecution(documentId, {
      status: 'idle',
      currentTime: 0,
      currentEventIndex: 0,
      completedEvents: [],
      currentLoopIteration: 1,
    });
  }, [documentId, pushHistory, updateScenarioData, updateScenarioExecution]);

  const loadScenario = useCallback(
    (scenario: Scenario) => {
      if (!documentId) return;

      const sortedScenario = {
        ...scenario,
        events: sortEventsByTime(scenario.events),
      };

      updateScenarioData(documentId, sortedScenario);
      updateScenarioExecution(documentId, {
        status: 'idle',
        currentTime: 0,
        currentEventIndex: 0,
        completedEvents: [],
        currentLoopIteration: 1,
      });
    },
    [documentId, updateScenarioData, updateScenarioExecution]
  );

  const updateMetadata = useCallback(
    (metadata: Partial<ScenarioMetadata>) => {
      if (!documentId || !data?.scenario) return;

      pushHistory(documentId);
      updateScenarioData(documentId, {
        ...data.scenario,
        metadata: {
          ...data.scenario.metadata,
          ...metadata,
          updatedAt: new Date().toISOString(),
        },
      });
    },
    [documentId, data, pushHistory, updateScenarioData]
  );

  const updateSettings = useCallback(
    (settings: Partial<ScenarioSettings>) => {
      if (!documentId || !data?.scenario) return;

      pushHistory(documentId);
      updateScenarioData(documentId, {
        ...data.scenario,
        settings: {
          ...data.scenario.settings,
          ...settings,
        },
      });
    },
    [documentId, data, pushHistory, updateScenarioData]
  );

  // Event operations
  const addEvent = useCallback(
    (eventData: Omit<ScenarioEvent, 'id'>): string => {
      if (!documentId || !data?.scenario) return '';

      const newEvent = createScenarioEvent(eventData);

      pushHistory(documentId);
      updateScenarioData(documentId, {
        ...data.scenario,
        events: sortEventsByTime([...data.scenario.events, newEvent]),
        metadata: {
          ...data.scenario.metadata,
          updatedAt: new Date().toISOString(),
        },
      });

      return newEvent.id;
    },
    [documentId, data, pushHistory, updateScenarioData]
  );

  const updateEvent = useCallback(
    (id: string, updates: Partial<ScenarioEvent>) => {
      if (!documentId || !data?.scenario) return;

      pushHistory(documentId);
      const events = data.scenario.events.map((e) =>
        e.id === id ? { ...e, ...updates } : e
      );

      updateScenarioData(documentId, {
        ...data.scenario,
        events: 'time' in updates ? sortEventsByTime(events) : events,
        metadata: {
          ...data.scenario.metadata,
          updatedAt: new Date().toISOString(),
        },
      });
    },
    [documentId, data, pushHistory, updateScenarioData]
  );

  const removeEvent = useCallback(
    (id: string) => {
      if (!documentId || !data?.scenario) return;

      pushHistory(documentId);
      updateScenarioData(documentId, {
        ...data.scenario,
        events: data.scenario.events.filter((e) => e.id !== id),
        metadata: {
          ...data.scenario.metadata,
          updatedAt: new Date().toISOString(),
        },
      });
    },
    [documentId, data, pushHistory, updateScenarioData]
  );

  const duplicateEvent = useCallback(
    (id: string): string | null => {
      if (!documentId || !data?.scenario) return null;

      const event = data.scenario.events.find((e) => e.id === id);
      if (!event) return null;

      const newEvent = createScenarioEvent({
        ...event,
        time: event.time + 0.1,
        note: event.note ? `${event.note} (copy)` : '(copy)',
      });

      pushHistory(documentId);
      updateScenarioData(documentId, {
        ...data.scenario,
        events: sortEventsByTime([...data.scenario.events, newEvent]),
        metadata: {
          ...data.scenario.metadata,
          updatedAt: new Date().toISOString(),
        },
      });

      return newEvent.id;
    },
    [documentId, data, pushHistory, updateScenarioData]
  );

  const toggleEventEnabled = useCallback(
    (id: string) => {
      if (!documentId || !data?.scenario) return;

      pushHistory(documentId);
      updateScenarioData(documentId, {
        ...data.scenario,
        events: data.scenario.events.map((e) =>
          e.id === id ? { ...e, enabled: !e.enabled } : e
        ),
        metadata: {
          ...data.scenario.metadata,
          updatedAt: new Date().toISOString(),
        },
      });
    },
    [documentId, data, pushHistory, updateScenarioData]
  );

  // Execution control
  const setExecutionState = useCallback(
    (state: Partial<ScenarioExecutionState>) => {
      if (documentId) {
        updateScenarioExecution(documentId, state);
      }
    },
    [documentId, updateScenarioExecution]
  );

  const resetExecution = useCallback(() => {
    if (documentId) {
      updateScenarioExecution(documentId, {
        status: 'idle',
        currentTime: 0,
        currentEventIndex: 0,
        completedEvents: [],
        currentLoopIteration: 1,
      });
    }
  }, [documentId, updateScenarioExecution]);

  // History operations
  const undo = useCallback(() => {
    if (documentId) undoAction(documentId);
  }, [documentId, undoAction]);

  const redo = useCallback(() => {
    if (documentId) redoAction(documentId);
  }, [documentId, redoAction]);

  const canUndo = documentId ? canUndoCheck(documentId) : false;
  const canRedo = documentId ? canRedoCheck(documentId) : false;

  // Utility
  const markSavedCallback = useCallback(() => {
    if (documentId) markClean(documentId);
  }, [documentId, markClean]);

  // Return memoized result
  return useMemo(() => {
    if (!scenarioDoc || !executionState) return null;

    return {
      // Data
      scenario: data?.scenario ?? null,
      events: data?.scenario?.events ?? [],
      metadata: data?.scenario?.metadata ?? null,
      settings: data?.scenario?.settings ?? null,
      executionState,
      isDirty: scenarioDoc.isDirty,

      // Scenario operations
      newScenario,
      loadScenario,
      updateMetadata,
      updateSettings,

      // Event operations
      addEvent,
      updateEvent,
      removeEvent,
      duplicateEvent,
      toggleEventEnabled,

      // Execution control
      setExecutionState,
      resetExecution,

      // History operations
      undo,
      redo,
      canUndo,
      canRedo,

      // Utility
      markSaved: markSavedCallback,
    };
  }, [
    scenarioDoc,
    data,
    executionState,
    newScenario,
    loadScenario,
    updateMetadata,
    updateSettings,
    addEvent,
    updateEvent,
    removeEvent,
    duplicateEvent,
    toggleEventEnabled,
    setExecutionState,
    resetExecution,
    undo,
    redo,
    canUndo,
    canRedo,
    markSavedCallback,
  ]);
}

export default useScenarioDocument;
