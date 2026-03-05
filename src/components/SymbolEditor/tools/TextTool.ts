import React from 'react';
import { BaseTool, type CanvasPoint, type ToolCallbacks } from './BaseTool';
import type { TextPrimitive } from '../../../types/symbol';

export class TextTool extends BaseTool {
  onMouseDown(pt: CanvasPoint, callbacks: ToolCallbacks): void {
    // Use a small timeout to ensure the click event doesn't interfere with the prompt
    // or just call it directly. React events are synthetic, so it should be fine.
    // However, window.prompt blocks the UI.
    
    const text = window.prompt('Enter text:', '');
    if (text) {
      const textPrim: TextPrimitive = {
        kind: 'text',
        x: pt.x,
        y: pt.y,
        text,
        fontSize: 12,
        fontFamily: 'monospace',
        fill: '#cccccc',
        anchor: 'start',
      };
      callbacks.onAddPrimitive(textPrim);
    }
  }

  onMouseMove(_pt: CanvasPoint, _callbacks: ToolCallbacks): React.ReactNode | null {
    // No preview for text tool currently
    return null;
  }

  onMouseUp(_pt: CanvasPoint, _callbacks: ToolCallbacks): void {
    // No-op
  }
}
