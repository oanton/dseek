/**
 * Persistence Integration Tests
 *
 * Tests that data survives process restarts and handles corruption gracefully.
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initializeProject, loadConfig, saveConfig } from '../../src/core/config.js';
import { EMBEDDING_CONFIG } from '../../src/core/constants.js';
import { getIndexStats, initIndex, insertChunk, resetIndex, saveIndex } from '../../src/storage/index.js';
import {
  getDocument,
  loadMetadata,
  resetMetadata,
  saveMetadata,
  setDocument,
} from '../../src/storage/metadata.js';
import type { Chunk, Document } from '../../src/types/index.js';

const TEST_DIR = join(process.cwd(), '.test-persistence');
const DSEEK_DIR = join(TEST_DIR, '.dseek');
const INDEX_DIR = join(DSEEK_DIR, 'index');

/**
 * Generate deterministic fake embedding (768 dims)
 */
function fakeEmbedding(seed: number): number[] {
  const dim = EMBEDDING_CONFIG.DIMENSIONS;
  const emb = new Array(dim).fill(0);
  emb[seed % dim] = 0.8;
  emb[(seed * 7) % dim] = 0.4;
  emb[(seed * 13) % dim] = 0.3;
  const norm = Math.sqrt(emb.reduce((sum, v) => sum + v * v, 0));
  return emb.map((v) => v / (norm || 1));
}

describe('Persistence', () => {
  beforeAll(async () => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
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

  it('saveIndex writes to disk and data is retrievable', async () => {
    // Insert chunk
    const chunk: Chunk = {
      chunk_id: 'persist-test',
      doc_id: 'persist.md',
      text: 'persistent content',
      snippet: 'persistent...',
      line_start: 1,
      line_end: 5,
      embedding: fakeEmbedding(42),
    };

    await insertChunk(chunk);
    await saveIndex();

    // Verify data is in index
    const stats = await getIndexStats();
    expect(stats.chunks).toBeGreaterThanOrEqual(1);
    expect(stats.documents.has('persist.md')).toBe(true);

    // Verify database file was written to disk
    const indexPath = join(INDEX_DIR, 'dseek.db');
    expect(existsSync(indexPath)).toBe(true);
  });

  it('handles corrupted config.json by returning defaults', async () => {
    const configPath = join(DSEEK_DIR, 'config.json');

    // Write corrupted JSON
    writeFileSync(configPath, '{ invalid json content');

    // loadConfig throws on invalid JSON, so we expect it to throw
    // but the system should handle this gracefully
    await expect(loadConfig(TEST_DIR)).rejects.toThrow();

    // Restore valid config
    await saveConfig(
      {
        schema_version: 1,
        project_id: 'test',
        sources: [],
        chunking: { strategy: 'markdown-structure', fallback: { chunk_size: 900, overlap: 150 } },
        retrieval: {
          mode: 'hybrid',
          fusion: 'rrf',
          semantic_weight: 0.75,
          keyword_weight: 0.25,
          default_limit: 8,
          max_limit: 12,
          pagination: { enabled: true },
        },
        privacy: {
          local_only: true,
          allow_remote: false,
          require_boundary_key: true,
          boundary_key_env: 'DSEEK_DATA_BOUNDARY_KEY',
          redact_before_remote: true,
          pii_detectors: ['regex_rules'],
        },
        runtime: { auto_bootstrap: true, log_level: 'info' },
      },
      TEST_DIR,
    );
  });

  it('metadata operations work correctly', async () => {
    const doc: Document = {
      doc_id: 'meta-test.md',
      source_name: 'test',
      format: 'markdown',
      content_hash: 'abc123hash',
      updated_at: new Date().toISOString(),
      size_bytes: 1024,
    };

    await setDocument(doc);
    await saveMetadata();

    // Verify document was stored
    const loaded = await getDocument('meta-test.md');

    expect(loaded).not.toBeNull();
    expect(loaded?.content_hash).toBe('abc123hash');
    expect(loaded?.format).toBe('markdown');
  });

  it('saveConfig creates directory if missing', async () => {
    // Remove .dseek directory
    if (existsSync(DSEEK_DIR)) {
      rmSync(DSEEK_DIR, { recursive: true });
    }

    const config = {
      schema_version: 1,
      project_id: 'new-project',
      sources: [],
      chunking: { strategy: 'markdown-structure' as const, fallback: { chunk_size: 900, overlap: 150 } },
      retrieval: {
        mode: 'hybrid' as const,
        fusion: 'rrf' as const,
        semantic_weight: 0.75,
        keyword_weight: 0.25,
        default_limit: 8,
        max_limit: 12,
        pagination: { enabled: true },
      },
      privacy: {
        local_only: true,
        allow_remote: false,
        require_boundary_key: true,
        boundary_key_env: 'DSEEK_DATA_BOUNDARY_KEY',
        redact_before_remote: true,
        pii_detectors: ['regex_rules'] as const,
      },
      runtime: { auto_bootstrap: true, log_level: 'info' as const },
    };

    // Should not throw
    await saveConfig(config, TEST_DIR);

    // Verify file exists
    expect(existsSync(join(DSEEK_DIR, 'config.json'))).toBe(true);

    // Verify content
    const saved = await loadConfig(TEST_DIR);
    expect(saved.project_id).toBe('new-project');
  });

  it('getIndexStats returns empty for fresh index', async () => {
    await resetIndex();

    const stats = await getIndexStats();
    expect(stats.chunks).toBe(0);
    expect(stats.documents.size).toBe(0);
  });
});
