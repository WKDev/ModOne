import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { useProject } from './useProject';

export function useAppIntegration() {
  const { openProject } = useProject();

  useEffect(() => {
    // Handle single instance args (Windows/Linux double clicks)
    const unlistenSingleInstance = listen<{ args: string[], cwd: string }>('single-instance', async (event) => {
      const { args } = event.payload;
      console.log('Single instance received args:', args);

      // Look for a .mop file or modone:// url in the arguments
      for (const arg of args) {
        if (arg.endsWith('.mop') || arg.startsWith('modone://')) {
          await handleAppResource(arg);
          break;
        }
      }
    });

    // Handle file drop events (Drag & Drop)
    const unlistenFileDrop = listen<{ paths: string[] }>('tauri://drop', async (event) => {
      const paths = event.payload.paths;
      console.log('Files dropped onto window:', paths);
      for (const path of paths) {
        if (path.endsWith('.mop')) {
          await handleAppResource(path);
          break; // only open the first valid project
        }
      }
    });

    // Handle deep links (macOS/iOS/Android or registered URLs)
    const unlistenDeepLink = onOpenUrl(async (urls) => {
      console.log('Deep link received urls:', urls);
      for (const url of urls) {
        await handleAppResource(url);
      }
    });

    async function handleAppResource(resource: string) {
      if (resource.startsWith('modone://')) {
        // Deep link logic
        // E.g. modone://open?project=path/to/project
        console.log('Handling deep link:', resource);
        try {
          const urlObj = new URL(resource);
          const projectPath = urlObj.searchParams.get('project');
          if (projectPath) {
            await openProject(projectPath);
          }
        } catch (e) {
          console.error('Failed to parse modone deep link:', e);
        }
      } else if (resource.endsWith('.mop')) {
        // File association logic
        console.log('Opening associated file:', resource);
        await openProject(resource);
      }
    }

    return () => {
      unlistenSingleInstance.then((fn) => fn());
      unlistenDeepLink.then((fn) => fn());
      unlistenFileDrop.then((fn) => fn());
    };
  }, [openProject]);
}
