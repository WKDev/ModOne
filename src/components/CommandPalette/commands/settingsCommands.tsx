/**
 * Settings Commands
 *
 * Commands for settings and preferences.
 */

import { Settings, Sun, Moon, Monitor, Keyboard } from 'lucide-react';
import { commandRegistry } from '../commandRegistry';
import { useEditorAreaStore } from '../../../stores/editorAreaStore';
import type { Command } from '../types';

/**
 * Register all settings-related commands.
 */
export function registerSettingsCommands(): void {
  const commands: Command[] = [
    {
      id: 'settings.open',
      category: 'settings',
      label: 'Open Settings',
      description: 'Open the settings panel',
      icon: <Settings size={16} />,
      shortcut: 'Ctrl+,',
      keywords: ['settings', 'preferences', 'options', 'configure'],
      execute: () => {
        useEditorAreaStore.getState().openSettingsTab();
      },
    },
    {
      id: 'settings.keyboardShortcuts',
      category: 'settings',
      label: 'Keyboard Shortcuts',
      description: 'View and edit keyboard shortcuts',
      icon: <Keyboard size={16} />,
      shortcut: 'Ctrl+K Ctrl+S',
      keywords: ['shortcuts', 'keybindings', 'keyboard', 'hotkeys'],
      execute: () => {
        console.log('Keyboard Shortcuts');
      },
    },
    {
      id: 'settings.themeLight',
      category: 'settings',
      label: 'Light Theme',
      description: 'Switch to light theme',
      icon: <Sun size={16} />,
      keywords: ['theme', 'light', 'bright'],
      execute: () => {
        document.documentElement.classList.remove('dark');
        console.log('Light Theme');
      },
    },
    {
      id: 'settings.themeDark',
      category: 'settings',
      label: 'Dark Theme',
      description: 'Switch to dark theme',
      icon: <Moon size={16} />,
      keywords: ['theme', 'dark', 'night'],
      execute: () => {
        document.documentElement.classList.add('dark');
        console.log('Dark Theme');
      },
    },
    {
      id: 'settings.themeSystem',
      category: 'settings',
      label: 'System Theme',
      description: 'Use system theme preference',
      icon: <Monitor size={16} />,
      keywords: ['theme', 'system', 'auto'],
      execute: () => {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        console.log('System Theme');
      },
    },
  ];

  commandRegistry.registerAll(commands);
}
