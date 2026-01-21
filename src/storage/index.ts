/**
 * SQLite storage and persistence
 *
 * Manages the search index using SQLite + FTS5 + sqlite-vec for hybrid BM25 + vector search.
 * Uses RRF (Reciprocal Rank Fusion) to combine keyword and semantic search results.
 *
 * @module storage
 */

import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import type Database from 'better-sqlite3';
import { LIMITS, RETRIEVAL_WEIGHTS, SEARCH, SQLITE } from '../core/constants.js';
import type { Chunk, SearchResult } from '../types/index.js';
import { closeDb, getDb, getDbPath, getIndexDir, resetDb } from './sqlite.js';

/**
 * Get index directory path
 */
export { getIndexDir };

/**
 * Get index file path (database path)
 */
export function getIndexPath(): string {
  return getDbPath();
}

/**
 * Initialize the search index.
 *
 * Creates database connection and ensures schema is ready.
 * With SQLite, this is lightweight since schema init happens on first getDb() call.
 *
 * @returns Database instance (for compatibility, returns a wrapper)
 *
 * @example
 * ```ts
 * await initIndex();
 * ```
 */
export async function initIndex(): Promise<Database.Database> {
  const indexDir = getIndexDir();

  // Ensure directory exists
  if (!existsSync(indexDir)) {
    await mkdir(indexDir, { recursive: true });
  }

  return getDb();
}

/**
 * Save the index to disk.
 *
 * With SQLite + WAL mode, data is persisted automatically.
 * This function is kept for API compatibility but is a no-op.
 */
export async function saveIndex(): Promise<void> {
  // No-op - SQLite auto-persists with WAL mode
  // Optionally checkpoint WAL file
  const db = getDb();
  db.pragma('wal_checkpoint(PASSIVE)');
}

/**
 * Get the current database instance
 */
export async function getDatabase(): Promise<Database.Database> {
  return getDb();
}

/**
 * Insert a single chunk into the index.
 *
 * @param chunk - Chunk with text, embedding, and metadata
 */
export async function insertChunk(chunk: Chunk): Promise<void> {
  const db = getDb();

  const insertChunkStmt = db.prepare(`
    INSERT INTO chunks (chunk_id, doc_id, text, snippet, line_start, line_end, page_start, page_end)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertVecStmt = db.prepare(`
    INSERT INTO chunks_vec (chunk_rowid, embedding) VALUES (?, ?)
  `);

  const result = insertChunkStmt.run(
    chunk.chunk_id,
    chunk.doc_id,
    chunk.text,
    chunk.snippet,
    chunk.line_start,
    chunk.line_end,
    chunk.page_start ?? null,
    chunk.page_end ?? null,
  );

  if (chunk.embedding && chunk.embedding.length > 0) {
    // sqlite-vec requires BigInt for rowid and Float32Array for embedding
    insertVecStmt.run(BigInt(result.lastInsertRowid), new Float32Array(chunk.embedding));
  }
}

/**
 * Insert multiple chunks into the index.
 *
 * Uses a transaction for atomic insertion of all chunks.
 *
 * @param chunks - Array of chunks to insert
 */
export async function insertChunks(chunks: Chunk[]): Promise<void> {
  if (chunks.length === 0) return;

  const db = getDb();

  const insertChunkStmt = db.prepare(`
    INSERT INTO chunks (chunk_id, doc_id, text, snippet, line_start, line_end, page_start, page_end)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertVecStmt = db.prepare(`
    INSERT INTO chunks_vec (chunk_rowid, embedding) VALUES (?, ?)
  `);

  const transaction = db.transaction((chunks: Chunk[]) => {
    for (const chunk of chunks) {
      const result = insertChunkStmt.run(
        chunk.chunk_id,
        chunk.doc_id,
        chunk.text,
        chunk.snippet,
        chunk.line_start,
        chunk.line_end,
        chunk.page_start ?? null,
        chunk.page_end ?? null,
      );

      if (chunk.embedding && chunk.embedding.length > 0) {
        // sqlite-vec requires BigInt for rowid and Float32Array for embedding
        insertVecStmt.run(BigInt(result.lastInsertRowid), new Float32Array(chunk.embedding));
      }
    }
  });

  transaction(chunks);
}

/**
 * Remove all chunks for a document.
 *
 * @param docId - Document identifier (relative path)
 * @returns Number of chunks removed
 */
export async function removeDocument(docId: string): Promise<number> {
  const db = getDb();

  // Get chunk IDs for vector deletion
  const chunks = db.prepare('SELECT id FROM chunks WHERE doc_id = ?').all(docId) as { id: number }[];

  if (chunks.length === 0) return 0;

  const deleteVecStmt = db.prepare('DELETE FROM chunks_vec WHERE chunk_rowid = ?');
  const deleteChunkStmt = db.prepare('DELETE FROM chunks WHERE doc_id = ?');

  const transaction = db.transaction(() => {
    // Delete from vec table first
    for (const chunk of chunks) {
      deleteVecStmt.run(chunk.id);
    }

    // Delete from main table (FTS5 auto-synced via trigger)
    const result = deleteChunkStmt.run(docId);
    return result.changes;
  });

  return transaction();
}

/**
 * Search the index using hybrid BM25 + vector mode with RRF fusion.
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
  const db = getDb();

  const {
    limit = LIMITS.DEFAULT_RESULTS,
    offset = 0,
    semanticWeight = RETRIEVAL_WEIGHTS.SEMANTIC,
    keywordWeight = RETRIEVAL_WEIGHTS.KEYWORD,
  } = options;

  const k = SQLITE.RRF_K;
  // Fetch consistent number of candidates for RRF merging to ensure stable pagination
  // Use a minimum of 50 candidates to ensure ranking stability across pages
  const fetchLimit = Math.max(limit + offset, 50) * 2;

  // Prepare the RRF hybrid search query
  // This combines FTS5 BM25 results with vector similarity using RRF
  const hybridQuery = db.prepare(`
    WITH vec_matches AS (
      SELECT chunk_rowid,
        row_number() OVER (ORDER BY distance) as rank_num,
        distance
      FROM chunks_vec
      WHERE embedding MATCH ?
        AND k = ?
    ),
    fts_matches AS (
      SELECT rowid,
        row_number() OVER (ORDER BY rank) as rank_num
      FROM chunks_fts
      WHERE chunks_fts MATCH ?
      LIMIT ?
    ),
    combined AS (
      SELECT f.rowid as id, f.rank_num as fts_rank, v.rank_num as vec_rank
      FROM fts_matches f
      LEFT JOIN vec_matches v ON f.rowid = v.chunk_rowid
      UNION ALL
      SELECT v.chunk_rowid, NULL, v.rank_num
      FROM vec_matches v
      WHERE NOT EXISTS (SELECT 1 FROM fts_matches f WHERE f.rowid = v.chunk_rowid)
    )
    SELECT
      c.chunk_id, c.doc_id, c.snippet, c.line_start, c.line_end,
      c.page_start, c.page_end,
      (
        COALESCE(1.0 / (? + combined.fts_rank), 0.0) * ? +
        COALESCE(1.0 / (? + combined.vec_rank), 0.0) * ?
      ) as score
    FROM combined
    JOIN chunks c ON c.id = combined.id
    ORDER BY score DESC
    LIMIT ? OFFSET ?
  `);

  // Query for total count (approximation based on each search type)
  const countFtsQuery = db.prepare(`
    SELECT COUNT(*) as count FROM chunks_fts WHERE chunks_fts MATCH ?
  `);

  let results: SearchResult[] = [];
  let total = 0;

  // Handle empty query (vector-only search)
  if (!query.trim()) {
    // Vector-only search
    const vecOnlyQuery = db.prepare(`
      SELECT
        c.chunk_id, c.doc_id, c.snippet, c.line_start, c.line_end,
        c.page_start, c.page_end,
        (1.0 - v.distance) as score
      FROM chunks_vec v
      JOIN chunks c ON c.id = v.chunk_rowid
      WHERE v.embedding MATCH ?
        AND v.k = ?
      ORDER BY v.distance
      LIMIT ? OFFSET ?
    `);

    const embeddingBuffer = new Float32Array(embedding);
    const vecResults = vecOnlyQuery.all(embeddingBuffer, fetchLimit, limit, offset) as Array<{
      chunk_id: string;
      doc_id: string;
      snippet: string;
      line_start: number;
      line_end: number;
      page_start: number | null;
      page_end: number | null;
      score: number;
    }>;

    results = vecResults
      .filter((r) => r.score >= SEARCH.MIN_SIMILARITY)
      .map((r) => ({
        chunk_id: r.chunk_id,
        path: r.doc_id,
        line_start: r.line_start,
        line_end: r.line_end,
        page_start: r.page_start,
        page_end: r.page_end,
        score: r.score,
        snippet: r.snippet,
      }));

    // Get approximate total
    const countResult = db.prepare('SELECT COUNT(*) as count FROM chunks').get() as { count: number };
    total = countResult.count;
  } else {
    // Hybrid search with RRF
    try {
      const embeddingBuffer = new Float32Array(embedding);

      // Escape special FTS5 characters in query
      const ftsQuery = escapeFtsQuery(query);

      const hybridResults = hybridQuery.all(
        embeddingBuffer,
        fetchLimit,
        ftsQuery,
        fetchLimit,
        k,
        keywordWeight,
        k,
        semanticWeight,
        limit,
        offset,
      ) as Array<{
        chunk_id: string;
        doc_id: string;
        snippet: string;
        line_start: number;
        line_end: number;
        page_start: number | null;
        page_end: number | null;
        score: number;
      }>;

      results = hybridResults.map((r) => ({
        chunk_id: r.chunk_id,
        path: r.doc_id,
        line_start: r.line_start,
        line_end: r.line_end,
        page_start: r.page_start,
        page_end: r.page_end,
        score: r.score,
        snippet: r.snippet,
      }));

      // Get FTS match count as approximation
      const countResult = countFtsQuery.get(ftsQuery) as { count: number };
      total = countResult.count;
    } catch (error) {
      // Fallback to vector-only if FTS query fails (e.g., invalid syntax)
      console.warn('FTS query failed, falling back to vector-only search:', error);

      const vecOnlyQuery = db.prepare(`
        SELECT
          c.chunk_id, c.doc_id, c.snippet, c.line_start, c.line_end,
          c.page_start, c.page_end,
          (1.0 - v.distance) as score
        FROM chunks_vec v
        JOIN chunks c ON c.id = v.chunk_rowid
        WHERE v.embedding MATCH ?
          AND v.k = ?
        ORDER BY v.distance
        LIMIT ? OFFSET ?
      `);

      const embeddingBuffer = new Float32Array(embedding);
      const vecResults = vecOnlyQuery.all(embeddingBuffer, fetchLimit, limit, offset) as Array<{
        chunk_id: string;
        doc_id: string;
        snippet: string;
        line_start: number;
        line_end: number;
        page_start: number | null;
        page_end: number | null;
        score: number;
      }>;

      results = vecResults
        .filter((r) => r.score >= SEARCH.MIN_SIMILARITY)
        .map((r) => ({
          chunk_id: r.chunk_id,
          path: r.doc_id,
          line_start: r.line_start,
          line_end: r.line_end,
          page_start: r.page_start,
          page_end: r.page_end,
          score: r.score,
          snippet: r.snippet,
        }));

      total = results.length;
    }
  }

  return {
    results,
    total,
  };
}

/**
 * Escape special FTS5 query characters.
 *
 * @param query - Raw query string
 * @returns Escaped query safe for FTS5
 */
function escapeFtsQuery(query: string): string {
  // Escape special FTS5 operators: " - * OR AND NOT NEAR
  // Wrap terms in quotes if they contain special characters
  return query
    .replace(/"/g, '""') // Escape quotes
    .split(/\s+/)
    .filter((term) => term.length > 0)
    .map((term) => {
      // If term contains special chars, quote it
      if (/[^\w\u0400-\u04FF\u4e00-\u9fff]/.test(term)) {
        return `"${term}"`;
      }
      return term;
    })
    .join(' ');
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
  const db = getDb();

  const chunkCount = db.prepare('SELECT COUNT(*) as count FROM chunks').get() as { count: number };
  const docIds = db.prepare('SELECT DISTINCT doc_id FROM chunks').all() as { doc_id: string }[];

  return {
    chunks: chunkCount.count,
    documents: new Set(docIds.map((d) => d.doc_id)),
  };
}

/**
 * Check if a document exists in the index.
 *
 * @param docId - Document identifier to check
 * @returns True if document has indexed chunks
 */
export async function documentExists(docId: string): Promise<boolean> {
  const db = getDb();
  const result = db.prepare('SELECT 1 FROM chunks WHERE doc_id = ? LIMIT 1').get(docId);
  return result !== undefined;
}

/**
 * Reset the index (for testing).
 *
 * Clears all data from chunks, vectors, and related tables.
 */
export async function resetIndex(): Promise<void> {
  const db = getDb();

  db.exec(`
    DELETE FROM chunks_vec;
    DELETE FROM chunks;
    DELETE FROM documents;
    DELETE FROM index_events;
  `);
}

/**
 * Close the database connection.
 */
export { closeDb };
