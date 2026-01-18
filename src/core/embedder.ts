/**
 * Embeddings pipeline using Transformers.js
 *
 * Provides semantic embedding generation using gte-multilingual-base model.
 * Uses singleton pattern for efficient model reuse across operations.
 *
 * @module embedder
 */

import { join } from 'node:path';
import { AutoTokenizer, type FeatureExtractionPipeline, type PreTrainedTokenizer, pipeline } from '@huggingface/transformers';
import { getDseekDir } from './config.js';
import { DIRS, EMBEDDING_CONFIG, LIMITS, MODELS, TIMING } from './constants.js';

// Singleton instances
let embedderInstance: FeatureExtractionPipeline | null = null;
let tokenizerInstance: PreTrainedTokenizer | null = null;
let isLoading = false;
let loadError: Error | null = null;

/**
 * Get the models cache directory
 */
export function getModelsDir(): string {
  return join(getDseekDir(), DIRS.MODELS);
}

/**
 * Get or initialize the tokenizer for text truncation.
 *
 * Uses same model as embedder to ensure consistent tokenization.
 *
 * @returns Initialized tokenizer
 */
async function getTokenizer(): Promise<PreTrainedTokenizer> {
  if (!tokenizerInstance) {
    tokenizerInstance = await AutoTokenizer.from_pretrained(MODELS.EMBEDDING, {
      cache_dir: getModelsDir(),
    });
  }
  return tokenizerInstance;
}

/**
 * Truncate text to fit within token limit.
 *
 * Uses the model's tokenizer to properly truncate text at token boundaries.
 * This ensures text doesn't exceed the embedding model's context window.
 *
 * @param text - Input text to truncate
 * @param maxTokens - Maximum number of tokens
 * @returns Truncated text
 */
async function truncateText(text: string, maxTokens: number): Promise<string> {
  // Handle empty input
  if (!text || !text.trim()) {
    return text;
  }

  const tokenizer = await getTokenizer();
  const encoded = tokenizer(text, {
    truncation: true,
    max_length: maxTokens,
  });

  // Handle empty token IDs (return original text as fallback)
  const tokenIdsData = encoded.input_ids.data;
  if (!tokenIdsData || tokenIdsData.length === 0) {
    return text;
  }

  // Convert typed array (BigInt64Array) to regular array of integers
  // The decode function expects an array of integers, not BigInts
  const tokenIds = Array.from(tokenIdsData, (x) => Number(x));
  if (tokenIds.length === 0) {
    return text;
  }

  // Decode back to text without special tokens
  return tokenizer.decode(tokenIds, { skip_special_tokens: true });
}

/**
 * Get or initialize the embedding pipeline.
 *
 * Uses singleton pattern - model is loaded once and reused.
 * First call triggers model download (~1.2GB) if not cached.
 *
 * @returns Initialized feature extraction pipeline
 * @throws Error if model loading fails
 *
 * @example
 * ```ts
 * const embedder = await getEmbedder();
 * const result = await embedder("hello world", { pooling: "mean" });
 * ```
 */
export async function getEmbedder(): Promise<FeatureExtractionPipeline> {
  // Return existing instance
  if (embedderInstance) {
    return embedderInstance;
  }

  // Wait if already loading
  if (isLoading) {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (embedderInstance) {
          clearInterval(checkInterval);
          resolve(embedderInstance);
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
    console.error(`Loading embedding model: ${MODELS.EMBEDDING}...`);
    const startTime = Date.now();

    // @ts-expect-error - Pipeline returns complex union type that's too complex for TS
    embedderInstance = await pipeline('feature-extraction', MODELS.EMBEDDING, {
      cache_dir: getModelsDir(),
      dtype: EMBEDDING_CONFIG.DTYPE,
    });

    const loadTime = Date.now() - startTime;
    console.error(`Model loaded in ${loadTime}ms`);

    return embedderInstance;
  } catch (error) {
    loadError = error instanceof Error ? error : new Error(String(error));
    throw loadError;
  } finally {
    isLoading = false;
  }
}

/**
 * Check if the embedder is initialized
 */
export function isEmbedderReady(): boolean {
  return embedderInstance !== null;
}

/**
 * Generate embedding for a single text.
 *
 * Uses mean pooling with L2 normalization for semantic similarity.
 *
 * @param text - Input text to embed
 * @returns 768-dimensional embedding vector
 * @throws Error if embedding dimension doesn't match expected
 *
 * @example
 * ```ts
 * const embedding = await embed("How to authenticate users?");
 * console.log(embedding.length); // 768
 * ```
 */
export async function embed(text: string): Promise<number[]> {
  const embedder = await getEmbedder();

  // Truncate text to fit model's token limit
  const truncatedText = await truncateText(text, EMBEDDING_CONFIG.MAX_TOKENS);

  const result = await embedder(truncatedText, {
    pooling: 'mean',
    normalize: true,
  });

  // Convert to array
  const embedding = Array.from(result.data as Float32Array);

  if (embedding.length !== EMBEDDING_CONFIG.DIMENSIONS) {
    throw new Error(`Unexpected embedding dimension: ${embedding.length}, expected ${EMBEDDING_CONFIG.DIMENSIONS}`);
  }

  return embedding;
}

/**
 * Generate embeddings for multiple texts in batches.
 *
 * Processes texts in batches of 32 to avoid memory issues.
 *
 * @param texts - Array of texts to embed
 * @returns Array of 768-dimensional embedding vectors
 *
 * @example
 * ```ts
 * const embeddings = await embedBatch(["text1", "text2", "text3"]);
 * console.log(embeddings.length); // 3
 * ```
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const embedder = await getEmbedder();
  const embeddings: number[][] = [];

  // Process in batches to avoid memory issues
  for (let i = 0; i < texts.length; i += LIMITS.EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + LIMITS.EMBEDDING_BATCH_SIZE);

    const results = await Promise.all(
      batch.map(async (text) => {
        // Truncate text to fit model's token limit
        const truncatedText = await truncateText(text, EMBEDDING_CONFIG.MAX_TOKENS);
        const result = await embedder(truncatedText, {
          pooling: 'mean',
          normalize: true,
        });
        return Array.from(result.data as Float32Array);
      }),
    );

    embeddings.push(...results);
  }

  return embeddings;
}

/**
 * Calculate cosine similarity between two embedding vectors.
 *
 * @param a - First embedding vector
 * @param b - Second embedding vector
 * @returns Similarity score between -1 and 1 (1 = identical)
 * @throws Error if vectors have different dimensions
 *
 * @example
 * ```ts
 * const similarity = cosineSimilarity(embedding1, embedding2);
 * if (similarity > 0.9) console.log("Very similar!");
 * ```
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have the same dimension');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

/**
 * Get embedding vector dimensions.
 *
 * @returns Number of dimensions in embedding vectors (768 for gte-multilingual-base)
 */
export function getEmbeddingDim(): number {
  return EMBEDDING_CONFIG.DIMENSIONS;
}

/**
 * Get the embedding model name.
 *
 * @returns HuggingFace model identifier
 */
export function getModelName(): string {
  return MODELS.EMBEDDING;
}

/**
 * Reset the embedder and tokenizer (for testing)
 */
export function resetEmbedder(): void {
  embedderInstance = null;
  tokenizerInstance = null;
  isLoading = false;
  loadError = null;
}
