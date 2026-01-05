/**
 * Cross-encoder reranker using Transformers.js
 *
 * Provides semantic reranking of search results using a cross-encoder model.
 * Uses singleton pattern for efficient model reuse across operations.
 *
 * @module reranker
 */

import { AutoModelForSequenceClassification, AutoTokenizer } from '@huggingface/transformers';
import { DEFAULTS, MODELS, TIMING } from './constants.js';
import { getModelsDir } from './embedder.js';

// Singleton instance
let rerankerInstance: { model: any; tokenizer: any } | null = null;
let isLoading = false;
let loadError: Error | null = null;

/**
 * Get or initialize the reranker model.
 *
 * Uses singleton pattern - model is loaded once and reused.
 * First call triggers model download if not cached.
 *
 * @returns Initialized model and tokenizer
 * @throws Error if model loading fails
 *
 * @example
 * ```ts
 * const { model, tokenizer } = await getReranker();
 * ```
 */
export async function getReranker(): Promise<{ model: any; tokenizer: any }> {
  // Return existing instance
  if (rerankerInstance) {
    return rerankerInstance;
  }

  // Wait if already loading
  if (isLoading) {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (rerankerInstance) {
          clearInterval(checkInterval);
          resolve(rerankerInstance);
        } else if (loadError) {
          clearInterval(checkInterval);
          reject(loadError);
        }
      }, TIMING.MODEL_POLL_INTERVAL_MS);
    });
  }

  // Load the model
  isLoading = true;

  try {
    console.error(`Loading reranker model: ${MODELS.RERANKER}...`);
    const startTime = Date.now();

    const [model, tokenizer] = await Promise.all([
      AutoModelForSequenceClassification.from_pretrained(MODELS.RERANKER, {
        cache_dir: getModelsDir(),
      }),
      AutoTokenizer.from_pretrained(MODELS.RERANKER, {
        cache_dir: getModelsDir(),
      }),
    ]);

    rerankerInstance = { model, tokenizer };
    const loadTime = Date.now() - startTime;
    console.error(`Reranker loaded in ${loadTime}ms`);

    return rerankerInstance;
  } catch (error) {
    loadError = error instanceof Error ? error : new Error(String(error));
    throw loadError;
  } finally {
    isLoading = false;
  }
}

/**
 * Check if the reranker is initialized
 */
export function isRerankerReady(): boolean {
  return rerankerInstance !== null;
}

/**
 * Rerank documents using cross-encoder model.
 *
 * Cross-encoder scores query-document pairs for relevance,
 * providing more accurate ranking than bi-encoder similarity.
 *
 * @param query - Search query
 * @param documents - Array of documents with id and text
 * @param topK - Optional limit on returned results
 * @returns Ranked documents with cross-encoder scores (0-1)
 *
 * @example
 * ```ts
 * const ranked = await rerank("auth flow", [
 *   { id: "1", text: "Authentication uses JWT tokens..." },
 *   { id: "2", text: "User login process..." }
 * ], 5);
 * ```
 */
export async function rerank(
  query: string,
  documents: Array<{ id: string; text: string }>,
  topK?: number,
): Promise<Array<{ id: string; score: number }>> {
  if (documents.length === 0) {
    return [];
  }

  const { model, tokenizer } = await getReranker();

  // Prepare query-document pairs as separate arrays
  const queries = documents.map(() => query);
  const texts = documents.map((doc) => doc.text);

  // Tokenize pairs - pass as two separate arrays for text pairs
  const inputs = tokenizer(queries, {
    text_pair: texts,
    padding: true,
    truncation: true,
    max_length: DEFAULTS.RERANKER_MAX_LENGTH,
  });

  // Forward pass - cross-encoder outputs logits for each pair
  const output = await model(inputs);

  // Extract scores and apply sigmoid for probability interpretation
  const logits = output.logits.data as Float32Array;
  const scores = Array.from(logits).map((logit) => 1 / (1 + Math.exp(-logit)));

  // Map back to original documents with scores and sort
  const ranked = documents
    .map((doc, idx) => ({
      id: doc.id,
      score: scores[idx],
    }))
    .sort((a, b) => b.score - a.score);

  return topK ? ranked.slice(0, topK) : ranked;
}

/**
 * Get the reranker model name.
 *
 * @returns HuggingFace model identifier
 */
export function getRerankerModelName(): string {
  return MODELS.RERANKER;
}

/**
 * Reset the reranker (for testing)
 */
export function resetReranker(): void {
  rerankerInstance = null;
  isLoading = false;
  loadError = null;
}

/**
 * Bootstrap reranker model (download without using)
 */
export async function bootstrapReranker(): Promise<void> {
  await getReranker();
}
