/**
 * Orama storage and persistence
 *
 * Manages the search index using Orama for hybrid BM25 + vector search.
 * Handles index creation, persistence, and CRUD operations.
 *
 * @module storage
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Orama, Results } from '@orama/orama';
import { count, create, insert, load, remove, save, search } from '@orama/orama';
import { getDseekDir } from '../core/config.js';
import { DIRS, FILES, LIMITS, RETRIEVAL_WEIGHTS, SEARCH } from '../core/constants.js';
import { getEmbeddingDim } from '../core/embedder.js';
import type { Chunk, SearchResult } from '../types/index.js';

// Orama schema for chunks
const SCHEMA = {
  doc_id: 'string',
  chunk_id: 'string',
  text: 'string',
  snippet: 'string',
  line_start: 'number',
  line_end: 'number',
  page_start: 'number',
  page_end: 'number',
  embedding: `vector[${getEmbeddingDim()}]`,
} as const;

type ChunkDocument = {
  doc_id: string;
  chunk_id: string;
  text: string;
  snippet: string;
  line_start: number;
  line_end: number;
  page_start: number;
  page_end: number;
  embedding: number[];
};

let db: Orama<typeof SCHEMA> | null = null;

/**
 * Get index directory path
 */
export function getIndexDir(): string {
  return join(getDseekDir(), DIRS.INDEX);
}

/**
 * Get index file path
 */
export function getIndexPath(): string {
  return join(getIndexDir(), FILES.INDEX);
}

/**
 * Initialize or load the search index.
 *
 * Creates new index or loads existing from disk.
 * Uses singleton pattern - subsequent calls return cached instance.
 *
 * @returns Initialized Orama database instance
 *
 * @example
 * ```ts
 * const db = await initIndex();
 * ```
 */
export async function initIndex(): Promise<Orama<typeof SCHEMA>> {
  if (db) return db;

  const indexPath = getIndexPath();
  const indexDir = getIndexDir();

  // Ensure directory exists
  if (!existsSync(indexDir)) {
    await mkdir(indexDir, { recursive: true });
  }

  // Create new index first
  db = await create({ schema: SCHEMA });

  // Try to load existing data into it
  if (existsSync(indexPath)) {
    try {
      const data = await readFile(indexPath, 'utf-8');
      load(db, JSON.parse(data));
      return db;
    } catch (error) {
      console.warn('Failed to load index, creating new one:', error);
      // Reset db since load may have partially modified it
      db = await create({ schema: SCHEMA });
    }
  }
  return db;
}

/**
 * Save the index to disk.
 *
 * Persists current index state to `.dseek/index/orama.json`.
 */
export async function saveIndex(): Promise<void> {
  if (!db) return;

  const indexPath = getIndexPath();
  const data = await save(db);
  await writeFile(indexPath, JSON.stringify(data));
}

/**
 * Get the current database instance
 */
export async function getDb(): Promise<Orama<typeof SCHEMA>> {
  if (!db) {
    db = await initIndex();
  }
  return db;
}

/**
 * Insert a single chunk into the index.
 *
 * @param chunk - Chunk with text, embedding, and metadata
 */
export async function insertChunk(chunk: Chunk): Promise<void> {
  const database = await getDb();

  const doc: ChunkDocument = {
    doc_id: chunk.doc_id,
    chunk_id: chunk.chunk_id,
    text: chunk.text,
    snippet: chunk.snippet,
    line_start: chunk.line_start,
    line_end: chunk.line_end,
    page_start: chunk.page_start ?? 0,
    page_end: chunk.page_end ?? 0,
    embedding: chunk.embedding ?? [],
  };

  await insert(database, doc);
}

/**
 * Insert multiple chunks into the index.
 *
 * @param chunks - Array of chunks to insert
 */
export async function insertChunks(chunks: Chunk[]): Promise<void> {
  for (const chunk of chunks) {
    await insertChunk(chunk);
  }
}

/**
 * Remove all chunks for a document.
 *
 * @param docId - Document identifier (relative path)
 * @returns Number of chunks removed
 */
export async function removeDocument(docId: string): Promise<number> {
  const database = await getDb();

  // Find all chunks for this document
  const results = await search(database, {
    term: docId,
    properties: ['doc_id'],
    limit: LIMITS.MAX_CHUNKS_PER_SEARCH,
  });

  let removed = 0;
  for (const hit of results.hits) {
    await remove(database, hit.id);
    removed++;
  }

  return removed;
}

/**
 * Search the index using hybrid BM25 + vector mode.
 *
 * @param query - Search query text
 * @param embedding - Query embedding vector (768 dimensions)
 * @param options - Search options (limit, offset, weights)
 * @returns Search results with scores and total count
 *
 * @example
 * ```ts
 * const { results, total } = await searchIndex("auth", queryEmbedding, {
 *   limit: 10,
 *   semanticWeight: 0.75
 * });
 * ```
 */
export async function searchIndex(
  query: string,
  embedding: number[],
  options: {
    limit?: number;
    offset?: number;
    semanticWeight?: number;
    keywordWeight?: number;
  } = {},
): Promise<{ results: SearchResult[]; total: number }> {
  const database = await getDb();

  const {
    limit = LIMITS.DEFAULT_RESULTS,
    offset = 0,
    semanticWeight = RETRIEVAL_WEIGHTS.SEMANTIC,
    keywordWeight = RETRIEVAL_WEIGHTS.KEYWORD,
  } = options;

  const results = (await search(database, {
    mode: 'hybrid',
    term: query,
    vector: {
      value: embedding,
      property: 'embedding',
    },
    hybridWeights: {
      text: keywordWeight,
      vector: semanticWeight,
    },
    limit: limit + offset,
    similarity: SEARCH.MIN_SIMILARITY,
  })) as Results<ChunkDocument>;

  // Apply offset
  const hits = results.hits.slice(offset, offset + limit);

  const searchResults: SearchResult[] = hits.map((hit) => ({
    chunk_id: hit.document.chunk_id,
    path: hit.document.doc_id,
    line_start: hit.document.line_start,
    line_end: hit.document.line_end,
    page_start: hit.document.page_start || null,
    page_end: hit.document.page_end || null,
    score: hit.score,
    snippet: hit.document.snippet,
  }));

  return {
    results: searchResults,
    total: results.count,
  };
}

/**
 * Get index statistics.
 *
 * @returns Object with chunk count and unique document set
 */
export async function getIndexStats(): Promise<{
  chunks: number;
  documents: Set<string>;
}> {
  const database = await getDb();
  const totalChunks = await count(database);

  // Get unique documents
  const results = (await search(database, {
    term: '',
    limit: LIMITS.MAX_DOCS_STATS_SCAN,
  })) as Results<ChunkDocument>;

  const documents = new Set<string>();
  for (const hit of results.hits) {
    documents.add(hit.document.doc_id);
  }

  return {
    chunks: totalChunks,
    documents,
  };
}

/**
 * Check if a document exists in the index.
 *
 * @param docId - Document identifier to check
 * @returns True if document has indexed chunks
 */
export async function documentExists(docId: string): Promise<boolean> {
  const database = await getDb();

  const results = await search(database, {
    term: docId,
    properties: ['doc_id'],
    limit: 1,
  });

  return results.count > 0;
}

/**
 * Reset the index (for testing)
 */
export async function resetIndex(): Promise<void> {
  db = await create({ schema: SCHEMA });
}
