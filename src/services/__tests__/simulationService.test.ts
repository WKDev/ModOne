import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock('../../stores/layoutStore', () => ({
  useLayoutStore: {
    getState: vi.fn(() => ({
      setSimulationStatus: vi.fn(),
      simulationStatus: 'stopped',
    } as any)),
  },
}));

import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { useLayoutStore } from '../../stores/layoutStore';
import { simulationService } from '../simulationService';

const mockInvoke = vi.mocked(invoke);
const mockToastError = vi.mocked(toast.error);
const mockGetState = vi.mocked(useLayoutStore.getState);

describe('simulationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetState.mockReturnValue({
      setSimulationStatus: vi.fn(),
      simulationStatus: 'stopped',
    } as any);
  });

  describe('start', () => {
    it('calls invoke with sim_run and updates status to running', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const mockSetStatus = vi.fn();
      mockGetState.mockReturnValue({
        setSimulationStatus: mockSetStatus,
        simulationStatus: 'stopped',
      } as any);

      await simulationService.start();

      expect(mockInvoke).toHaveBeenCalledWith('sim_run');
      expect(mockSetStatus).toHaveBeenCalledWith('running');
    });

    it('calls toast.error and re-throws on failure without calling setSimulationStatus', async () => {
      const error = new Error('Start failed');
      mockInvoke.mockRejectedValueOnce(error);
      const mockSetStatus = vi.fn();
      mockGetState.mockReturnValue({
        setSimulationStatus: mockSetStatus,
        simulationStatus: 'stopped',
      } as any);

      await expect(simulationService.start()).rejects.toThrow('Start failed');
      expect(mockToastError).toHaveBeenCalled();
      expect(mockSetStatus).not.toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('calls invoke with sim_stop and updates status to stopped', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const mockSetStatus = vi.fn();
      mockGetState.mockReturnValue({
        setSimulationStatus: mockSetStatus,
        simulationStatus: 'running',
      } as any);

      await simulationService.stop();

      expect(mockInvoke).toHaveBeenCalledWith('sim_stop');
      expect(mockSetStatus).toHaveBeenCalledWith('stopped');
    });

    it('calls toast.error and re-throws on failure', async () => {
      const error = new Error('Stop failed');
      mockInvoke.mockRejectedValueOnce(error);

      await expect(simulationService.stop()).rejects.toThrow('Stop failed');
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  describe('pause', () => {
    it('calls invoke with sim_pause and updates status to paused', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const mockSetStatus = vi.fn();
      mockGetState.mockReturnValue({
        setSimulationStatus: mockSetStatus,
        simulationStatus: 'running',
      } as any);

      await simulationService.pause();

      expect(mockInvoke).toHaveBeenCalledWith('sim_pause');
      expect(mockSetStatus).toHaveBeenCalledWith('paused');
    });

    it('calls toast.error and re-throws on failure', async () => {
      const error = new Error('Pause failed');
      mockInvoke.mockRejectedValueOnce(error);

      await expect(simulationService.pause()).rejects.toThrow('Pause failed');
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  describe('resume', () => {
    it('calls invoke with sim_resume and updates status to running', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const mockSetStatus = vi.fn();
      mockGetState.mockReturnValue({
        setSimulationStatus: mockSetStatus,
        simulationStatus: 'paused',
      } as any);

      await simulationService.resume();

      expect(mockInvoke).toHaveBeenCalledWith('sim_resume');
      expect(mockSetStatus).toHaveBeenCalledWith('running');
    });

    it('calls toast.error and re-throws on failure', async () => {
      const error = new Error('Resume failed');
      mockInvoke.mockRejectedValueOnce(error);

      await expect(simulationService.resume()).rejects.toThrow('Resume failed');
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  describe('step', () => {
    it('calls invoke with sim_step', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await simulationService.step();

      expect(mockInvoke).toHaveBeenCalledWith('sim_step');
    });

    it('calls toast.error and re-throws on failure', async () => {
      const error = new Error('Step failed');
      mockInvoke.mockRejectedValueOnce(error);

      await expect(simulationService.step()).rejects.toThrow('Step failed');
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('calls invoke with sim_reset and updates status to stopped', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const mockSetStatus = vi.fn();
      mockGetState.mockReturnValue({
        setSimulationStatus: mockSetStatus,
        simulationStatus: 'running',
      } as any);

      await simulationService.reset();

      expect(mockInvoke).toHaveBeenCalledWith('sim_reset');
      expect(mockSetStatus).toHaveBeenCalledWith('stopped');
    });

    it('calls toast.error and re-throws on failure', async () => {
      const error = new Error('Reset failed');
      mockInvoke.mockRejectedValueOnce(error);

      await expect(simulationService.reset()).rejects.toThrow('Reset failed');
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  describe('loadProgram', () => {
    it('calls invoke with sim_load_program and program arg', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const program = { type: 'ladder', data: [] };

      await simulationService.loadProgram(program);

      expect(mockInvoke).toHaveBeenCalledWith('sim_load_program', { program });
    });

    it('calls toast.error and re-throws on failure', async () => {
      const error = new Error('Load program failed');
      mockInvoke.mockRejectedValueOnce(error);

      await expect(simulationService.loadProgram({})).rejects.toThrow('Load program failed');
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('returns status from layoutStore', () => {
      mockGetState.mockReturnValue({
        setSimulationStatus: vi.fn(),
        simulationStatus: 'running',
      } as any);

      const status = simulationService.getStatus();

      expect(status).toBe('running');
    });
  });

  describe('isRunning', () => {
    it('returns true when status is running', () => {
      mockGetState.mockReturnValue({
        setSimulationStatus: vi.fn(),
        simulationStatus: 'running',
      } as any);

      expect(simulationService.isRunning()).toBe(true);
    });

    it('returns false when status is not running', () => {
      mockGetState.mockReturnValue({
        setSimulationStatus: vi.fn(),
        simulationStatus: 'stopped',
      } as any);

      expect(simulationService.isRunning()).toBe(false);
    });
  });

  describe('isPaused', () => {
    it('returns true when status is paused', () => {
      mockGetState.mockReturnValue({
        setSimulationStatus: vi.fn(),
        simulationStatus: 'paused',
      } as any);

      expect(simulationService.isPaused()).toBe(true);
    });

    it('returns false when status is not paused', () => {
      mockGetState.mockReturnValue({
        setSimulationStatus: vi.fn(),
        simulationStatus: 'running',
      } as any);

      expect(simulationService.isPaused()).toBe(false);
    });
  });

  describe('isStopped', () => {
    it('returns true when status is stopped', () => {
      mockGetState.mockReturnValue({
        setSimulationStatus: vi.fn(),
        simulationStatus: 'stopped',
      } as any);

      expect(simulationService.isStopped()).toBe(true);
    });

    it('returns false when status is not stopped', () => {
      mockGetState.mockReturnValue({
        setSimulationStatus: vi.fn(),
        simulationStatus: 'running',
      } as any);

      expect(simulationService.isStopped()).toBe(false);
    });
  });
});
