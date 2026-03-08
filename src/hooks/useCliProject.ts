import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { useProjectStore } from '@stores/projectStore';
import { projectService } from '@services/projectService';
import { explorerService } from '@services/explorerService';
import { useExplorerStore } from '@stores/explorerStore';

function extractProjectDir(projectPath: string): string {
  return projectPath.replace(/[\\/][^\\/]+\.mop$/i, '');
}

export function useCliProject(isInitialized: boolean) {
  const hasChecked = useRef(false);
  const setProject = useProjectStore((s) => s.setProject);
  const setLoading = useProjectStore((s) => s.setLoading);
  const setError = useProjectStore((s) => s.setError);
  const setRecentProjects = useProjectStore((s) => s.setRecentProjects);
  const loadProjectStructure = useExplorerStore((s) => s.loadProjectStructure);

  useEffect(() => {
    if (!isInitialized || hasChecked.current) return;
    hasChecked.current = true;

    invoke<string | null>('get_cli_project_path').then(async (path) => {
      if (!path) return;

      setLoading(true, 'open');
      try {
        const data = await projectService.openProject(path);
        setProject(data, path);

        const projectDir = extractProjectDir(path);
        const files = await explorerService.listProjectFiles(projectDir);
        loadProjectStructure(projectDir, files);

        const recentProjects = await projectService.getRecentProjects();
        setRecentProjects(recentProjects);

        await projectService.startAutoSave();

        toast.success(`Opened project from CLI: ${path.split(/[\\/]/).pop()}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(`Failed to open CLI project: ${msg}`);
        toast.error(`Failed to open project: ${msg}`);
      } finally {
        setLoading(false);
      }
    });
  }, [isInitialized, setProject, setLoading, setError, setRecentProjects, loadProjectStructure]);
}
