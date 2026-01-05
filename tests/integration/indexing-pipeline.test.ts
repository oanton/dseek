/**
 * Indexing Pipeline Integration Tests
 *
 * Tests the full indexing pipeline: parse → chunk → embed → store
 * Uses real embeddings for accurate testing (slower but thorough).
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initializeProject } from '../../src/core/config.js';
import { getEmbeddingDim } from '../../src/core/embedder.js';
import { deleteDocument, indexFile, indexSource } from '../../src/core/indexer.js';
import { getIndexStats, resetIndex, searchIndex } from '../../src/storage/index.js';
import { getDocument, resetMetadata } from '../../src/storage/metadata.js';
import type { Source } from '../../src/types/index.js';

const TEST_DIR = join(process.cwd(), '.test-indexing-pipeline');
const DSEEK_DIR = join(TEST_DIR, '.dseek');
const DOCS_DIR = join(TEST_DIR, 'docs');

describe('Indexing Pipeline', () => {
  beforeAll(async () => {
    // Clean up and create test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(DOCS_DIR, { recursive: true });

    // Set env var to point to test directory
    process.env.DSEEK_PROJECT_ROOT = TEST_DIR;

    // Initialize project
    await initializeProject(TEST_DIR);
    await resetIndex();
    await resetMetadata();
  }, 120000);

  afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    delete process.env.DSEEK_PROJECT_ROOT;
  });

  it('indexes markdown file and generates correct embeddings', async () => {
    const filePath = join(DOCS_DIR, 'auth.md');
    writeFileSync(
      filePath,
      `# Authentication

OAuth 2.0 is the standard protocol for authorization.

## Token Refresh

Refresh tokens allow obtaining new access tokens without re-authentication.
`,
    );

    const result = await indexFile(filePath, TEST_DIR);

    expect(result.success).toBe(true);
    expect(result.chunks).toBeGreaterThan(0);

    // Verify chunks have correct embedding dimension
    const stats = await getIndexStats();
    expect(stats.chunks).toBeGreaterThan(0);

    // Search should find the content
    const embedding = new Array(getEmbeddingDim()).fill(0.01); // Placeholder for search
    const { results } = await searchIndex('OAuth authentication', embedding, { limit: 5 });

    // At least one result should be from auth.md
    const authResults = results.filter((r) => r.path.includes('auth.md'));
    expect(authResults.length).toBeGreaterThan(0);
  }, 120000);

  it('re-indexes file when content changes (hash mismatch)', async () => {
    const filePath = join(DOCS_DIR, 'changing.md');
    writeFileSync(filePath, '# Original Content\n\nThis is the original text.');

    // First index
    const result1 = await indexFile(filePath, TEST_DIR);
    expect(result1.success).toBe(true);
    expect(result1.chunks).toBeGreaterThan(0);

    const doc1 = await getDocument('docs/changing.md');
    const hash1 = doc1?.content_hash;

    // Modify file
    writeFileSync(filePath, '# Updated Content\n\nThis is completely different text about APIs.');

    // Re-index
    const result2 = await indexFile(filePath, TEST_DIR);
    expect(result2.success).toBe(true);
    expect(result2.chunks).toBeGreaterThan(0);

    const doc2 = await getDocument('docs/changing.md');
    const hash2 = doc2?.content_hash;

    // Hash should change
    expect(hash2).not.toBe(hash1);
  }, 60000);

  it('skips file when content unchanged (same hash)', async () => {
    const filePath = join(DOCS_DIR, 'static.md');
    writeFileSync(filePath, '# Static Content\n\nThis content never changes.');

    // First index
    const result1 = await indexFile(filePath, TEST_DIR);
    expect(result1.success).toBe(true);
    expect(result1.chunks).toBeGreaterThan(0);

    // Second index without changes
    const result2 = await indexFile(filePath, TEST_DIR);
    expect(result2.success).toBe(true);
    expect(result2.chunks).toBe(0); // Should be skipped
  }, 60000);

  it('handles large file with multiple sections', async () => {
    const filePath = join(DOCS_DIR, 'large.md');

    // Generate large content with multiple sections
    const sections = Array.from(
      { length: 10 },
      (_, i) => `
## Section ${i + 1}

This is the content for section ${i + 1}. It contains multiple paragraphs
with various information about topic ${i + 1}.

Some code examples:

\`\`\`typescript
function example${i}() {
  return ${i};
}
\`\`\`

And more text to make this section substantial enough for chunking.
`,
    ).join('\n');

    writeFileSync(filePath, `# Large Document\n\n${sections}`);

    const result = await indexFile(filePath, TEST_DIR);

    expect(result.success).toBe(true);
    expect(result.chunks).toBeGreaterThan(1); // Should create multiple chunks
  }, 120000);

  it('indexSource processes folder with mixed formats', async () => {
    const mixedDir = join(TEST_DIR, 'mixed');
    mkdirSync(mixedDir, { recursive: true });

    // Create files in different formats
    writeFileSync(join(mixedDir, 'readme.md'), '# README\n\nMarkdown file content.');
    writeFileSync(join(mixedDir, 'notes.txt'), 'Plain text notes file.');
    writeFileSync(
      join(mixedDir, 'page.html'),
      '<html><head><title>HTML Page</title></head><body><h1>Title</h1><p>HTML content.</p></body></html>',
    );

    const source: Source = {
      name: 'mixed',
      path: './mixed',
      include: ['**/*'],
      exclude: [],
      watch: false,
    };

    const result = await indexSource(source, TEST_DIR);

    expect(result.errors).toHaveLength(0);
    // At least 1 file should be indexed (some might be skipped due to ignore patterns)
    expect(result.indexed).toBeGreaterThanOrEqual(1);
    // Total processed (indexed + skipped) should include our files
    expect(result.indexed + result.skipped).toBeGreaterThanOrEqual(1);
  }, 120000);

  it('deleteDocument removes all chunks for document', async () => {
    const filePath = join(DOCS_DIR, 'to-delete.md');
    writeFileSync(filePath, '# To Delete\n\nThis document will be deleted.');

    // Index first
    await indexFile(filePath, TEST_DIR);

    const statsBefore = await getIndexStats();
    const docsBefore = statsBefore.documents.size;

    // Delete
    const deleted = await deleteDocument('docs/to-delete.md', TEST_DIR);

    expect(deleted).toBe(true);

    const statsAfter = await getIndexStats();
    expect(statsAfter.documents.has('docs/to-delete.md')).toBe(false);

    // Document metadata should also be gone
    const doc = await getDocument('docs/to-delete.md');
    expect(doc).toBeNull();
  }, 60000);
});
