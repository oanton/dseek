# Configuration Reference

DSEEK configuration is stored in `.dseek/config.json`. This document describes all available options.

## Table of Contents

- [Schema Version](#schema-version)
- [Project ID](#project-id)
- [Sources](#sources)
- [Chunking](#chunking)
- [Retrieval](#retrieval)
- [Privacy](#privacy)
- [Runtime](#runtime)

---

## Schema Version

```json
"schema_version": 1
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| schema_version | `1` | Yes | Configuration schema version. Currently only `1` is supported. |

---

## Project ID

```json
"project_id": "auto"
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| project_id | `string` | `"auto"` | Unique identifier for the project. Use `"auto"` to generate from directory name. |

---

## Sources

An array of documentation sources to index.

```json
"sources": [
  {
    "name": "docs",
    "path": "./docs",
    "include": ["**/*.md"],
    "exclude": ["**/drafts/**"],
    "watch": true
  }
]
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| name | `string` | *(folder name)* | Human-readable name for the source. Used in search filters. |
| path | `string` | **required** | Path to the folder. Relative paths are resolved from project root. |
| include | `string[]` | `["**/*.md", "**/*.txt", "**/*.html", "**/*.pdf", "**/*.docx"]` | Glob patterns for files to include. |
| exclude | `string[]` | `[]` | Glob patterns for files to exclude. Takes precedence over include. |
| watch | `boolean` | `true` | Automatically re-index when files change. |

### Supported File Formats

| Extension | Format | Notes |
|-----------|--------|-------|
| `.md` | Markdown | Structure-aware chunking by headers |
| `.txt` | Plain text | Fallback chunking by size |
| `.html` | HTML | Converted to text, structure-aware chunking |
| `.pdf` | PDF | Extracted text, page references preserved |
| `.docx` | Word | Extracted text, converted to markdown |

### Path Resolution

- **Relative paths** (e.g., `./docs`, `docs`) are resolved from the project root (where `.dseek/` is located)
- **Absolute paths** (e.g., `/home/user/shared-docs`) are used as-is
- Paths within the project are stored as relative; external paths are stored as absolute

---

## Chunking

Controls how documents are split into searchable chunks.

```json
"chunking": {
  "strategy": "markdown-structure",
  "fallback": {
    "chunk_size": 900,
    "overlap": 150
  }
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| strategy | `"markdown-structure"` \| `"fallback"` | `"markdown-structure"` | Primary chunking strategy. |
| fallback.chunk_size | `number` | `900` | Maximum characters per chunk when using fallback strategy. |
| fallback.overlap | `number` | `150` | Character overlap between consecutive chunks. |

### Strategies

| Strategy | Description | Best For |
|----------|-------------|----------|
| `markdown-structure` | Splits by headers (H1, H2, etc.) preserving document structure. | Markdown, HTML |
| `fallback` | Splits by character count with overlap. | Plain text, unstructured content |

---

## Retrieval

Controls search behavior and result ranking.

```json
"retrieval": {
  "mode": "hybrid",
  "fusion": "rrf",
  "semantic_weight": 0.75,
  "keyword_weight": 0.25,
  "default_limit": 8,
  "max_limit": 12,
  "pagination": {
    "enabled": true
  }
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| mode | `"hybrid"` \| `"semantic"` \| `"keyword"` | `"hybrid"` | Search mode. |
| fusion | `"rrf"` \| `"weighted"` | `"rrf"` | Result fusion algorithm for hybrid mode. |
| semantic_weight | `number` | `0.75` | Weight for semantic (vector) results (0-1). |
| keyword_weight | `number` | `0.25` | Weight for keyword (BM25) results (0-1). |
| default_limit | `number` | `8` | Default number of results returned. |
| max_limit | `number` | `12` | Maximum allowed results per query. |
| pagination.enabled | `boolean` | `true` | Enable cursor-based pagination. |

### Search Modes

| Mode | Description | When to Use |
|------|-------------|-------------|
| `hybrid` | Combines semantic and keyword search. Best overall accuracy. | **Recommended for most cases** |
| `semantic` | Vector similarity only. Finds conceptually similar content. | When exact keywords don't matter |
| `keyword` | BM25 text matching only. Fast, exact keyword matching. | When searching for specific terms |

### Fusion Algorithms

| Algorithm | Description |
|-----------|-------------|
| `rrf` | Reciprocal Rank Fusion. Combines rankings without requiring score normalization. **Recommended.** |
| `weighted` | Weighted sum of normalized scores using `semantic_weight` and `keyword_weight`. |

### Reranking

The `--rerank` flag enables cross-encoder reranking for improved result quality at the cost of additional latency.

```bash
# Search with reranking
dseek search "authentication" --rerank

# Chat with reranked context
dseek chat "how does auth work?" --rerank

# Control number of candidates to rerank
dseek search "query" --rerank --rerank-top-k 30
```

| Option | Default | Description |
|--------|---------|-------------|
| `--rerank` | `false` | Enable cross-encoder reranking |
| `--rerank-top-k` | `20` | Number of candidates to rerank |

**Model:** `Xenova/ms-marco-MiniLM-L-6-v2` (~80MB)

To pre-download the reranker model:
```bash
dseek bootstrap --reranker
# or download all models
dseek bootstrap --all
```

### Chat Options

The `chat` command supports additional options for controlling output format.

```bash
# Chat with citations (default)
dseek chat "What is DSEEK?"
# Output: DSEEK is a local-first search tool [1: docs/PRD.md:3-6]

# Chat without citations (clean output)
dseek chat "What is DSEEK?" --no-cite
# Output: DSEEK is a local-first search tool
```

| Option | Default | Description |
|--------|---------|-------------|
| `--no-cite` | `false` | Disable source citations in response |
| `--show-context` | `false` | Show retrieved context chunks |
| `--show-prompt` | `false` | Show the prompt sent to LLM |

---

## Privacy

Controls data protection and PII handling.

```json
"privacy": {
  "local_only": true,
  "allow_remote": false,
  "require_boundary_key": true,
  "boundary_key_env": "DSEEK_DATA_BOUNDARY_KEY",
  "redact_before_remote": true,
  "pii_detectors": ["regex_rules"]
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| local_only | `boolean` | `true` | Restrict all operations to local machine. |
| allow_remote | `boolean` | `false` | Allow sending data to remote services. |
| require_boundary_key | `boolean` | `true` | Require environment key before remote operations. |
| boundary_key_env | `string` | `"DSEEK_DATA_BOUNDARY_KEY"` | Environment variable name for boundary key. |
| redact_before_remote | `boolean` | `true` | Automatically redact PII before remote calls. |
| pii_detectors | `string[]` | `["regex_rules"]` | PII detection methods to use. |

### PII Detection

When `redact_before_remote` is enabled, the following PII types are detected and redacted:

| Type | Pattern | Redacted As |
|------|---------|-------------|
| Email | `user@example.com` | `[EMAIL]` |
| Phone | `+1-555-123-4567` | `[PHONE]` |
| JWT | `eyJ...` | `[JWT]` |
| AWS Key | `AKIA...` | `[AWS_KEY]` |
| Credit Card | `4111-1111-1111-1111` | `[CREDIT_CARD]` |
| IP Address | `192.168.1.1` | `[IP_ADDRESS]` |

---

## Runtime

Controls CLI behavior and logging.

```json
"runtime": {
  "auto_bootstrap": true,
  "log_level": "info",
  "ollama_model": "qwen2.5:7b-instruct",
  "ollama_url": "http://localhost:11434"
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| auto_bootstrap | `boolean` | `true` | Automatically download embedding model on first use. |
| log_level | `"debug"` \| `"info"` \| `"warn"` \| `"error"` | `"info"` | Minimum log level to output. |
| ollama_model | `string` | `"qwen2.5:7b-instruct"` | Ollama model for `chat` command. |
| ollama_url | `string` | `"http://localhost:11434"` | Ollama API endpoint URL. |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `OLLAMA_HOST` | Overrides `ollama_url` config. Standard Ollama environment variable. |

**Priority:** `OLLAMA_HOST` env > `runtime.ollama_url` config > default (`http://localhost:11434`)

### Log Levels

| Level | Description |
|-------|-------------|
| `debug` | Verbose output for debugging. Shows all operations. |
| `info` | Normal operation messages. Shows indexing progress, search results. |
| `warn` | Warnings only. Shows skipped files, configuration issues. |
| `error` | Errors only. Shows failures that prevent operations. |

---

## Complete Example

```json
{
  "schema_version": 1,
  "project_id": "my-project",
  "sources": [
    {
      "name": "documentation",
      "path": "./docs",
      "include": ["**/*.md", "**/*.txt"],
      "exclude": ["**/drafts/**", "**/archive/**"],
      "watch": true
    },
    {
      "name": "api-specs",
      "path": "./api",
      "include": ["**/*.yaml", "**/*.json"],
      "exclude": [],
      "watch": true
    }
  ],
  "chunking": {
    "strategy": "markdown-structure",
    "fallback": {
      "chunk_size": 900,
      "overlap": 150
    }
  },
  "retrieval": {
    "mode": "hybrid",
    "fusion": "rrf",
    "semantic_weight": 0.75,
    "keyword_weight": 0.25,
    "default_limit": 8,
    "max_limit": 12,
    "pagination": {
      "enabled": true
    }
  },
  "privacy": {
    "local_only": true,
    "allow_remote": false,
    "require_boundary_key": true,
    "boundary_key_env": "DSEEK_DATA_BOUNDARY_KEY",
    "redact_before_remote": true,
    "pii_detectors": ["regex_rules"]
  },
  "runtime": {
    "auto_bootstrap": true,
    "log_level": "info"
  }
}
```

---

## See Also

- [README](../README.md) - Quick start guide
- [Specification](spec.md) - Full technical specification
