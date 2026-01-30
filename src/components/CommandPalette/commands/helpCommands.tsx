/**
 * Help Commands
 *
 * Commands for help, documentation, and about.
 */

import { HelpCircle, BookOpen, Info, MessageSquare, ExternalLink } from 'lucide-react';
import { commandRegistry } from '../commandRegistry';
import type { Command } from '../types';

/**
 * Register all help-related commands.
 */
export function registerHelpCommands(): void {
  const commands: Command[] = [
    {
      id: 'help.documentation',
      category: 'help',
      label: 'Documentation',
      description: 'Open the documentation',
      icon: <BookOpen size={16} />,
      shortcut: 'F1',
      keywords: ['docs', 'documentation', 'help', 'guide', 'manual'],
      execute: () => {
        window.open('https://docs.modone.app', '_blank');
      },
    },
    {
      id: 'help.shortcuts',
      category: 'help',
      label: 'Keyboard Shortcuts',
      description: 'Show keyboard shortcuts reference',
      icon: <HelpCircle size={16} />,
      shortcut: 'Ctrl+?',
      keywords: ['shortcuts', 'keyboard', 'keys', 'help'],
      execute: () => {
        console.log('Show Keyboard Shortcuts');
      },
    },
    {
      id: 'help.feedback',
      category: 'help',
      label: 'Send Feedback',
      description: 'Send feedback or report an issue',
      icon: <MessageSquare size={16} />,
      keywords: ['feedback', 'issue', 'bug', 'report'],
      execute: () => {
        window.open('https://github.com/modone/feedback/issues', '_blank');
      },
    },
    {
      id: 'help.releaseNotes',
      category: 'help',
      label: 'Release Notes',
      description: 'View release notes and changelog',
      icon: <ExternalLink size={16} />,
      keywords: ['release', 'changelog', 'updates', 'version'],
      execute: () => {
        console.log('Show Release Notes');
      },
    },
    {
      id: 'help.about',
      category: 'help',
      label: 'About ModOne',
      description: 'About this application',
      icon: <Info size={16} />,
      keywords: ['about', 'version', 'info'],
      execute: () => {
        console.log('Show About Dialog');
      },
    },
  ];

  commandRegistry.registerAll(commands);
}
