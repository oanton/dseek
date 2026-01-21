/**
 * Retrieval module - hybrid search wrapper
 *
 * Provides hybrid search combining semantic (vector) and keyword (BM25) search
 * with optional cross-encoder reranking for improved relevance.
 *
 * @module retrieval
 */

import { createHash } from 'node:crypto';
import { redactPII } from '../privacy/pii.js';
import { getIndexStats, searchIndex } from '../storage/index.js';
import { getDocumentCount, getIndexVersion, getLastEvent } from '../storage/metadata.js';
import type { CursorData, IndexStatus, SearchQuery, SearchResponse, SearchResult } from '../types/index.js';
import { loadConfig } from './config.js';
import { CONFIDENCE, DEFAULTS, LIMITS, RERANK_FUSION } from './constants.js';
import { embed } from './embedder.js';
import { rerank } from './reranker.js';

/**
 * Encode cursor data
 */
function encodeCursor(data: CursorData): string {
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

/**
 * Decode cursor data
 */
function decodeCursor(cursor: string): CursorData | null {
  try {
    const json = Buffer.from(cursor, 'base64').toString('utf-8');
    return JSON.parse(json) as CursorData;
  } catch {
    return null;
  }
}

/**
 * Generate query hash for cursor
 */
function hashQuery(query: string): string {
  return createHash('sha256').update(query).digest('hex').substring(0, 16);
}

/**
 * Calculate confidence score from results
 */
function calculateConfidence(results: SearchResult[], total: number): number {
  if (results.length === 0) return 0;

  // Average score of top results
  const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;

  // Normalize to 0-1 range
  const normalizedScore = Math.min(avgScore, 1);

  // Adjust by result count
  const countFactor = Math.min(total / CONFIDENCE.COUNT_NORMALIZATION, 1);

  return Number((normalizedScore * CONFIDENCE.SCORE_WEIGHT + countFactor * CONFIDENCE.COUNT_WEIGHT).toFixed(2));
}

/**
 * Perform hybrid search across indexed documents.
 *
 * Combines semantic (vector) and keyword (BM25) search with configurable weights.
 * Supports optional cross-encoder reranking for improved relevance.
 *
 * @param query - Search query options
 * @returns Search response with ranked results and metadata
 *
 * @example
 * ```ts
 * const results = await search({
 *   query: "authentication flow",
 *   limit: 10,
 *   rerank: true,
 * });
 * ```
 */
export async function search(query: SearchQuery): Promise<SearchResponse> {
  const startTime = Date.now();
  const config = await loadConfig();

  const limit = Math.min(query.limit ?? config.retrieval.default_limit, config.retrieval.max_limit);

  // Decode cursor if provided
  let offset = 0;
  if (query.cursor) {
    const cursorData = decodeCursor(query.cursor);
    if (cursorData && cursorData.query_hash === hashQuery(query.query)) {
      offset = cursorData.offset;
    }
  }

  // Generate query embedding
  const queryEmbedding = await embed(query.query);

  // Search - no candidate expansion for reranking (score fusion preserves hybrid signal)
  const searchLimit = limit;
  const { results: rawResults, total } = await searchIndex(query.query, queryEmbedding, {
    limit: searchLimit,
    offset,
    semanticWeight: config.retrieval.semantic_weight,
    keywordWeight: config.retrieval.keyword_weight,
    filters: query.filters,
  });

  const searchTime = Date.now() - startTime;

  // Rerank if requested
  let results = rawResults;
  let rerankingTime: number | undefined;

  if (query.rerank && rawResults.length > 0) {
    const rerankStart = Date.now();
    try {
      const rerankInput = rawResults.map((r) => ({
        id: r.chunk_id,
        text: r.snippet,
      }));

      const reranked = await rerank(query.query, rerankInput);
      const scoreMap = new Map(reranked.map((r) => [r.id, r.score]));

      // Score fusion: combine hybrid and rerank scores instead of replacement
      // Note: no MIN_RERANK_SCORE filtering - fusion already handles low rerank scores
      // (high hybrid + low rerank = moderate fused score)
      results = rawResults
        .filter((r) => scoreMap.has(r.chunk_id))
        .map((r) => {
          const rerankScore = scoreMap.get(r.chunk_id) ?? 0;
          const hybridScore = r.score;
          return {
            ...r,
            score: hybridScore * RERANK_FUSION.HYBRID_WEIGHT + rerankScore * RERANK_FUSION.RERANK_WEIGHT,
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      rerankingTime = Date.now() - rerankStart;
    } catch (error) {
      console.error('Reranking failed, using original results:', error);
      results = rawResults.slice(0, limit);
    }
  }

  // Generate next cursor if more results exist
  let nextCursor: string | null = null;
  if (offset + results.length < total && config.retrieval.pagination.enabled) {
    const cursorData: CursorData = {
      query_hash: hashQuery(query.query),
      offset: offset + limit,
      index_version: await getIndexVersion(),
    };
    nextCursor = encodeCursor(cursorData);
  }

  // Redact PII from snippets
  let piiRedacted = false;
  const redactedResults = results.map((r) => {
    const redaction = redactPII(r.snippet);
    if (redaction.redacted) piiRedacted = true;
    return { ...r, snippet: redaction.text };
  });

  return {
    schema_version: 1,
    project_id: config.project_id,
    query: query.query,
    index_state: 'ready',
    confidence: calculateConfidence(results, total),
    results: redactedResults,
    next_cursor: nextCursor,
    pii_redacted: piiRedacted,
    timing_ms: {
      search: searchTime,
      reranking: rerankingTime,
    },
  };
}

/**
 * Get current index status and statistics.
 *
 * @returns Index status including document count, chunk count, and last event
 *
 * @example
 * ```ts
 * const status = await getStatus();
 * console.log(`Indexed ${status.documents} documents`);
 * ```
 */
export async function getStatus(): Promise<IndexStatus> {
  const config = await loadConfig();
  const stats = await getIndexStats();
  const lastEvent = await getLastEvent();
  const documentCount = await getDocumentCount();

  return {
    schema_version: 1,
    project_id: config.project_id,
    index_state: 'ready',
    queued_files: 0,
    documents: documentCount,
    chunks: stats.chunks,
    last_event: lastEvent,
    warnings: [],
  };
}

/**
 * Find chunks similar to a given embedding vector.
 *
 * Used for duplicate detection and content similarity analysis.
 *
 * @param embedding - Reference embedding vector (384 dimensions)
 * @param threshold - Minimum similarity score (0-1), defaults to 0.9
 * @param limit - Maximum results to return, defaults to 20
 * @returns Array of similar chunks above threshold
 *
 * @example
 * ```ts
 * const embedding = await embed("sample text");
 * const duplicates = await findSimilar(embedding, 0.95);
 * ```
 */
export async function findSimilar(
  embedding: number[],
  threshold: number = DEFAULTS.SIMILARITY_THRESHOLD,
  limit: number = DEFAULTS.AUDIT_LIMIT,
): Promise<SearchResult[]> {
  const { results } = await searchIndex('', embedding, {
    limit,
    semanticWeight: 1.0,
    keywordWeight: 0,
  });

  return results.filter((r) => r.score >= threshold);
}

// Export pure functions for testing
export { encodeCursor, decodeCursor, hashQuery, calculateConfidence };
