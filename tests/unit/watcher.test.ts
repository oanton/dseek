/**
 * Watcher module tests
 *
 * Tests watcher state management and lock file handling.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isWatcherRunning } from '../../src/core/watcher.js';

const TEST_DIR = join(process.cwd(), '.test-watcher');
const DSEEK_DIR = join(TEST_DIR, '.dseek');
const RUN_DIR = join(DSEEK_DIR, 'run');

describe('Watcher', () => {
  beforeEach(() => {
    // Clean up and create test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(RUN_DIR, { recursive: true });

    // Set env var to point to test directory
    process.env.DSEEK_PROJECT_ROOT = TEST_DIR;
  });

  afterEach(() => {
    // Clean up
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    delete process.env.DSEEK_PROJECT_ROOT;
  });

  describe('isWatcherRunning', () => {
    it('returns false when no lock file exists', () => {
      // No lock file in RUN_DIR
      expect(isWatcherRunning()).toBe(false);
    });

    it('returns false and cleans up stale lock with dead PID', () => {
      // Create lock file with non-existent PID
      const lockPath = join(RUN_DIR, 'watch.lock');
      const pidPath = join(RUN_DIR, 'watch.pid');

      writeFileSync(lockPath, new Date().toISOString());
      writeFileSync(pidPath, '999999999'); // Non-existent PID

      const result = isWatcherRunning();

      expect(result).toBe(false);
      // Lock files should be cleaned up
      expect(existsSync(lockPath)).toBe(false);
      expect(existsSync(pidPath)).toBe(false);
    });

    it('returns true when lock file exists with current process PID', () => {
      // Create lock file with current process PID
      const lockPath = join(RUN_DIR, 'watch.lock');
      const pidPath = join(RUN_DIR, 'watch.pid');

      writeFileSync(lockPath, new Date().toISOString());
      writeFileSync(pidPath, process.pid.toString());

      const result = isWatcherRunning();

      expect(result).toBe(true);
      // Lock files should remain
      expect(existsSync(lockPath)).toBe(true);
      expect(existsSync(pidPath)).toBe(true);
    });

    it('returns false when lock exists but no PID file', () => {
      // Create only lock file, no PID file
      const lockPath = join(RUN_DIR, 'watch.lock');
      writeFileSync(lockPath, new Date().toISOString());

      const result = isWatcherRunning();

      expect(result).toBe(false);
    });

    it('handles corrupted PID file gracefully', () => {
      const lockPath = join(RUN_DIR, 'watch.lock');
      const pidPath = join(RUN_DIR, 'watch.pid');

      writeFileSync(lockPath, new Date().toISOString());
      writeFileSync(pidPath, 'not-a-number'); // Invalid PID

      const result = isWatcherRunning();

      // Should not throw, returns false
      expect(result).toBe(false);
    });

    it('cleans up stale lock files from crashed process', () => {
      const lockPath = join(RUN_DIR, 'watch.lock');
      const pidPath = join(RUN_DIR, 'watch.pid');

      // Simulate old lock from crashed process
      writeFileSync(lockPath, new Date(Date.now() - 86400000).toISOString()); // 1 day old
      writeFileSync(pidPath, '2'); // PID 2 is typically kernel thread, won't be our process

      const result = isWatcherRunning();

      expect(result).toBe(false);
      // Stale files should be cleaned
      expect(existsSync(lockPath)).toBe(false);
      expect(existsSync(pidPath)).toBe(false);
    });
  });

  describe('lock file management', () => {
    it('lock file contains valid ISO timestamp', () => {
      const lockPath = join(RUN_DIR, 'watch.lock');
      const timestamp = new Date().toISOString();
      writeFileSync(lockPath, timestamp);

      const content = readFileSync(lockPath, 'utf-8');
      const parsed = new Date(content);

      expect(parsed.toISOString()).toBe(timestamp);
    });

    it('PID file contains numeric PID', () => {
      const pidPath = join(RUN_DIR, 'watch.pid');
      writeFileSync(pidPath, process.pid.toString());

      const content = readFileSync(pidPath, 'utf-8');
      const pid = parseInt(content.trim(), 10);

      expect(pid).toBe(process.pid);
      expect(Number.isInteger(pid)).toBe(true);
    });
  });
});
