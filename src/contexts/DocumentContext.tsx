/**
 * DocumentContext - Tab-level Document Context
 *
 * Provides document context to panel content components.
 * Each tab that contains a document will be wrapped with this provider,
 * giving child components access to the document ID and type.
 */

import { createContext, useContext, ReactNode, memo } from 'react';
import type { DocumentType } from '../types/document';

// ============================================================================
// Context Types
// ============================================================================

/**
 * Document context value provided to children
 */
export interface DocumentContextValue {
  /** Document ID in the registry (null if no document is associated) */
  documentId: string | null;
  /** Type of document (for type narrowing) */
  documentType: DocumentType | null;
  /** Tab ID that owns this document */
  tabId: string | null;
}

/**
 * Default context value (no document)
 */
const defaultContextValue: DocumentContextValue = {
  documentId: null,
  documentType: null,
  tabId: null,
};

// ============================================================================
// Context
// ============================================================================

const DocumentContext = createContext<DocumentContextValue>(defaultContextValue);

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access the current document context.
 *
 * Returns document ID and type if in a document context,
 * or null values if used outside a DocumentProvider.
 *
 * @example
 * ```tsx
 * const { documentId, documentType } = useDocumentContext();
 *
 * if (documentId && documentType === 'canvas') {
 *   // Use document-specific store/hooks
 *   const store = useCanvasDocument(documentId);
 * } else {
 *   // Fall back to global store
 *   const store = useCanvasStore();
 * }
 * ```
 */
export function useDocumentContext(): DocumentContextValue {
  return useContext(DocumentContext);
}

/**
 * Hook to get document ID only.
 * Useful when you just need the ID.
 */
export function useDocumentId(): string | null {
  const { documentId } = useContext(DocumentContext);
  return documentId;
}

/**
 * Hook to get document type only.
 * Useful for conditional rendering.
 */
export function useDocumentType(): DocumentType | null {
  const { documentType } = useContext(DocumentContext);
  return documentType;
}

/**
 * Hook that returns true if we're inside a document context.
 */
export function useHasDocumentContext(): boolean {
  const { documentId } = useContext(DocumentContext);
  return documentId !== null;
}

// ============================================================================
// Provider
// ============================================================================

interface DocumentProviderProps {
  /** Document ID to provide */
  documentId: string;
  /** Document type */
  documentType: DocumentType;
  /** Tab ID that owns this document */
  tabId: string;
  /** Children to wrap */
  children: ReactNode;
}

/**
 * Provider component that establishes document context for a tab.
 *
 * This should wrap the content component for tabs that have an associated document.
 * The document ID allows child components to access the correct document state
 * from the document registry.
 *
 * @example
 * ```tsx
 * // In TabContent.tsx
 * if (tab.data?.documentId && tab.data?.documentType) {
 *   return (
 *     <DocumentProvider
 *       documentId={tab.data.documentId}
 *       documentType={tab.data.documentType}
 *       tabId={tab.id}
 *     >
 *       <ContentComponent data={tab.data} />
 *     </DocumentProvider>
 *   );
 * }
 * ```
 */
export const DocumentProvider = memo(function DocumentProvider({
  documentId,
  documentType,
  tabId,
  children,
}: DocumentProviderProps) {
  const value: DocumentContextValue = {
    documentId,
    documentType,
    tabId,
  };

  return (
    <DocumentContext.Provider value={value}>
      {children}
    </DocumentContext.Provider>
  );
});

// ============================================================================
// Exports
// ============================================================================

export default DocumentContext;
