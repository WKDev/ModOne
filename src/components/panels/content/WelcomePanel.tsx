import { useCallback } from 'react';
import { WelcomePage } from '@components/WelcomePage';
import { useEditorAreaStore } from '@stores/editorAreaStore';

export function WelcomePanel({ data }: { data?: unknown }) {
  const handleProjectOpened = useCallback(() => {
    const { tabs, removeTab } = useEditorAreaStore.getState();
    const welcomeTab = tabs.find(t => t.panelType === 'welcome');
    if (welcomeTab) {
      removeTab(welcomeTab.id);
    }
  }, []);

  return <WelcomePage onProjectOpened={handleProjectOpened} data={data} />;
}
