/**
 * Command Registry Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { commandRegistry } from '../commandRegistry';
import type { Command } from '../types';

// Helper to create test commands
const createTestCommand = (overrides: Partial<Command> = {}): Command => ({
  id: `test-${Math.random().toString(36).slice(2)}`,
  category: 'edit',
  label: 'Test Command',
  execute: vi.fn(),
  ...overrides,
});

describe('CommandRegistry', () => {
  beforeEach(() => {
    commandRegistry.clear();
  });

  describe('register/unregister', () => {
    it('should register a command', () => {
      const cmd = createTestCommand({ id: 'test.command' });
      commandRegistry.register(cmd);

      expect(commandRegistry.has('test.command')).toBe(true);
      expect(commandRegistry.get('test.command')).toBe(cmd);
    });

    it('should unregister a command', () => {
      const cmd = createTestCommand({ id: 'test.command' });
      commandRegistry.register(cmd);
      commandRegistry.unregister('test.command');

      expect(commandRegistry.has('test.command')).toBe(false);
      expect(commandRegistry.get('test.command')).toBeUndefined();
    });

    it('should register multiple commands with registerAll', () => {
      const cmds = [
        createTestCommand({ id: 'cmd1' }),
        createTestCommand({ id: 'cmd2' }),
        createTestCommand({ id: 'cmd3' }),
      ];
      commandRegistry.registerAll(cmds);

      expect(commandRegistry.size).toBe(3);
      expect(commandRegistry.has('cmd1')).toBe(true);
      expect(commandRegistry.has('cmd2')).toBe(true);
      expect(commandRegistry.has('cmd3')).toBe(true);
    });
  });

  describe('getAll', () => {
    it('should return all commands', () => {
      const cmd1 = createTestCommand({ id: 'cmd1' });
      const cmd2 = createTestCommand({ id: 'cmd2' });
      commandRegistry.register(cmd1);
      commandRegistry.register(cmd2);

      const all = commandRegistry.getAll();
      expect(all).toHaveLength(2);
      expect(all).toContain(cmd1);
      expect(all).toContain(cmd2);
    });

    it('should filter commands by when() condition', () => {
      const visibleCmd = createTestCommand({ id: 'visible', when: () => true });
      const hiddenCmd = createTestCommand({ id: 'hidden', when: () => false });
      commandRegistry.register(visibleCmd);
      commandRegistry.register(hiddenCmd);

      const all = commandRegistry.getAll();
      expect(all).toHaveLength(1);
      expect(all).toContain(visibleCmd);
      expect(all).not.toContain(hiddenCmd);
    });

    it('should include commands without when() condition', () => {
      const cmd = createTestCommand({ id: 'always' });
      commandRegistry.register(cmd);

      const all = commandRegistry.getAll();
      expect(all).toContain(cmd);
    });
  });

  describe('getByCategory', () => {
    it('should return commands in specified category', () => {
      const fileCmd = createTestCommand({ id: 'file.save', category: 'file' });
      const editCmd = createTestCommand({ id: 'edit.undo', category: 'edit' });
      commandRegistry.register(fileCmd);
      commandRegistry.register(editCmd);

      const fileCommands = commandRegistry.getByCategory('file');
      expect(fileCommands).toHaveLength(1);
      expect(fileCommands).toContain(fileCmd);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      commandRegistry.registerAll([
        createTestCommand({ id: 'file.save', category: 'file', label: 'Save File', keywords: ['write', 'store'] }),
        createTestCommand({ id: 'file.open', category: 'file', label: 'Open File', keywords: ['load'] }),
        createTestCommand({ id: 'edit.undo', category: 'edit', label: 'Undo', keywords: ['revert'] }),
        createTestCommand({ id: 'edit.redo', category: 'edit', label: 'Redo' }),
      ]);
    });

    it('should find commands matching label', () => {
      const results = commandRegistry.search('Save');
      expect(results).toHaveLength(1);
      expect(results[0].command.id).toBe('file.save');
    });

    it('should find commands matching keywords', () => {
      const results = commandRegistry.search('write');
      expect(results).toHaveLength(1);
      expect(results[0].command.id).toBe('file.save');
    });

    it('should find commands matching category', () => {
      const results = commandRegistry.search('edit');
      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.some((r) => r.command.id === 'edit.undo')).toBe(true);
      expect(results.some((r) => r.command.id === 'edit.redo')).toBe(true);
    });

    it('should be case-insensitive', () => {
      const results = commandRegistry.search('SAVE');
      expect(results).toHaveLength(1);
      expect(results[0].command.id).toBe('file.save');
    });

    it('should return empty array for no matches', () => {
      const results = commandRegistry.search('nonexistent');
      expect(results).toHaveLength(0);
    });

    it('should respect limit option', () => {
      const results = commandRegistry.search('file', { limit: 1 });
      expect(results).toHaveLength(1);
    });

    it('should filter by categories option', () => {
      const results = commandRegistry.search('', { categories: ['file'] });
      expect(results.every((r) => r.command.category === 'file')).toBe(true);
    });

    it('should score exact matches higher', () => {
      const results = commandRegistry.search('Undo');
      expect(results[0].command.id).toBe('edit.undo');
      expect(results[0].score).toBeGreaterThan(50); // Exact match should have high score
    });
  });

  describe('execute', () => {
    it('should execute command and add to recent', async () => {
      const execute = vi.fn();
      const cmd = createTestCommand({ id: 'test.execute', execute });
      commandRegistry.register(cmd);

      await commandRegistry.execute('test.execute');

      expect(execute).toHaveBeenCalledOnce();
      expect(commandRegistry.getRecent()).toContain(cmd);
    });

    it('should not execute command when when() returns false', async () => {
      const execute = vi.fn();
      const cmd = createTestCommand({ id: 'test.disabled', execute, when: () => false });
      commandRegistry.register(cmd);

      await commandRegistry.execute('test.disabled');

      expect(execute).not.toHaveBeenCalled();
    });

    it('should handle async execute functions', async () => {
      const execute = vi.fn().mockResolvedValue(undefined);
      const cmd = createTestCommand({ id: 'test.async', execute });
      commandRegistry.register(cmd);

      await commandRegistry.execute('test.async');

      expect(execute).toHaveBeenCalledOnce();
    });

    it('should warn when command not found', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await commandRegistry.execute('nonexistent');

      expect(warnSpy).toHaveBeenCalledWith('Command not found: nonexistent');
      warnSpy.mockRestore();
    });
  });

  describe('recent commands', () => {
    it('should track recently executed commands', async () => {
      const cmd1 = createTestCommand({ id: 'cmd1' });
      const cmd2 = createTestCommand({ id: 'cmd2' });
      commandRegistry.register(cmd1);
      commandRegistry.register(cmd2);

      await commandRegistry.execute('cmd1');
      await commandRegistry.execute('cmd2');

      const recent = commandRegistry.getRecent();
      expect(recent[0].id).toBe('cmd2'); // Most recent first
      expect(recent[1].id).toBe('cmd1');
    });

    it('should move repeated command to front', async () => {
      const cmd1 = createTestCommand({ id: 'cmd1' });
      const cmd2 = createTestCommand({ id: 'cmd2' });
      commandRegistry.register(cmd1);
      commandRegistry.register(cmd2);

      await commandRegistry.execute('cmd1');
      await commandRegistry.execute('cmd2');
      await commandRegistry.execute('cmd1');

      const recent = commandRegistry.getRecent();
      expect(recent[0].id).toBe('cmd1');
      expect(recent).toHaveLength(2);
    });

    it('should respect MAX_RECENT limit', async () => {
      // Register 15 commands
      for (let i = 0; i < 15; i++) {
        commandRegistry.register(createTestCommand({ id: `cmd${i}` }));
      }

      // Execute all 15
      for (let i = 0; i < 15; i++) {
        await commandRegistry.execute(`cmd${i}`);
      }

      // Should only keep 10 (MAX_RECENT)
      expect(commandRegistry.getRecent(15)).toHaveLength(10);
    });

    it('should filter recent by when() condition', async () => {
      let enabled = true;
      const cmd = createTestCommand({ id: 'conditional', when: () => enabled });
      commandRegistry.register(cmd);

      await commandRegistry.execute('conditional');
      expect(commandRegistry.getRecent()).toHaveLength(1);

      enabled = false;
      expect(commandRegistry.getRecent()).toHaveLength(0);
    });

    it('should clear recent commands', async () => {
      const cmd = createTestCommand({ id: 'cmd' });
      commandRegistry.register(cmd);
      await commandRegistry.execute('cmd');

      commandRegistry.clearRecent();

      expect(commandRegistry.getRecent()).toHaveLength(0);
    });
  });

  describe('subscription', () => {
    it('should notify subscribers on register', () => {
      const callback = vi.fn();
      const unsubscribe = commandRegistry.subscribe(callback);

      commandRegistry.register(createTestCommand());

      expect(callback).toHaveBeenCalled();
      unsubscribe();
    });

    it('should notify subscribers on unregister', () => {
      const cmd = createTestCommand({ id: 'test' });
      commandRegistry.register(cmd);

      const callback = vi.fn();
      const unsubscribe = commandRegistry.subscribe(callback);

      commandRegistry.unregister('test');

      expect(callback).toHaveBeenCalled();
      unsubscribe();
    });

    it('should notify subscribers on execute', async () => {
      const cmd = createTestCommand({ id: 'test' });
      commandRegistry.register(cmd);

      const callback = vi.fn();
      const unsubscribe = commandRegistry.subscribe(callback);

      await commandRegistry.execute('test');

      expect(callback).toHaveBeenCalled();
      unsubscribe();
    });

    it('should stop notifying after unsubscribe', () => {
      const callback = vi.fn();
      const unsubscribe = commandRegistry.subscribe(callback);

      unsubscribe();
      commandRegistry.register(createTestCommand());

      expect(callback).not.toHaveBeenCalled();
    });
  });
});
