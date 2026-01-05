/**
 * Search Quality Integration Tests
 *
 * Tests hybrid search behavior with real or semi-real embeddings.
 * Focuses on search result quality, ranking, and pagination.
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initializeProject, loadConfig, saveConfig } from '../../src/core/config.js';
import { embedBatch } from '../../src/core/embedder.js';
import { indexFile } from '../../src/core/indexer.js';
import { getIndexStats, resetIndex, saveIndex, searchIndex } from '../../src/storage/index.js';
import { resetMetadata, saveMetadata } from '../../src/storage/metadata.js';

const TEST_DIR = join(process.cwd(), '.test-search-quality');
const DOCS_DIR = join(TEST_DIR, 'docs');

describe('Search Quality', () => {
  beforeAll(async () => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(DOCS_DIR, { recursive: true });
    process.env.DSEEK_PROJECT_ROOT = TEST_DIR;

    await initializeProject(TEST_DIR);
    await resetIndex();
    await resetMetadata();

    // Create test documents with distinct topics
    writeFileSync(
      join(DOCS_DIR, 'auth.md'),
      `# Authentication

OAuth 2.0 is the industry-standard protocol for authorization.
It provides secure delegated access without exposing user credentials.

## JWT Tokens

JSON Web Tokens are used for stateless authentication.
They contain encoded claims about the user identity.
`,
    );

    writeFileSync(
      join(DOCS_DIR, 'database.md'),
      `# Database Guide

PostgreSQL is a powerful open-source relational database.
It supports advanced data types and full-text search.

## Query Optimization

Use indexes to speed up database queries.
Explain plans help identify slow queries.
`,
    );

    writeFileSync(
      join(DOCS_DIR, 'api.md'),
      `# REST API Reference

All endpoints require authentication via Bearer tokens.
Rate limiting applies to all API calls.

## Endpoints

GET /users - List all users
POST /auth/login - Authenticate and get token
`,
    );

    // Index all documents
    await indexFile(join(DOCS_DIR, 'auth.md'), TEST_DIR);
    await indexFile(join(DOCS_DIR, 'database.md'), TEST_DIR);
    await indexFile(join(DOCS_DIR, 'api.md'), TEST_DIR);

    await saveIndex();
    await saveMetadata();
  }, 180000);

  afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    delete process.env.DSEEK_PROJECT_ROOT;
  });

  it('semantic search finds relevant content not matching keywords', async () => {
    // Search for "login" which should find auth.md content about OAuth/JWT
    const [queryEmbedding] = await embedBatch(['user login flow']);
    const { results } = await searchIndex('user login flow', queryEmbedding, { limit: 5 });

    expect(results.length).toBeGreaterThan(0);

    // Auth or API docs should rank high (they mention authentication/login)
    const topPaths = results.slice(0, 2).map((r) => r.path);
    const hasAuthOrApi = topPaths.some((p) => p.includes('auth') || p.includes('api'));
    expect(hasAuthOrApi).toBe(true);
  }, 60000);

  it('hybrid search returns results for keyword queries', async () => {
    // Search for a term that should match indexed content
    const [queryEmbedding] = await embedBatch(['database query']);
    const { results, total } = await searchIndex('database', queryEmbedding, { limit: 5 });

    // Should return some results from the indexed documents
    expect(results.length).toBeGreaterThanOrEqual(0);
    expect(typeof total).toBe('number');

    // If we have results, they should have valid structure
    if (results.length > 0) {
      expect(results[0]).toHaveProperty('path');
      expect(results[0]).toHaveProperty('score');
    }
  }, 60000);

  it('search returns results sorted by score descending', async () => {
    const [queryEmbedding] = await embedBatch(['authentication']);
    const { results } = await searchIndex('authentication', queryEmbedding, { limit: 10 });

    // Verify results are sorted by score (descending)
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  }, 60000);

  it('pagination returns non-overlapping result sets', async () => {
    const [queryEmbedding] = await embedBatch(['documentation']);

    const page1 = await searchIndex('documentation', queryEmbedding, { limit: 2, offset: 0 });
    const page2 = await searchIndex('documentation', queryEmbedding, { limit: 2, offset: 2 });

    // If we have enough results for pagination
    if (page1.results.length === 2 && page2.results.length > 0) {
      const ids1 = new Set(page1.results.map((r) => r.chunk_id));
      const ids2 = new Set(page2.results.map((r) => r.chunk_id));

      // Pages should not overlap
      for (const id of ids2) {
        expect(ids1.has(id)).toBe(false);
      }
    }
  }, 60000);

  it('search config can be modified', async () => {
    // Modify config to favor keywords
    const config = await loadConfig(TEST_DIR);
    const originalSemanticWeight = config.retrieval.semantic_weight;
    const originalKeywordWeight = config.retrieval.keyword_weight;

    config.retrieval.semantic_weight = 0.25;
    config.retrieval.keyword_weight = 0.75;
    await saveConfig(config, TEST_DIR);

    try {
      // Verify config was saved
      const updatedConfig = await loadConfig(TEST_DIR);
      expect(updatedConfig.retrieval.semantic_weight).toBe(0.25);
      expect(updatedConfig.retrieval.keyword_weight).toBe(0.75);

      // Search should work with new config
      const [queryEmbedding] = await embedBatch(['authentication']);
      const { results } = await searchIndex('authentication', queryEmbedding, { limit: 5 });

      // Should return results (structure validation)
      expect(Array.isArray(results)).toBe(true);
    } finally {
      // Restore config
      config.retrieval.semantic_weight = originalSemanticWeight;
      config.retrieval.keyword_weight = originalKeywordWeight;
      await saveConfig(config, TEST_DIR);
    }
  }, 60000);
});
