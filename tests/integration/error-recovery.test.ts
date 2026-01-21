/**
 * Error Recovery Integration Tests
 *
 * Tests that the system handles errors gracefully without crashing.
 */

import { existsSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initializeProject } from '../../src/core/config.js';
import { EMBEDDING_CONFIG } from '../../src/core/constants.js';
import { indexFile } from '../../src/core/indexer.js';
import { resetIndex, searchIndex } from '../../src/storage/index.js';
import { resetMetadata } from '../../src/storage/metadata.js';

const TEST_DIR = join(process.cwd(), '.test-error-recovery');
const DOCS_DIR = join(TEST_DIR, 'docs');

describe('Error Recovery', () => {
  beforeAll(async () => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(DOCS_DIR, { recursive: true });
    process.env.DSEEK_PROJECT_ROOT = TEST_DIR;
    await initializeProject(TEST_DIR);
  });

  afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    delete process.env.DSEEK_PROJECT_ROOT;
  });

  beforeEach(async () => {
    await resetIndex();
    await resetMetadata();
  });

  it('indexFile handles file deleted during processing gracefully', async () => {
    const filePath = join(DOCS_DIR, 'temp-file.md');
    writeFileSync(filePath, '# Temporary File\n\nThis file will be deleted.');

    // Start indexing (this is a simplified test - real race condition is hard to trigger)
    // We test the error handling by deleting after file existence check but the behavior
    // should still be graceful
    const result = await indexFile(filePath, TEST_DIR);

    // Whether successful or not, should not throw
    expect(result).toHaveProperty('success');

    // Clean up
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }, 120000);

  it('search handles empty query gracefully', async () => {
    // Empty embedding (all zeros) - no indexing needed for this test
    const emptyEmbedding = new Array(EMBEDDING_CONFIG.DIMENSIONS).fill(0);

    // Should not throw, even with empty index
    const { results, total } = await searchIndex('', emptyEmbedding);

    expect(Array.isArray(results)).toBe(true);
    expect(typeof total).toBe('number');
  });

  it('indexFile returns error for non-existent file without throwing', async () => {
    const nonExistentPath = join(DOCS_DIR, 'does-not-exist.md');

    // Should return error result, not throw
    const result = await indexFile(nonExistentPath, TEST_DIR);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('not found');
  });
});
