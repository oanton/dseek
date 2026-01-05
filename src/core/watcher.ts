/**
 * File watcher - Chokidar wrapper with debounce
 *
 * Watches source directories for changes and triggers re-indexing.
 * Supports debouncing, lock files, and graceful shutdown.
 *
 * @module watcher
 */

import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import chokidar, { type FSWatcher } from 'chokidar';
import { isSupported } from '../parsers/index.js';
import { saveIndex } from '../storage/index.js';
import { saveMetadata } from '../storage/metadata.js';
import { findProjectRoot, getDseekDir, loadConfig, loadIgnorePatterns } from './config.js';
import { DIRS, FILES, TIMING } from './constants.js';
import { deleteDocument, indexFile } from './indexer.js';

interface WatcherState {
  watcher: FSWatcher | null;
  projectRoot: string;
  ignorePatterns: string[];
  pendingChanges: Map<string, NodeJS.Timeout>;
  isShuttingDown: boolean;
}

const state: WatcherState = {
  watcher: null,
  projectRoot: '',
  ignorePatterns: [],
  pendingChanges: new Map(),
  isShuttingDown: false,
};

/**
 * Get run directory path
 */
function getRunDir(): string {
  return join(getDseekDir(), DIRS.RUN);
}

/**
 * Check if watcher is already running.
 *
 * Checks lock file and validates PID is still alive.
 *
 * @returns True if another watcher instance is running
 */
export function isWatcherRunning(): boolean {
  const lockPath = join(getRunDir(), FILES.WATCH_LOCK);

  if (!existsSync(lockPath)) {
    return false;
  }

  // Check if PID is still alive
  const pidPath = join(getRunDir(), FILES.WATCH_PID);
  if (existsSync(pidPath)) {
    try {
      const pid = parseInt(readFileSync(pidPath, 'utf-8').trim(), 10);
      process.kill(pid, 0); // Check if process exists
      return true;
    } catch {
      // Process not running, clean up stale files
      cleanupLockFiles();
      return false;
    }
  }

  return false;
}

/**
 * Clean up lock files
 */
function cleanupLockFiles(): void {
  const lockPath = join(getRunDir(), FILES.WATCH_LOCK);
  const pidPath = join(getRunDir(), FILES.WATCH_PID);

  try {
    if (existsSync(lockPath)) unlinkSync(lockPath);
    if (existsSync(pidPath)) unlinkSync(pidPath);
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Create lock files
 */
function createLockFiles(): void {
  const runDir = getRunDir();
  const { mkdirSync } = require('node:fs');

  if (!existsSync(runDir)) {
    mkdirSync(runDir, { recursive: true });
  }

  writeFileSync(join(runDir, FILES.WATCH_LOCK), new Date().toISOString());
  writeFileSync(join(runDir, FILES.WATCH_PID), process.pid.toString());
}

/**
 * Check if path should be ignored
 */
function shouldIgnore(filePath: string): boolean {
  const relativePath = relative(state.projectRoot, filePath);

  // Ignore hidden files and directories
  if (relativePath.includes('/.') || relativePath.startsWith('.')) {
    return true;
  }

  // Ignore .dseek directory
  if (relativePath.includes(DIRS.DSEEK)) {
    return true;
  }

  // Check ignore patterns
  for (const pattern of state.ignorePatterns) {
    if (pattern.endsWith('/')) {
      if (relativePath.includes(pattern.slice(0, -1))) return true;
    } else if (relativePath.includes(pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Handle file change with debounce
 */
function handleChange(eventType: 'add' | 'change' | 'unlink', filePath: string): void {
  if (state.isShuttingDown) return;
  if (shouldIgnore(filePath)) return;
  if (eventType !== 'unlink' && !isSupported(filePath)) return;

  // Clear existing timeout for this file
  const existing = state.pendingChanges.get(filePath);
  if (existing) {
    clearTimeout(existing);
  }

  // Debounce the change
  const timeout = setTimeout(async () => {
    state.pendingChanges.delete(filePath);

    try {
      const relativePath = relative(state.projectRoot, filePath);

      if (eventType === 'unlink') {
        console.log(`[${new Date().toISOString()}] Removed: ${relativePath}`);
        await deleteDocument(filePath, state.projectRoot);
      } else {
        console.log(`[${new Date().toISOString()}] ${eventType === 'add' ? 'Added' : 'Updated'}: ${relativePath}`);
        const result = await indexFile(filePath, state.projectRoot);

        if (result.success && result.chunks && result.chunks > 0) {
          console.log(`  Indexed ${result.chunks} chunks`);
        } else if (!result.success) {
          console.error(`  Error: ${result.error}`);
        }
      }

      // Save changes
      await saveIndex();
      await saveMetadata();
    } catch (error) {
      console.error(`Error processing ${filePath}:`, error);
    }
  }, TIMING.WATCH_DEBOUNCE_MS);

  state.pendingChanges.set(filePath, timeout);
}

/**
 * Start watching for file changes.
 *
 * Monitors configured sources and re-indexes on add/change/unlink.
 * Creates lock file to prevent multiple instances.
 *
 * @param projectRoot - Optional project root override
 * @throws Error if watcher already running or no sources configured
 *
 * @example
 * ```ts
 * await startWatcher();
 * // Watcher runs until Ctrl+C
 * ```
 */
export async function startWatcher(projectRoot?: string): Promise<void> {
  if (state.watcher) {
    throw new Error('Watcher is already running');
  }

  if (isWatcherRunning()) {
    throw new Error('Another watcher instance is already running');
  }

  state.projectRoot = projectRoot ?? findProjectRoot();
  const config = await loadConfig(state.projectRoot);
  state.ignorePatterns = await loadIgnorePatterns(state.projectRoot);

  // Get paths to watch from sources
  const watchPaths = config.sources.map((s) => (s.path.startsWith('/') ? s.path : join(state.projectRoot, s.path)));

  if (watchPaths.length === 0) {
    throw new Error('No sources configured. Run `dseek add <path>` first.');
  }

  // Create lock files
  createLockFiles();

  // Initialize watcher
  state.watcher = chokidar.watch(watchPaths, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: TIMING.WATCH_DEBOUNCE_MS,
      pollInterval: TIMING.WATCHER_POLL_INTERVAL_MS,
    },
    ignored: (path) => shouldIgnore(path),
  });

  // Set up event handlers
  state.watcher
    .on('add', (path: string) => handleChange('add', path))
    .on('change', (path: string) => handleChange('change', path))
    .on('unlink', (path: string) => handleChange('unlink', path))
    .on('error', (error: unknown) => console.error('Watcher error:', error));

  console.log(`Watching ${watchPaths.length} source(s) for changes...`);
  console.log('Press Ctrl+C to stop.\n');

  // Handle shutdown
  const shutdown = async () => {
    if (state.isShuttingDown) return;
    state.isShuttingDown = true;

    console.log('\nShutting down watcher...');

    // Clear pending changes
    for (const timeout of state.pendingChanges.values()) {
      clearTimeout(timeout);
    }
    state.pendingChanges.clear();

    // Close watcher
    if (state.watcher) {
      await state.watcher.close();
      state.watcher = null;
    }

    // Clean up lock files
    cleanupLockFiles();

    console.log('Watcher stopped.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

/**
 * Stop the watcher and clean up.
 *
 * Clears pending changes, closes watcher, removes lock files.
 */
export async function stopWatcher(): Promise<void> {
  if (!state.watcher) return;

  state.isShuttingDown = true;

  for (const timeout of state.pendingChanges.values()) {
    clearTimeout(timeout);
  }
  state.pendingChanges.clear();

  await state.watcher.close();
  state.watcher = null;

  cleanupLockFiles();
}
