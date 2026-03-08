import React from 'react';

export interface SimulationToolbarProps {
  className?: string;
  running?: boolean;
  onStart?: () => void;
  onStop?: () => void;
  onReset?: () => void;
  onStep?: () => void;
  measuredRate?: number;
}

export const SimulationToolbar: React.FC<SimulationToolbarProps> = () => {
  // TODO: Implement in Phase 8
  return null;
};
