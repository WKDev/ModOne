/**
 * Project Service Unit Tests
 *
 * Tests for projectService methods to verify that invoke() is called
 * with correct command names and arguments.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Tauri invoke function
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { projectService } from '../projectService';

const mockInvoke = vi.mocked(invoke);
const mockToastError = vi.mocked(toast.error);

describe('projectService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createProject', () => {
    it('calls invoke with create_project and all arguments', async () => {
      mockInvoke.mockResolvedValueOnce({ id: '1', name: 'Test' });

      await projectService.createProject('Test', '/path', 'LS', 'XGK', 10);

      expect(mockInvoke).toHaveBeenCalledWith('create_project', {
        name: 'Test',
        projectDir: '/path',
        plcManufacturer: 'LS',
        plcModel: 'XGK',
        scanTimeMs: 10,
      });
    });

    it('defaults scanTimeMs to null when omitted', async () => {
      mockInvoke.mockResolvedValueOnce({ id: '1', name: 'Test' });

      await projectService.createProject('Test', '/path', 'LS', 'XGK');

      expect(mockInvoke).toHaveBeenCalledWith('create_project', {
        name: 'Test',
        projectDir: '/path',
        plcManufacturer: 'LS',
        plcModel: 'XGK',
        scanTimeMs: null,
      });
    });

    it('calls toast.error and re-throws on invoke failure', async () => {
      const error = new Error('Create failed');
      mockInvoke.mockRejectedValueOnce(error);

      await expect(projectService.createProject('Test', '/path', 'LS', 'XGK')).rejects.toThrow(
        'Create failed'
      );
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  describe('openProject', () => {
    it('calls invoke with open_project and path', async () => {
      mockInvoke.mockResolvedValueOnce({ id: '1', name: 'Test' });

      await projectService.openProject('/path/project.mop');

      expect(mockInvoke).toHaveBeenCalledWith('open_project', { path: '/path/project.mop' });
    });

    it('calls toast.error and re-throws on failure', async () => {
      const error = new Error('Open failed');
      mockInvoke.mockRejectedValueOnce(error);

      await expect(projectService.openProject('/path/project.mop')).rejects.toThrow('Open failed');
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  describe('saveProject', () => {
    it('calls invoke with save_project and null path when omitted', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await projectService.saveProject();

      expect(mockInvoke).toHaveBeenCalledWith('save_project', { path: null });
    });

    it('calls invoke with save_project and provided path', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await projectService.saveProject('/new/path.mop');

      expect(mockInvoke).toHaveBeenCalledWith('save_project', { path: '/new/path.mop' });
    });

    it('calls toast.error and re-throws on failure', async () => {
      const error = new Error('Save failed');
      mockInvoke.mockRejectedValueOnce(error);

      await expect(projectService.saveProject()).rejects.toThrow('Save failed');
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  describe('closeProject', () => {
    it('calls invoke with close_project', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await projectService.closeProject();

      expect(mockInvoke).toHaveBeenCalledWith('close_project');
    });

    it('calls toast.error and re-throws on failure', async () => {
      const error = new Error('Close failed');
      mockInvoke.mockRejectedValueOnce(error);

      await expect(projectService.closeProject()).rejects.toThrow('Close failed');
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  describe('closeProjectForce', () => {
    it('calls invoke with close_project_force', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await projectService.closeProjectForce();

      expect(mockInvoke).toHaveBeenCalledWith('close_project_force');
    });

    it('calls toast.error and re-throws on failure', async () => {
      const error = new Error('Force close failed');
      mockInvoke.mockRejectedValueOnce(error);

      await expect(projectService.closeProjectForce()).rejects.toThrow('Force close failed');
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  describe('getRecentProjects', () => {
    it('calls invoke with get_recent_projects', async () => {
      mockInvoke.mockResolvedValueOnce([]);

      await projectService.getRecentProjects();

      expect(mockInvoke).toHaveBeenCalledWith('get_recent_projects');
    });

    it('calls toast.error and re-throws on failure', async () => {
      const error = new Error('Get recent failed');
      mockInvoke.mockRejectedValueOnce(error);

      await expect(projectService.getRecentProjects()).rejects.toThrow('Get recent failed');
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  describe('getProjectStatus', () => {
    it('calls invoke with get_project_status', async () => {
      mockInvoke.mockResolvedValueOnce({ isOpen: true });

      await projectService.getProjectStatus();

      expect(mockInvoke).toHaveBeenCalledWith('get_project_status');
    });

    it('calls toast.error and re-throws on failure', async () => {
      const error = new Error('Get status failed');
      mockInvoke.mockRejectedValueOnce(error);

      await expect(projectService.getProjectStatus()).rejects.toThrow('Get status failed');
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  describe('markProjectModified', () => {
    it('calls invoke with mark_project_modified', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await projectService.markProjectModified();

      expect(mockInvoke).toHaveBeenCalledWith('mark_project_modified');
    });

    it('calls toast.error and re-throws on failure', async () => {
      const error = new Error('Mark modified failed');
      mockInvoke.mockRejectedValueOnce(error);

      await expect(projectService.markProjectModified()).rejects.toThrow('Mark modified failed');
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  describe('setAutoSaveEnabled', () => {
    it('calls invoke with set_auto_save_enabled and enabled arg', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await projectService.setAutoSaveEnabled(true);

      expect(mockInvoke).toHaveBeenCalledWith('set_auto_save_enabled', { enabled: true });
    });

    it('calls invoke with enabled false', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await projectService.setAutoSaveEnabled(false);

      expect(mockInvoke).toHaveBeenCalledWith('set_auto_save_enabled', { enabled: false });
    });

    it('calls toast.error and re-throws on failure', async () => {
      const error = new Error('Set auto-save failed');
      mockInvoke.mockRejectedValueOnce(error);

      await expect(projectService.setAutoSaveEnabled(true)).rejects.toThrow(
        'Set auto-save failed'
      );
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  describe('setAutoSaveInterval', () => {
    it('calls invoke with set_auto_save_interval and secs arg', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await projectService.setAutoSaveInterval(60);

      expect(mockInvoke).toHaveBeenCalledWith('set_auto_save_interval', { secs: 60 });
    });

    it('calls toast.error and re-throws on failure', async () => {
      const error = new Error('Set interval failed');
      mockInvoke.mockRejectedValueOnce(error);

      await expect(projectService.setAutoSaveInterval(60)).rejects.toThrow('Set interval failed');
      expect(mockToastError).toHaveBeenCalled();
    });
  });
});
