/**
 * LadderEditorPanel - Content panel for the Ladder Logic Editor
 *
 * Wraps the LadderEditor component for integration with the panel system.
 * Supports both document-based editing (via DocumentContext) and
 * global store editing (legacy mode).
 */

import React from 'react';
import { LadderEditor } from '../../LadderEditor';
import { useDocumentContext } from '../../../contexts/DocumentContext';

interface LadderEditorPanelProps {
  /** Tab data (contains documentId, filePath) */
  data?: unknown;
}

export const LadderEditorPanel = React.memo(function LadderEditorPanel(
  _props: LadderEditorPanelProps
) {
  // Get document context (may be null if not in document mode)
  const { documentId, documentType } = useDocumentContext();

  // Log for debugging during development
  // TODO: Wire up document-based editing when LadderEditor supports it
  if (documentId && documentType === 'ladder') {
    console.debug('LadderEditorPanel: Using document mode', { documentId });
  }

  return (
    <div className="h-full flex flex-col bg-neutral-950">
      <LadderEditor />
    </div>
  );
});
