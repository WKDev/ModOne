/**
 * State Sync Utility Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Tauri event API
const mockEmit = vi.fn().mockResolvedValue(undefined);
const mockListen = vi.fn().mockResolvedValue(() => {});

vi.mock('@tauri-apps/api/event', () => ({
  emit: (...args: unknown[]) => mockEmit(...args),
  listen: (...args: unknown[]) => mockListen(...args),
}));

import { setupStateSync, requestStateFromMain } from '../stateSync';

describe('stateSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window.location for getWindowId
    Object.defineProperty(window, 'location', {
      value: { search: '' },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('setupStateSync', () => {
    it('creates a sync controller with broadcastState and cleanup', () => {
      const setState = vi.fn();
      const controller = setupStateSync('test-store', setState);

      expect(controller).toHaveProperty('broadcastState');
      expect(controller).toHaveProperty('cleanup');
      expect(controller).toHaveProperty('isActive');
    });

    it('sets up event listener on initialization', () => {
      const setState = vi.fn();
      setupStateSync('test-store', setState);

      // listen should be called for state sync events
      expect(mockListen).toHaveBeenCalledWith(
        'modone:state-sync',
        expect.any(Function)
      );
    });

    it('broadcastState emits event with correct payload', async () => {
      const setState = vi.fn();
      const controller = setupStateSync('test-store', setState);

      // Wait for initialization
      await new Promise((r) => setTimeout(r, 10));

      const testState = { count: 42 };
      controller.broadcastState(testState);

      expect(mockEmit).toHaveBeenCalledWith(
        'modone:state-sync',
        expect.objectContaining({
          storeName: 'test-store',
          state: testState,
          sourceWindowId: 'main',
          timestamp: expect.any(Number),
        })
      );
    });

    it('does not broadcast when shouldBroadcast returns false', async () => {
      const setState = vi.fn();
      const controller = setupStateSync('test-store', setState, {
        shouldBroadcast: () => false,
      });

      await new Promise((r) => setTimeout(r, 10));

      controller.broadcastState({ count: 42 });

      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('applies transformForBroadcast before emitting', async () => {
      const setState = vi.fn();
      const controller = setupStateSync('test-store', setState, {
        transformForBroadcast: (state: { count: number; secret: string }) => ({ count: state.count }),
      });

      await new Promise((r) => setTimeout(r, 10));

      controller.broadcastState({ count: 42, secret: 'hidden' });

      expect(mockEmit).toHaveBeenCalledWith(
        'modone:state-sync',
        expect.objectContaining({
          state: { count: 42 }, // secret should be stripped
        })
      );
    });

    it('does not broadcast when not active (after cleanup)', async () => {
      const setState = vi.fn();
      const controller = setupStateSync('test-store', setState);

      await new Promise((r) => setTimeout(r, 10));

      await controller.cleanup();
      controller.broadcastState({ count: 42 });

      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('cleanup removes listener', async () => {
      const mockUnlisten = vi.fn();
      mockListen.mockResolvedValue(mockUnlisten);

      const setState = vi.fn();
      const controller = setupStateSync('test-store', setState);

      await new Promise((r) => setTimeout(r, 10));

      await controller.cleanup();

      expect(mockUnlisten).toHaveBeenCalled();
    });
  });

  describe('requestStateFromMain', () => {
    it('emits state request event for non-main windows', async () => {
      Object.defineProperty(window, 'location', {
        value: { search: '?windowId=floating-123' },
        writable: true,
      });

      await requestStateFromMain('test-store');

      expect(mockEmit).toHaveBeenCalledWith(
        'modone:state-request',
        expect.objectContaining({
          storeName: 'test-store',
          requestingWindowId: 'floating-123',
          timestamp: expect.any(Number),
        })
      );
    });

    it('does nothing for main window', async () => {
      // Default is main window (no windowId param)
      await requestStateFromMain('test-store');

      expect(mockEmit).not.toHaveBeenCalled();
    });
  });
});
