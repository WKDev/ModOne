import { useEffect } from 'react';
import { MainLayout } from './components/layout/MainLayout';
import { PanelContainer } from './components/panels';
import { usePanelStore } from './stores/panelStore';

function App() {
  const { panels, addPanel } = usePanelStore();

  // Add default panels on first load
  useEffect(() => {
    if (panels.length === 0) {
      addPanel('console', '1 / 1 / 2 / 2');
      addPanel('properties', '1 / 2 / 2 / 3');
    }
  }, []);

  return (
    <MainLayout>
      <PanelContainer />
    </MainLayout>
  );
}

export default App;
