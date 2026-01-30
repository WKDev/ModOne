/**
 * ProjectDialogContext
 *
 * Provides project dialog state and connects to the projectDialogService
 * and fileDialogService for command-triggered dialog opens.
 */

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { NewProjectDialog } from '../components/project/NewProjectDialog';
import { NewFileDialog } from '../components/project/NewFileDialog';
import { ImportDialog } from '../components/project/ImportDialog';
import { useOpenProjectDialog } from '../hooks/useOpenProjectDialog';
import { projectDialogService } from '../services/projectDialogService';
import { fileDialogService, type NewFileRequest } from '../services/fileDialogService';
import { importService, type ImportRequest } from '../services/importService';
import type { ProjectInfo } from '../types/project';

interface ProjectDialogContextValue {
  /** Open the New Project dialog */
  openNewProjectDialog: () => void;
  /** Open the file picker for opening projects */
  openOpenProjectPicker: () => Promise<boolean>;
  /** Whether a project operation is in progress */
  isOperationInProgress: boolean;
}

const ProjectDialogContext = createContext<ProjectDialogContextValue | null>(null);

/**
 * Hook to access project dialog controls
 */
export function useProjectDialogs(): ProjectDialogContextValue {
  const context = useContext(ProjectDialogContext);
  if (!context) {
    throw new Error('useProjectDialogs must be used within ProjectDialogProvider');
  }
  return context;
}

interface ProjectDialogProviderProps {
  children: ReactNode;
  onProjectCreated?: (info: ProjectInfo) => void;
}

/**
 * Provider for project dialog functionality.
 * Listens to projectDialogService events to open dialogs.
 */
export function ProjectDialogProvider({
  children,
  onProjectCreated,
}: ProjectDialogProviderProps) {
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [newFileRequest, setNewFileRequest] = useState<NewFileRequest | null>(null);
  const [importRequest, setImportRequest] = useState<ImportRequest | null>(null);
  const { openPicker, isOpening } = useOpenProjectDialog();

  const openNewProjectDialog = useCallback(() => {
    setIsNewProjectOpen(true);
  }, []);

  const openOpenProjectPicker = useCallback(async () => {
    return await openPicker();
  }, [openPicker]);

  // Subscribe to projectDialogService events
  useEffect(() => {
    const unsubNewProject = projectDialogService.on('new-project', () => {
      setIsNewProjectOpen(true);
    });

    const unsubOpenProject = projectDialogService.on('open-project', () => {
      openPicker();
    });

    return () => {
      unsubNewProject();
      unsubOpenProject();
    };
  }, [openPicker]);

  // Subscribe to fileDialogService events
  useEffect(() => {
    const unsubNewFile = fileDialogService.on('new-file', (request: NewFileRequest) => {
      setNewFileRequest(request);
    });

    return () => {
      unsubNewFile();
    };
  }, []);

  // Subscribe to importService events
  useEffect(() => {
    const unsubImport = importService.on('import-plc', (request: ImportRequest) => {
      setImportRequest(request);
    });

    return () => {
      unsubImport();
    };
  }, []);

  const handleNewProjectClose = useCallback(() => {
    setIsNewProjectOpen(false);
  }, []);

  const handleProjectCreated = useCallback(
    (info: ProjectInfo) => {
      onProjectCreated?.(info);
    },
    [onProjectCreated]
  );

  const handleNewFileClose = useCallback(() => {
    setNewFileRequest(null);
  }, []);

  const handleFileCreated = useCallback((filePath: string) => {
    console.log('File created:', filePath);
    // Could add notification here or expand parent folder
  }, []);

  const handleImportClose = useCallback(() => {
    setImportRequest(null);
  }, []);

  const handleFileImported = useCallback((filePath: string) => {
    console.log('File imported:', filePath);
    // Could add notification here or open the file
  }, []);

  const contextValue: ProjectDialogContextValue = {
    openNewProjectDialog,
    openOpenProjectPicker,
    isOperationInProgress: isOpening,
  };

  return (
    <ProjectDialogContext.Provider value={contextValue}>
      {children}
      <NewProjectDialog
        isOpen={isNewProjectOpen}
        onClose={handleNewProjectClose}
        onCreated={handleProjectCreated}
      />
      <NewFileDialog
        isOpen={newFileRequest !== null}
        onClose={handleNewFileClose}
        fileType={newFileRequest?.fileType ?? 'canvas'}
        targetDir={newFileRequest?.targetDir}
        onCreated={handleFileCreated}
      />
      <ImportDialog
        isOpen={importRequest !== null}
        onClose={handleImportClose}
        vendor={importRequest?.vendor ?? 'xg5000'}
        targetDir={importRequest?.targetDir}
        onImported={handleFileImported}
      />
    </ProjectDialogContext.Provider>
  );
}

export default ProjectDialogContext;
