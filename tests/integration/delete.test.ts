/**
 * Delete command integration tests
 *
 * Tests edge cases for document deletion:
 * - Force flag behavior
 * - Non-existent documents
 * - Paths with special characters
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const TEST_DIR = join(process.cwd(), '.test-delete');
const DOCS_DIR = join(TEST_DIR, 'docs');
const CLI_PATH = join(process.cwd(), 'bin/dseek.ts');

function runCLI(args: string, expectError = false): string {
  try {
    return execSync(`npx tsx ${CLI_PATH} ${args}`, {
      cwd: TEST_DIR,
      encoding: 'utf-8',
      env: { ...process.env, DSEEK_PROJECT_ROOT: TEST_DIR },
      stdio: expectError ? ['pipe', 'pipe', 'pipe'] : undefined,
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object') {
      if ('stderr' in error && expectError) {
        return (error as { stderr: string }).stderr;
      }
      if ('stdout' in error) {
        return (error as { stdout: string }).stdout;
      }
    }
    throw error;
  }
}

describe('Delete Command Integration', () => {
  beforeAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(DOCS_DIR, { recursive: true });

    // Create test documents
    writeFileSync(join(DOCS_DIR, 'to-delete.md'), '# Document to Delete\n\nThis will be deleted.');
    writeFileSync(join(DOCS_DIR, 'keeper.md'), '# Keeper Document\n\nThis should remain.');

    // Create nested directory
    const nestedDir = join(DOCS_DIR, 'nested');
    mkdirSync(nestedDir, { recursive: true });
    writeFileSync(join(nestedDir, 'deep-doc.md'), '# Nested Document\n\nIn a subdirectory.');

    // Index everything via CLI
    runCLI(`add ${DOCS_DIR}`);
  }, 180000);

  afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('--force flag', () => {
    it('deletes document immediately with --force', () => {
      // Verify it's indexed
      const listBefore = runCLI('list');
      expect(listBefore).toContain('to-delete.md');

      // Delete with --force
      const deleteOutput = runCLI('delete docs/to-delete.md --force');
      expect(deleteOutput.toLowerCase()).toContain('deleted');

      // Verify it's gone
      const listAfter = runCLI('list');
      expect(listAfter).not.toContain('to-delete.md');
      // Other document should still exist
      expect(listAfter).toContain('keeper.md');
    }, 120000);
  });

  describe('error handling', () => {
    it('returns not found for non-existent document', () => {
      const output = runCLI('delete nonexistent-doc.md --force');
      expect(output.toLowerCase()).toContain('not found');
    });

    it('handles document ID with subdirectory path', () => {
      // Verify nested doc exists
      const listBefore = runCLI('list');
      expect(listBefore).toContain('deep-doc.md');

      // Delete using relative path
      const deleteOutput = runCLI('delete docs/nested/deep-doc.md --force');
      expect(deleteOutput.toLowerCase()).toContain('deleted');

      // Verify it's gone
      const listAfter = runCLI('list');
      expect(listAfter).not.toContain('deep-doc.md');
    }, 120000);
  });

  describe('confirmation prompt', () => {
    it('shows prompt message without --force', () => {
      // Create new doc for this test
      writeFileSync(join(DOCS_DIR, 'prompt-test.md'), '# Prompt Test\n\nFor testing prompt.');
      runCLI(`add ${DOCS_DIR}`);

      // Running without --force should show confirmation prompt
      // We pipe "n" to cancel the deletion
      let output = '';
      let didRun = false;

      try {
        output = execSync(`echo "n" | npx tsx ${CLI_PATH} delete docs/prompt-test.md`, {
          cwd: TEST_DIR,
          encoding: 'utf-8',
          env: { ...process.env, DSEEK_PROJECT_ROOT: TEST_DIR },
          timeout: 10000,
        });
        didRun = true;
      } catch (error: unknown) {
        didRun = true;
        if (error && typeof error === 'object' && 'stdout' in error) {
          output = (error as { stdout: string }).stdout;
        }
      }

      // Ensure the command actually ran
      expect(didRun).toBe(true);
      // Should show the confirmation prompt
      expect(output).toContain('About to delete');
    }, 120000);
  });
});
