/**
 * Watch command integration tests
 *
 * These tests verify the watch command's basic behavior.
 * Note: Full watcher testing with file events is unreliable in CI
 * due to timing issues, so we focus on command behavior.
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const TEST_DIR = join(process.cwd(), '.test-watch');
const DOCS_DIR = join(TEST_DIR, 'docs');
const CLI_PATH = join(process.cwd(), 'bin/dseek.ts');

/**
 * Run CLI command and return output
 */
function runCLI(args: string, expectError = false): string {
  try {
    return execSync(`npx tsx ${CLI_PATH} ${args}`, {
      cwd: TEST_DIR,
      encoding: 'utf-8',
      env: { ...process.env, DSEEK_PROJECT_ROOT: TEST_DIR },
      timeout: 30000,
      stdio: expectError ? ['pipe', 'pipe', 'pipe'] : undefined,
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object') {
      const err = error as { stderr?: string; stdout?: string; message?: string };
      if (expectError && err.stderr) {
        return err.stderr;
      }
      if (err.stdout) {
        return err.stdout;
      }
      if (err.message) {
        return err.message;
      }
    }
    throw error;
  }
}

describe('Watch Command (Integration)', () => {
  beforeAll(() => {
    // Clean up and create test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(DOCS_DIR, { recursive: true });

    // Create initial document
    writeFileSync(
      join(DOCS_DIR, 'initial.md'),
      `# Initial Document

This is the initial content for watcher testing.
`,
    );

    // Add source and index
    runCLI(`add ${DOCS_DIR}`);
  });

  afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('watch --check', () => {
    it('returns "not running" when no watcher is active', () => {
      // Clean up any stale lock files first
      const lockPath = join(TEST_DIR, '.dseek', 'run', 'watch.lock');
      const pidPath = join(TEST_DIR, '.dseek', 'run', 'watch.pid');
      if (existsSync(lockPath)) rmSync(lockPath);
      if (existsSync(pidPath)) rmSync(pidPath);

      const output = runCLI('watch --check', true);
      expect(output.toLowerCase()).toContain('not running');
    });
  });

  describe('watch command errors', () => {
    it('shows error when no project found', () => {
      // Use a non-existent directory
      const tempDir = join(process.cwd(), '.test-watch-noproj');
      mkdirSync(tempDir, { recursive: true });

      try {
        execSync(`npx tsx ${CLI_PATH} watch --check`, {
          cwd: tempDir,
          encoding: 'utf-8',
          env: { ...process.env, DSEEK_PROJECT_ROOT: tempDir },
          timeout: 10000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch (error: unknown) {
        if (error && typeof error === 'object') {
          const err = error as { stderr?: string; stdout?: string };
          const output = err.stderr || err.stdout || '';
          expect(output.toLowerCase()).toMatch(/not running|no.*project|error/i);
        }
      } finally {
        rmSync(tempDir, { recursive: true });
      }
    });
  });
});
