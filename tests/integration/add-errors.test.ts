/**
 * Add command error handling tests
 *
 * Tests error scenarios for the add command:
 * - Non-existent paths
 * - Invalid configurations
 * - Pattern handling
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const TEST_DIR = join(process.cwd(), '.test-add-errors');
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
      if ('stderr' in error) {
        return (error as { stderr: string }).stderr;
      }
      if ('stdout' in error) {
        return (error as { stdout: string }).stdout;
      }
    }
    throw error;
  }
}

describe('Add Command Error Handling', () => {
  beforeAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(DOCS_DIR, { recursive: true });

    // Initialize project
    runCLI('bootstrap');
  }, 180000);

  afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('path validation', () => {
    it('rejects non-existent path with clear error', () => {
      const output = runCLI('add /path/that/does/not/exist', true);
      expect(output.toLowerCase()).toContain('error');
      expect(output.toLowerCase()).toContain('not found');
    });

    it('rejects relative non-existent path', () => {
      const output = runCLI('add ./nonexistent-folder', true);
      expect(output.toLowerCase()).toContain('error');
    });
  });

  describe('include/exclude patterns', () => {
    beforeAll(() => {
      // Create docs with different extensions
      writeFileSync(join(DOCS_DIR, 'include-me.md'), '# Include\n\nThis should be indexed.');
      writeFileSync(join(DOCS_DIR, 'exclude-me.txt'), 'This should be excluded.');
      writeFileSync(join(DOCS_DIR, 'also-include.md'), '# Also Include\n\nThis too.');
    });

    it('respects --exclude patterns', () => {
      // Add with exclude pattern
      const addOutput = runCLI(`add ${DOCS_DIR} --exclude "**/*.txt"`);
      expect(addOutput).toContain('Added source');
      expect(addOutput).toContain('Indexing');
    }, 180000);

    it('respects --include patterns to narrow scope', () => {
      // Clean test dir for fresh start
      if (existsSync(TEST_DIR)) {
        rmSync(TEST_DIR, { recursive: true });
      }
      mkdirSync(DOCS_DIR, { recursive: true });
      runCLI('bootstrap');

      // Create docs
      writeFileSync(join(DOCS_DIR, 'readme.md'), '# Readme\n\nProject readme.');
      writeFileSync(join(DOCS_DIR, 'api.md'), '# API\n\nAPI documentation.');

      const addOutput = runCLI(`add ${DOCS_DIR} --include "**/api.md"`);
      expect(addOutput).toContain('Added source');
      expect(addOutput).toContain('Indexing');
    }, 180000);
  });

  describe('indexing statistics', () => {
    beforeAll(() => {
      // Clean test dir
      if (existsSync(TEST_DIR)) {
        rmSync(TEST_DIR, { recursive: true });
      }
      mkdirSync(DOCS_DIR, { recursive: true });
      runCLI('bootstrap');

      // Create test documents
      writeFileSync(join(DOCS_DIR, 'doc1.md'), '# Document 1\n\nFirst document content.');
      writeFileSync(join(DOCS_DIR, 'doc2.md'), '# Document 2\n\nSecond document content.');
      writeFileSync(join(DOCS_DIR, 'doc3.md'), '# Document 3\n\nThird document content.');
    }, 180000);

    it('shows stats for indexed files', () => {
      const output = runCLI(`add ${DOCS_DIR}`);

      // Should show indexing stats
      expect(output).toContain('Indexed');
      expect(output).toMatch(/Indexed:\s*\d+\s*files/);
    }, 180000);
  });

  describe('--no-index flag', () => {
    it('adds source without indexing when --no-index is used', () => {
      // Clean test dir
      if (existsSync(TEST_DIR)) {
        rmSync(TEST_DIR, { recursive: true });
      }
      mkdirSync(DOCS_DIR, { recursive: true });
      runCLI('bootstrap');

      writeFileSync(join(DOCS_DIR, 'no-index-test.md'), '# No Index\n\nShould not be indexed yet.');

      const output = runCLI(`add ${DOCS_DIR} --no-index`);

      // Should add source but not index
      expect(output).toContain('Added source');
      expect(output).not.toContain('Indexing');

      // List should be empty since we didn't index
      const listOutput = runCLI('list');
      expect(listOutput).toContain('No documents indexed');
    }, 180000);
  });
});
