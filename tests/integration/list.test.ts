/**
 * List command integration tests
 *
 * Tests sorting and output options:
 * - Sort by path, size, updated
 * - JSON output format
 * - Empty index handling
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const TEST_DIR = join(process.cwd(), '.test-list');
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

describe('List Command Integration', () => {
  beforeAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(DOCS_DIR, { recursive: true });
  }, 30000);

  afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('empty index', () => {
    it('returns helpful message for empty index', () => {
      // Initialize project without adding docs
      runCLI('bootstrap');

      const output = runCLI('list');
      expect(output).toContain('No documents indexed');
      expect(output).toContain('dseek add');
    }, 180000);

    it('returns empty array in JSON mode for empty index', () => {
      const output = runCLI('list --json');
      const result = JSON.parse(output);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe('sorting', () => {
    beforeAll(() => {
      // Create documents with different sizes
      writeFileSync(join(DOCS_DIR, 'aaa-small.md'), '# Small\n\nTiny content.');
      writeFileSync(join(DOCS_DIR, 'bbb-medium.md'), '# Medium\n\n' + 'Content paragraph. '.repeat(50));
      writeFileSync(join(DOCS_DIR, 'ccc-large.md'), '# Large\n\n' + 'Lots of content here. '.repeat(200));

      // Index via CLI
      runCLI(`add ${DOCS_DIR}`);
    }, 180000);

    it('sorts by path alphabetically by default', () => {
      const output = runCLI('list --json');
      const result = JSON.parse(output);

      expect(result.length).toBe(3);
      // Default sort is by path (doc_id)
      expect(result[0].doc_id).toContain('aaa');
      expect(result[1].doc_id).toContain('bbb');
      expect(result[2].doc_id).toContain('ccc');
    });

    it('sorts by size descending with --sort size', () => {
      const output = runCLI('list --json --sort size');
      const result = JSON.parse(output);

      expect(result.length).toBe(3);
      // Size sort is descending (largest first)
      expect(result[0].size_bytes).toBeGreaterThanOrEqual(result[1].size_bytes);
      expect(result[1].size_bytes).toBeGreaterThanOrEqual(result[2].size_bytes);
    });

    it('sorts by updated timestamp with --sort updated', () => {
      const output = runCLI('list --json --sort updated');
      const result = JSON.parse(output);

      expect(result.length).toBe(3);
      // Updated sort is descending (most recent first)
      const timestamps = result.map((d: { updated_at: string }) => new Date(d.updated_at).getTime());
      expect(timestamps[0]).toBeGreaterThanOrEqual(timestamps[1]);
      expect(timestamps[1]).toBeGreaterThanOrEqual(timestamps[2]);
    });
  });

  describe('output format', () => {
    it('human readable output shows document details', () => {
      const output = runCLI('list');

      // Should contain indexed documents
      expect(output).toContain('.md');
      expect(output).toContain('Format:');
      expect(output).toContain('md');
      expect(output).toContain('KB');
      expect(output).toContain('Updated:');
    });

    it('JSON output has correct structure', () => {
      const output = runCLI('list --json');
      const result = JSON.parse(output);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      const doc = result[0];
      expect(doc).toHaveProperty('doc_id');
      expect(doc).toHaveProperty('format');
      expect(doc).toHaveProperty('size_bytes');
      expect(doc).toHaveProperty('updated_at');

      expect(doc.format).toBe('md');
      expect(typeof doc.size_bytes).toBe('number');
    });
  });
});
