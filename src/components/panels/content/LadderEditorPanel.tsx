/**
 * LadderEditorPanel - Content panel for the Ladder Logic Editor
 *
 * Wraps the LadderEditor component for integration with the panel system.
 */

import React from 'react';
import { LadderEditor } from '../../LadderEditor';

export const LadderEditorPanel = React.memo(function LadderEditorPanel() {
  return (
    <div className="h-full flex flex-col bg-neutral-950">
      <LadderEditor />
    </div>
  );
});
