/**
 * Application constants
 *
 * Centralizes all magic numbers and strings used throughout the application.
 * Import from this module instead of hardcoding values.
 *
 * @module constants
 */

// ============================================================================
// File Limits
// ============================================================================

/** File and result limits */
export const LIMITS = {
  /** Maximum file size for indexing (10MB) */
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,
  /** Maximum search results per query */
  MAX_RESULTS: 12,
  /** Default search results per query */
  DEFAULT_RESULTS: 8,
  /** Default chunk size in characters */
  DEFAULT_CHUNK_SIZE: 900,
  /** Chunk overlap in characters */
  DEFAULT_CHUNK_OVERLAP: 150,
  /** Maximum rerank candidates */
  DEFAULT_RERANK_TOP_K: 20,
  /** Maximum snippet length in characters */
  MAX_SNIPPET_LENGTH: 500,
  /** Batch size for embedding generation */
  EMBEDDING_BATCH_SIZE: 32,
  /** Minimum chunk size for validation */
  MIN_CHUNK_SIZE: 100,
  /** Maximum chunks to fetch for document search */
  MAX_CHUNKS_PER_SEARCH: 1000,
  /** Maximum documents to scan for stats */
  MAX_DOCS_STATS_SCAN: 10000,
  /** Number of files to index in parallel */
  INDEXING_CONCURRENCY: 4,
} as const;

// ============================================================================
// Model Configuration
// ============================================================================

/** Model identifiers */
export const MODELS = {
  /** Embedding model for semantic search (768 dimensions, ~1.2GB, 70+ languages) */
  EMBEDDING: 'onnx-community/gte-multilingual-base',
  /** Cross-encoder model for reranking (15+ languages, 512 tokens) */
  RERANKER: 'cross-encoder/mmarco-mMiniLMv2-L12-H384-v1',
  /** Default LLM for chat command */
  DEFAULT_LLM: 'qwen2.5:7b-instruct',
} as const;

/** Embedding model configuration */
export const EMBEDDING_CONFIG = {
  /** Vector dimensions for gte-multilingual-base */
  DIMENSIONS: 768,
  /** Data type for model inference */
  DTYPE: 'fp32' as const,
  /** Maximum tokens for embedding input (model limit is 512) */
  MAX_TOKENS: 512,
} as const;

// ============================================================================
// Retrieval Configuration
// ============================================================================

/** Retrieval weights for hybrid search */
export const RETRIEVAL_WEIGHTS = {
  /** Semantic (vector) search weight */
  SEMANTIC: 0.75,
  /** Keyword (BM25) search weight */
  KEYWORD: 0.25,
} as const;

/** Score fusion weights for reranking */
export const RERANK_FUSION = {
  /** Weight for original hybrid search score */
  HYBRID_WEIGHT: 0.4,
  /** Weight for cross-encoder rerank score */
  RERANK_WEIGHT: 0.6,
} as const;

// ============================================================================
// Network Configuration
// ============================================================================

/** Network endpoints */
export const NETWORK = {
  /** Default Ollama API URL */
  DEFAULT_OLLAMA_URL: 'http://localhost:11434',
} as const;

// ============================================================================
// Timing Configuration
// ============================================================================

/** Timeouts and intervals in milliseconds */
export const TIMING = {
  /** Model loading poll interval */
  MODEL_POLL_INTERVAL_MS: 100,
  /** File watch debounce delay */
  WATCH_DEBOUNCE_MS: 300,
  /** File watcher poll interval */
  WATCHER_POLL_INTERVAL_MS: 100,
  /** Ollama startup wait time */
  OLLAMA_STARTUP_WAIT_MS: 1000,
  /** Maximum Ollama startup attempts */
  OLLAMA_MAX_STARTUP_ATTEMPTS: 30,
} as const;

// ============================================================================
// Default Configuration Values
// ============================================================================

/** Default configuration values */
export const DEFAULTS = {
  /** Default LLM temperature */
  LLM_TEMPERATURE: 0.7,
  /** Default max tokens for LLM */
  LLM_MAX_TOKENS: 1024,
  /** Default top-k for chat context */
  CHAT_TOP_K: 5,
  /** Reranker max sequence length */
  RERANKER_MAX_LENGTH: 512,
  /** Default similarity threshold for duplicates */
  SIMILARITY_THRESHOLD: 0.9,
  /** Default audit results limit */
  AUDIT_LIMIT: 20,
  /** Snippet preview length in CLI output */
  SNIPPET_PREVIEW_LENGTH: 80,
} as const;

/** Confidence calculation weights */
export const CONFIDENCE = {
  /** Weight for average score in confidence calculation */
  SCORE_WEIGHT: 0.7,
  /** Weight for result count in confidence calculation */
  COUNT_WEIGHT: 0.3,
  /** Normalization divisor for result count */
  COUNT_NORMALIZATION: 10,
} as const;

/** UI formatting constants */
export const UI = {
  /** Separator line width for chat command */
  SEPARATOR_WIDTH: 60,
  /** Separator line width for list command */
  LIST_SEPARATOR_WIDTH: 80,
} as const;

/** Text processing thresholds */
export const TEXT_PROCESSING = {
  /** Minimum ratio for sentence boundary truncation */
  SENTENCE_BOUNDARY_RATIO: 0.6,
  /** Minimum ratio for word boundary truncation */
  WORD_BOUNDARY_RATIO: 0.8,
} as const;

/** Search configuration */
export const SEARCH = {
  /** Minimum similarity threshold for vector search */
  MIN_SIMILARITY: 0.6,
  /** Conflict detection threshold modifier */
  CONFLICT_THRESHOLD_MODIFIER: 0.8,
} as const;

/** Directory names */
export const DIRS = {
  /** Main dseek directory */
  DSEEK: '.dseek',
  /** Search index directory */
  INDEX: 'index',
  /** ML models cache */
  MODELS: 'models',
  /** Runtime files (locks, pids) */
  RUN: 'run',
  /** Log files */
  LOGS: 'logs',
  /** General cache */
  CACHE: 'cache',
} as const;

/** File paths relative to .dseek directory */
export const FILES = {
  /** Main configuration file */
  CONFIG: '.dseek/config.json',
  /** Ignore patterns file */
  IGNORE: '.dseek/ignore',
  /** SQLite database file */
  INDEX: 'dseek.db',
  /** Legacy Orama index (for migration) */
  LEGACY_INDEX: 'orama.json',
  /** Legacy metadata file (for migration) */
  LEGACY_METADATA: 'metadata.json',
  /** Watcher lock file */
  WATCH_LOCK: 'watch.lock',
  /** Watcher PID file */
  WATCH_PID: 'watch.pid',
} as const;

/** SQLite configuration */
export const SQLITE = {
  /** RRF (Reciprocal Rank Fusion) constant k */
  RRF_K: 60,
  /** Busy timeout in milliseconds */
  BUSY_TIMEOUT_MS: 5000,
  /** Cache size in KB (negative value = KB) */
  CACHE_SIZE_KB: 16384,
  /** Schema version for migrations */
  SCHEMA_VERSION: 2,
} as const;

// ============================================================================
// Output Format Configuration
// ============================================================================

/** Text output format for LLM-friendly search results */
export const TEXT_FORMAT = {
  /** Separator between results */
  RESULT_SEPARATOR: '---',
  /** Decimal places for score display */
  SCORE_PRECISION: 2,
} as const;
