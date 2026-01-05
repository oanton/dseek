# DSEEK Software Design Document

## System Overview

DSEEK is a CLI-based documentation search system using hybrid retrieval (semantic embeddings + BM25 keyword matching).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLI Layer                             │
│  bootstrap │ add │ watch │ search │ chat │ status │ ...     │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                       Core Layer                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│  │ Indexer │ │ Chunker │ │Embedder │ │Retrieval│            │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘            │
└───────┼───────────┼───────────┼───────────┼─────────────────┘
        │           │           │           │
┌───────▼───────────▼───────────▼───────────▼─────────────────┐
│                     Storage Layer                            │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │   Orama Index    │  │  Metadata Store  │                 │
│  │ (vectors + BM25) │  │     (JSON)       │                 │
│  └──────────────────┘  └──────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
                          │
                  .dseek/ directory
```

## Component Design

### Indexer (`core/indexer.ts`)
Orchestrates document processing pipeline:
```
file → Parser → Chunker → Embedder → Storage
```

### Chunker (`core/chunker.ts`)
Two strategies:
1. **Markdown-structure**: Split by H1/H2 headers
2. **Fallback**: 900 chars, 150 overlap

Output: `{ text, line_start, line_end, content_hash }`

### Embedder (`core/embedder.ts`)
Singleton wrapper for Transformers.js:
- Model: `Xenova/multilingual-e5-small` (384 dims)
- Lazy initialization on first use
- Cached in `.dseek/models/`

### Retrieval (`core/retrieval.ts`)
Orama hybrid search:
```typescript
search(db, {
  mode: 'hybrid',
  term: query,
  vector: { value: embedding, property: 'embedding' },
  hybridWeights: { text: 0.25, vector: 0.75 }
})
```

### Watcher (`core/watcher.ts`)
Chokidar-based file watching:
- Debounce: 300ms
- Events: add → ingest, change → re-ingest, unlink → delete
- Daemon with lock file

## Data Models

### Document
```typescript
interface Document {
  doc_id: string;       // relative path from repo root
  source_name: string;
  format: 'md' | 'txt' | 'html' | 'pdf' | 'docx';
  content_hash: string;
  updated_at: string;
  size_bytes: number;
}
```

### Chunk
```typescript
interface Chunk {
  chunk_id: string;     // doc_id:line_range:hash_prefix
  doc_id: string;
  text: string;
  snippet: string;      // truncated for response
  line_start: number;
  line_end: number;
  page_start?: number;  // for PDF
  page_end?: number;
  embedding: number[];  // 384 dims
}
```

### SearchResult
```typescript
interface SearchResult {
  chunk_id: string;
  path: string;
  line_start: number;
  line_end: number;
  score: number;
  snippet: string;
}
```

## Storage

All state in `.dseek/`:
```
.dseek/
├── config.json       # User config (committed)
├── ignore            # Ignore patterns (committed)
├── index/            # Orama persistence (gitignored)
├── models/           # Embedding models (gitignored)
├── run/              # PID files, locks (gitignored)
└── logs/             # Log files (gitignored)
```

## API Specifications

### Search Response
```json
{
  "schema_version": 1,
  "query": "authentication",
  "index_state": "ready",
  "confidence": 0.74,
  "results": [...],
  "next_cursor": "base64...",
  "timing_ms": { "search": 42 }
}
```

### Status Response
```json
{
  "index_state": "ready|updating|error",
  "documents": 87,
  "chunks": 1432,
  "queued_files": 0
}
```

## Security

- **Local-only** by default
- **PII detection**: email, phone, JWT patterns
- **Boundary key** required for any remote operations
- No credentials stored in index

## Error Handling

- File > 10MB: skip with warning
- Parse failure: skip file, log error
- Embedding failure: retry 3x, then skip
- Index corruption: rebuild on next add

## Performance

| Operation | Target |
|-----------|--------|
| Search | < 100ms |
| Index single file | < 500ms |
| Model load (cold) | < 5s |
| Watcher debounce | 300ms |

## Technology Stack

| Component | Library |
|-----------|---------|
| Runtime | Node.js + tsx |
| Search | Orama |
| Embeddings | Transformers.js |
| File watch | Chokidar |
| CLI | Commander |
| PDF | pdf-parse |
| DOCX | mammoth |
