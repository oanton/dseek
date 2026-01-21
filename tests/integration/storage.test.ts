/**
 * Storage (Orama) integration tests
 *
 * Uses mock embeddings for speed and determinism.
 * Tests core CRUD operations without requiring the actual ML model.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { EMBEDDING_CONFIG } from '../../src/core/constants.js';
import {
  getIndexStats,
  insertChunk,
  insertChunks,
  removeDocument,
  resetIndex,
  searchIndex,
} from '../../src/storage/index.js';
import type { Chunk } from '../../src/types/index.js';

/**
 * Generate deterministic fake embedding (768 dims)
 * Uses one-hot style for predictable similarity comparisons
 */
function fakeEmbedding(seed: number): number[] {
  const dim = EMBEDDING_CONFIG.DIMENSIONS;
  const emb = new Array(dim).fill(0);
  // Set a few positions based on seed for some structure
  emb[seed % dim] = 0.8;
  emb[(seed * 7) % dim] = 0.4;
  emb[(seed * 13) % dim] = 0.3;
  // Normalize
  const norm = Math.sqrt(emb.reduce((sum, v) => sum + v * v, 0));
  return emb.map((v) => v / (norm || 1));
}

/**
 * Create a test chunk with defaults
 */
function createChunk(overrides: Partial<Chunk> & { chunk_id: string; doc_id: string }): Chunk {
  return {
    text: 'default text',
    snippet: 'default...',
    line_start: 1,
    line_end: 10,
    embedding: fakeEmbedding(1),
    ...overrides,
  };
}

describe('Storage', () => {
  beforeEach(async () => {
    await resetIndex();
  });

  it('inserts and searches chunks', async () => {
    const chunk = createChunk({
      chunk_id: 'c1',
      doc_id: 'auth.md',
      text: 'authentication refresh tokens oauth flow',
      snippet: 'authentication refresh tokens...',
      embedding: fakeEmbedding(42),
    });

    await insertChunk(chunk);

    const { results, total } = await searchIndex('authentication', fakeEmbedding(42));

    expect(total).toBeGreaterThanOrEqual(1);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe('auth.md');
    expect(results[0].chunk_id).toBe('c1');
    expect(results[0].snippet).toContain('authentication');
  });

  it('removes chunks for a document', async () => {
    // Insert chunks
    await insertChunks([
      createChunk({
        chunk_id: 'remove-test-1',
        doc_id: 'removable.md',
        text: 'content to be removed',
        embedding: fakeEmbedding(100),
      }),
      createChunk({
        chunk_id: 'remove-test-2',
        doc_id: 'removable.md',
        text: 'more content to remove',
        embedding: fakeEmbedding(101),
      }),
    ]);

    // Verify inserted
    let stats = await getIndexStats();
    const initialChunks = stats.chunks;
    expect(initialChunks).toBeGreaterThanOrEqual(2);

    // Remove document
    const removed = await removeDocument('removable.md');

    // Verify something was removed
    expect(removed).toBeGreaterThan(0);

    // Verify chunk count decreased
    stats = await getIndexStats();
    expect(stats.chunks).toBeLessThan(initialChunks);
  });

  it('returns empty results for empty index', async () => {
    const { results, total } = await searchIndex('anything', fakeEmbedding(1));

    expect(results).toHaveLength(0);
    expect(total).toBe(0);
  });

  it('respects limit and offset for pagination', async () => {
    // Insert 10 chunks
    const chunks = Array.from({ length: 10 }, (_, i) =>
      createChunk({
        chunk_id: `chunk-${i}`,
        doc_id: `doc-${i}.md`,
        text: `content number ${i} searchable`,
        snippet: `content ${i}...`,
        embedding: fakeEmbedding(i),
      }),
    );
    await insertChunks(chunks);

    // Get first page
    const page1 = await searchIndex('content', fakeEmbedding(0), {
      limit: 3,
      offset: 0,
    });

    // Get second page
    const page2 = await searchIndex('content', fakeEmbedding(0), {
      limit: 3,
      offset: 3,
    });

    expect(page1.results).toHaveLength(3);
    expect(page2.results).toHaveLength(3);

    // Pages should not overlap
    const ids1 = new Set(page1.results.map((r) => r.chunk_id));
    const ids2 = new Set(page2.results.map((r) => r.chunk_id));

    for (const id of ids2) {
      expect(ids1.has(id)).toBe(false);
    }
  });

  it('getIndexStats returns correct counts', async () => {
    await insertChunks([
      createChunk({ chunk_id: 'a1', doc_id: 'a.md', embedding: fakeEmbedding(1) }),
      createChunk({ chunk_id: 'a2', doc_id: 'a.md', embedding: fakeEmbedding(2) }),
      createChunk({ chunk_id: 'a3', doc_id: 'a.md', embedding: fakeEmbedding(3) }),
      createChunk({ chunk_id: 'b1', doc_id: 'b.md', embedding: fakeEmbedding(4) }),
    ]);

    const stats = await getIndexStats();

    expect(stats.chunks).toBe(4);
    expect(stats.documents.size).toBe(2);
    expect(stats.documents.has('a.md')).toBe(true);
    expect(stats.documents.has('b.md')).toBe(true);
  });
});
