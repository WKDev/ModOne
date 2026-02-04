import { createContext, useContext } from 'react';
import type { CoordinateSystem } from './useCoordinateSystem';

const CoordinateSystemContext = createContext<CoordinateSystem | null>(null);

export function CoordinateSystemProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: CoordinateSystem;
}) {
  return (
    <CoordinateSystemContext.Provider value={value}>
      {children}
    </CoordinateSystemContext.Provider>
  );
}

export function useCoordinateSystemContext(): CoordinateSystem {
  const context = useContext(CoordinateSystemContext);
  if (!context) {
    throw new Error('useCoordinateSystemContext must be used within CoordinateSystemProvider');
  }
  return context;
}
