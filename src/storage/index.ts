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
import { count, create, insert, insertMultiple, remove, search } from '@orama/orama';
import { persist, restore } from '@orama/plugin-data-persistence';
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
let dbInitPromise: Promise<Orama<typeof SCHEMA>> | null = null;

// Global mutex for serializing ALL database write operations
// Protects: insertChunk, insertChunks, removeDocument
let dbWriteLock: Promise<void> = Promise.resolve();

/**
 * Acquire exclusive write lock for database modification.
 * All write operations MUST use this to prevent Orama state corruption.
 *
 * @returns Release function to call when operation completes
 */
async function acquireWriteLock(): Promise<() => void> {
  const previousLock = dbWriteLock;
  let releaseLock: () => void;
  dbWriteLock = new Promise((resolve) => {
    releaseLock = resolve;
  });
  await previousLock;
  return releaseLock!;
}

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
 * Uses singleton pattern with promise deduplication to prevent race conditions
 * when multiple callers request initialization simultaneously.
 *
 * @returns Initialized Orama database instance
 *
 * @example
 * ```ts
 * const db = await initIndex();
 * ```
 */
export async function initIndex(): Promise<Orama<typeof SCHEMA>> {
  // Return existing instance
  if (db) return db;

  // If initialization is in progress, wait for it (prevents race condition)
  if (dbInitPromise) return dbInitPromise;

  // Start initialization and store the promise
  dbInitPromise = (async () => {
    const indexPath = getIndexPath();
    const indexDir = getIndexDir();

    // Ensure directory exists
    if (!existsSync(indexDir)) {
      await mkdir(indexDir, { recursive: true });
    }

    // Try to restore existing index
    if (existsSync(indexPath)) {
      try {
        const data = await readFile(indexPath, 'utf-8');
        db = (await restore('json', data)) as Orama<typeof SCHEMA>;
        return db;
      } catch (error) {
        console.warn('Failed to load index, creating new one:', error);
      }
    }

    // Create new index if no existing data
    db = await create({ schema: SCHEMA });
    return db;
  })();

  return dbInitPromise;
}

/**
 * Save the index to disk.
 *
 * Waits for all pending write operations to complete before persisting.
 * Persists current index state to `.dseek/index/orama.json`.
 */
export async function saveIndex(): Promise<void> {
  if (!db) return;

  // Wait for any pending write operations to complete
  await dbWriteLock;

  const indexPath = getIndexPath();
  const data = await persist(db, 'json');
  await writeFile(indexPath, data as string);
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
 * Insert a single chunk into the index with mutex protection.
 *
 * @param chunk - Chunk with text, embedding, and metadata
 */
export async function insertChunk(chunk: Chunk): Promise<void> {
  const release = await acquireWriteLock();
  try {
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
  } finally {
    release();
  }
}

/**
 * Insert multiple chunks into the index with mutex protection.
 *
 * Uses a lock to serialize concurrent insert calls, preventing
 * Orama state corruption from parallel modifications.
 *
 * @param chunks - Array of chunks to insert
 */
export async function insertChunks(chunks: Chunk[]): Promise<void> {
  if (chunks.length === 0) return;

  const release = await acquireWriteLock();
  try {
    const database = await getDb();

    const docs: ChunkDocument[] = chunks.map((chunk) => ({
      doc_id: chunk.doc_id,
      chunk_id: chunk.chunk_id,
      text: chunk.text,
      snippet: chunk.snippet,
      line_start: chunk.line_start,
      line_end: chunk.line_end,
      page_start: chunk.page_start ?? 0,
      page_end: chunk.page_end ?? 0,
      embedding: chunk.embedding ?? [],
    }));

    await insertMultiple(database, docs, LIMITS.EMBEDDING_BATCH_SIZE);
  } finally {
    release();
  }
}

/**
 * Remove all chunks for a document with mutex protection.
 *
 * @param docId - Document identifier (relative path)
 * @returns Number of chunks removed
 */
export async function removeDocument(docId: string): Promise<number> {
  const release = await acquireWriteLock();
  try {
    const database = await getDb();
    let totalRemoved = 0;

    // Loop until all chunks are removed (handles >1000 chunks)
    // Note: Orama's where clause doesn't do exact match, so we filter manually
    while (true) {
      const results = (await search(database, {
        term: '',
        limit: LIMITS.MAX_CHUNKS_PER_SEARCH,
      })) as Results<ChunkDocument>;

      // Filter for exact doc_id match (Orama where clause is broken for strings)
      const matchingHits = results.hits.filter((hit) => hit.document.doc_id === docId);

      if (matchingHits.length === 0) break;

      for (const hit of matchingHits) {
        await remove(database, hit.id);
        totalRemoved++;
      }
    }

    return totalRemoved;
  } finally {
    release();
  }
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
  const release = await acquireWriteLock();
  try {
    db = await create({ schema: SCHEMA });
    dbInitPromise = null; // Clear init promise so fresh initialization can occur
  } finally {
    release();
  }
}
