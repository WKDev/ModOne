/**
 * Modbus Service Unit Tests
 *
 * Tests for modbusService methods to verify that invoke() is called
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
import { modbusService } from '../modbusService';

const mockInvoke = vi.mocked(invoke);
const mockToastError = vi.mocked(toast.error);

describe('modbusService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('startTcp', () => {
    it('calls invoke with modbus_start_tcp and optional config', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const config = { host: '127.0.0.1', port: 502 };

      await modbusService.startTcp(config);

      expect(mockInvoke).toHaveBeenCalledWith('modbus_start_tcp', { config });
    });

    it('calls invoke with modbus_start_tcp without config', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await modbusService.startTcp();

      expect(mockInvoke).toHaveBeenCalledWith('modbus_start_tcp', { config: undefined });
    });

    it('calls toast.error and re-throws on failure', async () => {
      const error = new Error('Start TCP failed');
      mockInvoke.mockRejectedValueOnce(error);

      await expect(modbusService.startTcp()).rejects.toThrow('Start TCP failed');
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  describe('stopTcp', () => {
    it('calls invoke with modbus_stop_tcp', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await modbusService.stopTcp();

      expect(mockInvoke).toHaveBeenCalledWith('modbus_stop_tcp');
    });

    it('calls toast.error and re-throws on failure', async () => {
      const error = new Error('Stop TCP failed');
      mockInvoke.mockRejectedValueOnce(error);

      await expect(modbusService.stopTcp()).rejects.toThrow('Stop TCP failed');
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('calls invoke with modbus_get_status', async () => {
      mockInvoke.mockResolvedValueOnce({ tcpRunning: true });

      await modbusService.getStatus();

      expect(mockInvoke).toHaveBeenCalledWith('modbus_get_status');
    });

    it('calls toast.error and re-throws on failure', async () => {
      const error = new Error('Get status failed');
      mockInvoke.mockRejectedValueOnce(error);

      await expect(modbusService.getStatus()).rejects.toThrow('Get status failed');
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  describe('readCoils', () => {
    it('calls invoke with modbus_read_coils and start/count args', async () => {
      mockInvoke.mockResolvedValueOnce([true, false, true]);

      await modbusService.readCoils(0, 3);

      expect(mockInvoke).toHaveBeenCalledWith('modbus_read_coils', { start: 0, count: 3 });
    });

    it('calls toast.error and re-throws on failure', async () => {
      const error = new Error('Read coils failed');
      mockInvoke.mockRejectedValueOnce(error);

      await expect(modbusService.readCoils(0, 3)).rejects.toThrow('Read coils failed');
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  describe('writeCoil', () => {
    it('calls invoke with modbus_write_coil and address/value args', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await modbusService.writeCoil(5, true);

      expect(mockInvoke).toHaveBeenCalledWith('modbus_write_coil', { address: 5, value: true });
    });

    it('calls toast.error and re-throws on failure', async () => {
      const error = new Error('Write coil failed');
      mockInvoke.mockRejectedValueOnce(error);

      await expect(modbusService.writeCoil(5, true)).rejects.toThrow('Write coil failed');
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  describe('readHoldingRegisters', () => {
    it('calls invoke with modbus_read_holding_registers and start/count args', async () => {
      mockInvoke.mockResolvedValueOnce([100, 200, 300]);

      await modbusService.readHoldingRegisters(0, 3);

      expect(mockInvoke).toHaveBeenCalledWith('modbus_read_holding_registers', {
        start: 0,
        count: 3,
      });
    });

    it('calls toast.error and re-throws on failure', async () => {
      const error = new Error('Read holding registers failed');
      mockInvoke.mockRejectedValueOnce(error);

      await expect(modbusService.readHoldingRegisters(0, 3)).rejects.toThrow(
        'Read holding registers failed'
      );
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  describe('writeHoldingRegister', () => {
    it('calls invoke with modbus_write_holding_register and address/value args', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await modbusService.writeHoldingRegister(10, 500);

      expect(mockInvoke).toHaveBeenCalledWith('modbus_write_holding_register', {
        address: 10,
        value: 500,
      });
    });

    it('calls toast.error and re-throws on failure', async () => {
      const error = new Error('Write holding register failed');
      mockInvoke.mockRejectedValueOnce(error);

      await expect(modbusService.writeHoldingRegister(10, 500)).rejects.toThrow(
        'Write holding register failed'
      );
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  describe('bulkWrite', () => {
    it('calls invoke with modbus_bulk_write and operations array', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const operations = [
        { memory_type: 'coil' as const, address: 0, value: 1 },
        { memory_type: 'holding' as const, address: 10, value: 100 },
      ];

      await modbusService.bulkWrite(operations);

      expect(mockInvoke).toHaveBeenCalledWith('modbus_bulk_write', { operations });
    });

    it('calls toast.error and re-throws on failure', async () => {
      const error = new Error('Bulk write failed');
      mockInvoke.mockRejectedValueOnce(error);

      await expect(modbusService.bulkWrite([])).rejects.toThrow('Bulk write failed');
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  describe('readMemory', () => {
    it('delegates to readCoils for coil type', async () => {
      mockInvoke.mockResolvedValueOnce([true, false]);

      await modbusService.readMemory('coil', 0, 2);

      expect(mockInvoke).toHaveBeenCalledWith('modbus_read_coils', { start: 0, count: 2 });
    });

    it('delegates to readDiscreteInputs for discrete type', async () => {
      mockInvoke.mockResolvedValueOnce([true, false]);

      await modbusService.readMemory('discrete', 0, 2);

      expect(mockInvoke).toHaveBeenCalledWith('modbus_read_discrete_inputs', {
        start: 0,
        count: 2,
      });
    });

    it('delegates to readHoldingRegisters for holding type', async () => {
      mockInvoke.mockResolvedValueOnce([100, 200]);

      await modbusService.readMemory('holding', 0, 2);

      expect(mockInvoke).toHaveBeenCalledWith('modbus_read_holding_registers', {
        start: 0,
        count: 2,
      });
    });

    it('delegates to readInputRegisters for input type', async () => {
      mockInvoke.mockResolvedValueOnce([100, 200]);

      await modbusService.readMemory('input', 0, 2);

      expect(mockInvoke).toHaveBeenCalledWith('modbus_read_input_registers', {
        start: 0,
        count: 2,
      });
    });
  });

  describe('writeMemory', () => {
    it('delegates to writeCoil for coil type', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await modbusService.writeMemory('coil', 5, true);

      expect(mockInvoke).toHaveBeenCalledWith('modbus_write_coil', { address: 5, value: true });
    });

    it('delegates to writeDiscreteInput for discrete type', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await modbusService.writeMemory('discrete', 5, false);

      expect(mockInvoke).toHaveBeenCalledWith('modbus_write_discrete_input', {
        address: 5,
        value: false,
      });
    });

    it('delegates to writeHoldingRegister for holding type', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await modbusService.writeMemory('holding', 10, 500);

      expect(mockInvoke).toHaveBeenCalledWith('modbus_write_holding_register', {
        address: 10,
        value: 500,
      });
    });

    it('delegates to writeInputRegister for input type', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await modbusService.writeMemory('input', 10, 500);

      expect(mockInvoke).toHaveBeenCalledWith('modbus_write_input_register', {
        address: 10,
        value: 500,
      });
    });
  });
});
