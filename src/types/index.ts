/**
 * DSEEK Core Types
 */

// ============================================================================
// Configuration Types
// ============================================================================

export interface DseekConfig {
  schema_version: 1;
  project_id: string;
  sources: Source[];
  chunking: ChunkingConfig;
  retrieval: RetrievalConfig;
  privacy: PrivacyConfig;
  runtime: RuntimeConfig;
}

export interface Source {
  name: string;
  path: string;
  include: string[];
  exclude: string[];
  watch: boolean;
}

export interface ChunkingConfig {
  strategy: 'markdown-structure' | 'fallback';
  fallback: {
    chunk_size: number;
    overlap: number;
  };
}

export interface RetrievalConfig {
  mode: 'hybrid' | 'semantic' | 'keyword';
  fusion: 'rrf' | 'weighted';
  semantic_weight: number;
  keyword_weight: number;
  default_limit: number;
  max_limit: number;
  pagination: {
    enabled: boolean;
  };
}

export interface PrivacyConfig {
  local_only: boolean;
  allow_remote: boolean;
  require_boundary_key: boolean;
  boundary_key_env: string;
  redact_before_remote: boolean;
  pii_detectors: string[];
}

export interface RuntimeConfig {
  auto_bootstrap: boolean;
  log_level: 'debug' | 'info' | 'warn' | 'error';
  ollama_model?: string;
  ollama_url?: string;
}

// ============================================================================
// Document Types
// ============================================================================

export type DocumentFormat = 'md' | 'txt' | 'html' | 'pdf' | 'docx';

export interface Document {
  doc_id: string;
  source_name: string;
  format: DocumentFormat;
  content_hash: string;
  updated_at: string;
  size_bytes: number;
  url?: string;
  source_doc_id?: string;
}

export interface ParsedDocument {
  content: string;
  metadata: {
    lines?: number;
    pages?: number;
  };
}

// ============================================================================
// Chunk Types
// ============================================================================

export interface Chunk {
  chunk_id: string;
  doc_id: string;
  text: string;
  snippet: string;
  line_start: number;
  line_end: number;
  page_start?: number;
  page_end?: number;
  embedding?: number[];
}

export interface ChunkLocation {
  line_start: number;
  line_end: number;
  page_start?: number;
  page_end?: number;
}

// ============================================================================
// Search Types
// ============================================================================

export interface SearchQuery {
  query: string;
  limit?: number;
  cursor?: string;
  filters?: SearchFilters;
  rerank?: boolean;
  rerank_top_k?: number;
}

export interface SearchFilters {
  source_name?: string;
  path_prefix?: string;
}

export interface SearchResult {
  chunk_id: string;
  path: string;
  line_start: number;
  line_end: number;
  page_start: number | null;
  page_end: number | null;
  score: number;
  snippet: string;
}

export interface SearchResponse {
  schema_version: 1;
  project_id: string;
  query: string;
  index_state: IndexState;
  confidence: number;
  results: SearchResult[];
  next_cursor: string | null;
  pii_redacted: boolean;
  timing_ms: {
    search: number;
    fusion?: number;
    reranking?: number;
  };
}

// ============================================================================
// Index Types
// ============================================================================

export type IndexState = 'ready' | 'updating' | 'error';

export interface IndexStatus {
  schema_version: 1;
  project_id: string;
  index_state: IndexState;
  queued_files: number;
  documents: number;
  chunks: number;
  last_event: IndexEvent | null;
  warnings: string[];
}

export interface IndexEvent {
  type: 'add' | 'modify' | 'delete';
  path: string;
  at: string;
}

// ============================================================================
// Audit Types
// ============================================================================

export interface DuplicateGroup {
  group_id: string;
  items: DuplicateItem[];
}

export interface DuplicateItem {
  path: string;
  line_start: number;
  line_end: number;
  score: number;
}

export interface DuplicatesResponse {
  schema_version: 1;
  project_id: string;
  type: 'duplicates';
  threshold: number;
  groups: DuplicateGroup[];
}

export interface ConflictPair {
  a: ChunkLocation & { path: string };
  b: ChunkLocation & { path: string };
  similarity: number;
  explanation: string;
}

export interface ConflictsResponse {
  schema_version: 1;
  project_id: string;
  type: 'conflicts';
  min_similarity: number;
  pairs: ConflictPair[];
}

// ============================================================================
// Cursor Types
// ============================================================================

export interface CursorData {
  query_hash: string;
  offset: number;
  index_version: string;
}

// ============================================================================
// PII Types
// ============================================================================

export interface PIIMatch {
  type: 'email' | 'phone' | 'jwt' | 'api_key' | 'iban';
  value: string;
  start: number;
  end: number;
}

export interface RedactedText {
  text: string;
  redacted: boolean;
  matches: PIIMatch[];
}
