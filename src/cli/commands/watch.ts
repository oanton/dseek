/**
 * Watch command - file watcher daemon
 *
 * Monitors source folders for changes and auto-indexes.
 *
 * @module cli/commands/watch
 */

import { Command } from 'commander';
import { findProjectRoot } from '../../core/config.js';
import { isWatcherRunning, startWatcher } from '../../core/watcher.js';

export const watchCommand = new Command('watch')
  .description('Watch source folders for changes and auto-index')
  .option('--check', 'Check if watcher is running')
  .action(async (options) => {
    try {
      // Just check status
      if (options.check) {
        const running = isWatcherRunning();
        console.log(running ? 'Watcher is running' : 'Watcher is not running');
        process.exit(running ? 0 : 1);
      }

      // Verify project exists
      let projectRoot: string;
      try {
        projectRoot = findProjectRoot();
      } catch {
        console.error('Error: No dseek project found.');
        console.error('Run `dseek add <path>` to initialize and add sources.');
        process.exit(1);
      }

      // Check if already running
      if (isWatcherRunning()) {
        console.error('Error: Watcher is already running.');
        console.error('Use --check to verify status.');
        process.exit(1);
      }

      // Start watcher
      await startWatcher(projectRoot);

      // Keep process alive
      await new Promise(() => {});
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
