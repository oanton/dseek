# DSEEK v1 Spec (Local Docs Index + Hybrid Retrieval for Claude Code)

Version: **v1**  
Primary goal: **fast, local-first retrieval of documentation chunks**, so Claude Code (and humans) can answer project questions **without scanning all docs**.

This spec is intentionally implementation-oriented and concise, so an AI agent can build it end-to-end.

---

## 0. Decisions Locked In (from requirements)

- **Index + models live inside the repo**: `.dseek/` (no global cache for v1).
- **Multi-OS support desired**: macOS first, but design and CI should support Linux and Windows.
- Search results must include **both**:
  - **line range** (or page range for PDF/DOCX)
  - **short snippet text**
- Consistency model: **best-effort** (search must work while index updates).
- **Max file size**: 10 MB. Larger files are skipped with a warning.
- Some formats may be **converted to Markdown** during ingestion (PDF/DOCX), to improve chunking and line references.
- User adds **one or more folders explicitly** (no whole-repo indexing by default).
- Code files are **not** indexed in v1 (docs only).
- Retrieval is **hybrid** (semantic + keyword), with **semantic dominant**.
- Default mode: `search` returns **JSON always** (unless explicit `chat` mode).

---

## 1. What We Borrow From Similar Solutions (MCP + CLI)

### 1.1 MCP ragdocs-like (watch mode + indexing status)
Borrow:
- **Watch mode**: automatic re-index on modified files and removal on delete.
- **Async indexing**: avoid blocking interactive search.
- **Indexing status API**: `ready/updating/error`, progress, queue length.

### 1.2 MCP local RAG-like (index lifecycle, hybrid search)
Borrow:
- **Hybrid retrieval** (semantic + keyword boost / BM25).
- **Index lifecycle commands**: ingest/list/delete/status.
- **Re-ingest replaces previous version** of the same file (no duplicates).

### 1.3 CLI rag-cli-like (production behavior + observability)
Borrow:
- **Debounced file watching** (avoid reindexing on every autosave).
- **Observability**: timing metrics, logs, debug mode.

### 1.4 Hybrid retrieval best practice
Borrow:
- **Fusion** of BM25 + semantic results (RRF or weighted merge).
- Optional **rerank** only when confidence is low (v1: optional, config-controlled).

---

## 2. v1 Goals

1. Provide a **single CLI** for:
   - indexing docs from configured folders
   - watching for changes
   - answering queries by returning **top chunks** (JSON)
2. Keep Claude Code interaction **tool-first**:
   - Claude calls `dseek search`, gets chunks, answers from them.
3. Support **multi-folder sources** per project.
4. Ensure **project isolation**: each repo has its own `.dseek/` state.
5. Privacy-by-default: **LOCAL_ONLY**; “remote” must be explicitly enabled and guarded.

---

## 3. v1 Non-goals

- Indexing or reasoning over codebase as a primary source (Swift/Kotlin/Dart).
- Jira/Confluence/Google Drive sync in v1 (but metadata must support it later).
- Full agent orchestration.
- Real-time UI (TUI/GUI/Web) is not required in v1, but the architecture must allow it.

---

## 4. Repo Layout

### 4.1 Committed to repo
- `.dseek/config.json`
- `.dseek/ignore`
- `.claude/skills/dseek/SKILL.md`
- (optional) `.claude/hooks/` config for firewall (no heavy artifacts)

### 4.2 Generated locally (NOT committed)
Add these to `.gitignore`:
- `.dseek/bin/`
- `.dseek/index/`
- `.dseek/models/`
- `.dseek/run/`
- `.dseek/logs/`
- `.dseek/cache/`

---

## 5. Supported Document Formats (v1)

Source files within user-added folders:
- Markdown: `.md`
- Text: `.txt`
- HTML: `.html`, `.htm`
- PDF: `.pdf`
- DOCX: `.docx`

### 5.1 Conversion to Markdown (recommended for PDF/DOCX)
If possible, convert to Markdown for:
- better chunk boundaries
- stable line-based references

For formats that cannot provide stable line ranges:
- return `page_start/page_end` (PDF)
- return `section_index` or synthetic line ranges after conversion

### 5.2 Size limit
- If file size > **10 MB**: skip ingestion, emit warning in logs and status.

---

## 6. Configuration

### 6.1 `.dseek/config.json` (schema v1)
```json
{
  "schema_version": 1,
  "project_id": "auto",
  "sources": [
    {
      "name": "docs",
      "path": "./docs",
      "include": ["**/*.md", "**/*.txt", "**/*.html", "**/*.pdf", "**/*.docx"],
      "exclude": ["**/.git/**", "**/.dseek/**", "**/node_modules/**", "**/build/**"],
      "watch": true
    }
  ],
  "chunking": {
    "strategy": "markdown-structure",
    "fallback": { "chunk_size": 900, "overlap": 150 }
  },
  "retrieval": {
    "mode": "hybrid",
    "fusion": "rrf",
    "semantic_weight": 0.75,
    "keyword_weight": 0.25,
    "default_limit": 8,
    "max_limit": 12,
    "pagination": { "enabled": true }
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

### 6.2 `.dseek/ignore` (custom ignore)
Line-based patterns (gitignore-like). Defaults should include:
- `.git/`
- `.dseek/`
- `node_modules/`
- `build/`
- `.dart_tool/`
- `Pods/`
- `DerivedData/`
- hidden folders by default (optional rule)

**Rule precedence**
1) `exclude` in config
2) `.dseek/ignore`
3) `include` in config

---

## 7. Core Data Model

### 7.1 Document
- `doc_id`: canonical relative path from repo root
- `source_name`
- `format`: md|txt|html|pdf|docx
- `content_hash`: stable hash of raw content (or normalized text for converted formats)
- `updated_at`
- `size_bytes`
- `url`: empty in v1 (reserved for later)
- `source_doc_id`: equals `doc_id` for local sources

### 7.2 Chunk
- `chunk_id`: stable ID based on `doc_id + loc + content_hash_prefix`
- `doc_id`
- `text`: full chunk text
- `snippet`: truncated chunk (max ~900 chars in response)
- Location:
  - text formats: `line_start`, `line_end`
  - pdf: `page_start`, `page_end`
  - docx: `page` if available; else converted md line ranges
- Retrieval fields:
  - `embedding_vector`
  - `bm25_terms` (or stored in BM25 index)

### 7.3 Stable chunking contract
- Prefer Markdown structure chunking (H1/H2 sections + paragraphs).
- Fallback chunking: **900/150** characters.

---

## 8. Ingestion and Indexing

### 8.1 Commands behavior
- Re-ingest for an existing `doc_id` must:
  - delete old chunks for that doc
  - insert updated chunks
  - update BM25 + embeddings
  - update document metadata

### 8.2 Async indexing
- Indexing must run in background where possible.
- CLI calls should return quickly and rely on `status` to show progress.

### 8.3 Index artifacts
Store all index state in `.dseek/index/`:
- vector store (local, file-based)
- BM25 store (local)
- metadata store (doc/chunk tables)

If you choose a local vector DB later (Qdrant/Chroma), it still must persist under `.dseek/index/` for v1.

---

## 9. Watcher (Always-On)

### 9.1 Execution model
- `dseek watch` runs as a daemon per repo:
  - lock file: `.dseek/run/watch.lock`
  - pid file: `.dseek/run/watch.pid`
  - event queue

### 9.2 Events handled
- create -> ingest file
- modify -> re-ingest file
- delete -> delete doc + chunks
- rename -> delete old + ingest new

### 9.3 Debounce and backpressure
- debounce window: 200 to 500 ms
- dedupe events per path
- throttle reindex concurrency (avoid CPU spikes)

### 9.4 Best-effort consistency
- `search` must work even if index is updating.
- `status.index_state` indicates `ready|updating|error`.

---

## 10. Retrieval Pipeline (Hybrid)

### 10.1 Inputs
- `query` (mixed UA/EN)
- optional `filters`:
  - by source name
  - by folder/path prefix
  - later by tags/metadata

### 10.2 Steps
1) Semantic retrieval:
   - embed query
   - topK_semantic
2) Keyword retrieval:
   - BM25 topK_keyword
3) Fusion:
   - RRF (default) or weighted merge
4) Optional rerank:
   - only when confidence low (config flag)
5) Post-filtering:
   - remove near-duplicates
   - enforce max results
6) Produce response snippets + locations

### 10.3 Confidence score
A heuristic scalar 0..1 used to decide:
- whether to suggest `next_cursor`
- whether rerank is needed

### 10.4 Pagination
Return `next_cursor` (opaque token) when more results exist.
Cursor must be deterministic for the same query and index version.

---

## 11. CLI Interface (v1)

### 11.1 Commands
1) `dseek bootstrap`
- Downloads required artifacts from GitHub Releases into:
  - `.dseek/bin/`
  - `.dseek/models/`
- Must use a download lock: `.dseek/run/download.lock`
- Must use atomic rename for completed downloads.

2) `dseek add <path>`
- Adds a source folder (can be called multiple times).
- Triggers initial index build for new/changed sources.
- If source.watch=true, optionally starts watcher (config-driven).

3) `dseek watch`
- Runs watcher daemon for all sources with `watch=true`.

4) `dseek search "<query>" [--limit N] [--cursor X]`
- Always returns JSON.
- Default limit from config; must not exceed `max_limit`.
- Must include line/page ranges and snippets.

5) `dseek chat "<query>"`
- Uses local-only mode.
- Produces a human answer plus list of file links (no long quotes).
- Language must match query language.

6) `dseek status`
- JSON: index state, queue length, doc/chunk counts, last event.

7) `dseek list`
- List indexed docs: path, format, updated_at, size.

8) `dseek delete <path>`
- Removes doc from index (doc + chunks).

9) `dseek audit duplicates [--threshold X]`
- Returns groups of near duplicates and exact duplicates.

10) `dseek audit conflicts [--min-sim X] [--top N]`
- Returns candidate conflicts + short explanation.
- v1 explanation can be heuristic or local LLM-based (config).

11) `dseek search --batch queries.json`
- For regression suites and QA.

---

## 12. JSON Schemas

### 12.1 `search` response
```json
{
  "schema_version": 1,
  "project_id": "…",
  "query": "…",
  "index_state": "ready",
  "confidence": 0.74,
  "results": [
    {
      "chunk_id": "…",
      "path": "docs/auth.md",
      "line_start": 120,
      "line_end": 156,
      "page_start": null,
      "page_end": null,
      "score": 0.81,
      "snippet": "…"
    }
  ],
  "next_cursor": "opaque-or-empty",
  "pii_redacted": false,
  "timing_ms": { "search": 42, "fusion": 3 }
}
```

### 12.2 `status` response
```json
{
  "schema_version": 1,
  "project_id": "…",
  "index_state": "updating",
  "queued_files": 3,
  "documents": 87,
  "chunks": 1432,
  "last_event": { "type": "modify", "path": "docs/auth.md", "at": "…" },
  "warnings": []
}
```

### 12.3 `audit duplicates` response
```json
{
  "schema_version": 1,
  "project_id": "…",
  "type": "duplicates",
  "threshold": 0.92,
  "groups": [
    {
      "group_id": "…",
      "items": [
        { "path": "docs/a.md", "line_start": 10, "line_end": 40, "score": 0.97 },
        { "path": "docs/b.md", "line_start": 12, "line_end": 45, "score": 0.97 }
      ]
    }
  ]
}
```

### 12.4 `audit conflicts` response
```json
{
  "schema_version": 1,
  "project_id": "…",
  "type": "conflicts",
  "min_similarity": 0.80,
  "pairs": [
    {
      "a": { "path": "docs/auth.md", "line_start": 50, "line_end": 80 },
      "b": { "path": "docs/security.md", "line_start": 20, "line_end": 55 },
      "similarity": 0.86,
      "explanation": "One doc states refresh tokens rotate every 24h, another states 7d."
    }
  ]
}
```

---

## 13. Privacy and Remote Guard (Two-Layer, Config-Controlled)

### 13.1 Layer A: DSEEK internal guard
Default:
- `local_only=true`
- `allow_remote=false`

If remote enabled later:
- Require boundary key in env: `DSEEK_DATA_BOUNDARY_KEY`
- Detect PII in snippets before sending anywhere:
  - email, phone, API keys, JWT, tokens, IBAN
- Redact minimal:
  - `user@company.com -> [*]@company.com`
  - `+380501234567 -> [PHONE]`
  - `eyJ... -> [JWT]`

`search` must report `pii_redacted=true/false`.

### 13.2 Layer B: Claude Code hooks firewall (optional)
- Purpose: block high-risk actions globally (reading `.env`, dumping secrets).
- Config toggles should allow enabling/disabling per repo.
- This is “defense-in-depth” only, not the sole security boundary.

---

## 14. Claude Code Skill Contract

### 14.1 Primary rule
For doc questions, Claude must call:
- `dseek search "<question>"`

Claude must NOT:
- scan repo recursively
- run grep across doc folders

### 14.2 Response usage
Claude answers using:
- `snippet` and `path:line_start-line_end` references
If insufficient, Claude may request the next page:
- `dseek search "<question>" --cursor <next_cursor>`

---

## 15. Observability

Minimum required:
- `.dseek/logs/` with rotation
- Timing metrics in JSON responses:
  - indexing time per file
  - search time
  - fusion time
- `dseek status` includes last event and queue length

---

## 16. Test Plan (E2E-Ready)

### 16.1 Testdata layout
`testdata/docs/` with:
- `auth.md` (mentions refresh tokens)
- `limits.md` (rate limits, includes a unique exact term like `ERR_CONNECTION_REFUSED`)
- `ua_en_mix.md` (UA question should match EN section)
- `pii.md` (email, phone, API token examples)

### 16.2 Unit tests
- chunking stability (900/150)
- ignore application
- BM25 exact match for `ERR_CONNECTION_REFUSED`
- semantic retrieval: UA query finds EN content
- fusion deterministic ordering
- cursor pagination correctness
- re-ingest replaces old version
- delete removes all chunks
- PII detection + redaction mapping

### 16.3 Integration tests (CLI only)
1) add + search finds expected chunk
2) watcher modify updates results quickly
3) watcher delete removes results
4) multi-source: add two folders, both searchable
5) repo isolation: two repos, no cross results
6) concurrency: watcher in both repos, no lock collision

### 16.4 Claude Code E2E (minimal)
- skill triggers `dseek search` tool call
- ensure results are JSON and Claude answers without scanning docs
- if firewall enabled, risky access is denied

---

## 17. Roadmap After v1 (not implemented, but enabled by v1 design)

- Add MCP adapter wrapping the same retrieval core.
- Add connectors: Jira/Confluence/Google Drive using `source/source_doc_id/url/updated_at` metadata already present.
- Add UI: TUI or Web “docs-only chat” using the same `search` contract.
- Optional NER-based PII detection as a secondary signal (behind config flag).

---

## 18. Acceptance Criteria (v1)

1) Fresh repo: `dseek add ./docs` + `dseek watch` + `dseek search "..."` works.
2) Updating a doc file is reflected in search without full reindex.
3) Deleting a doc file removes it from results.
4) Search always returns valid JSON with snippet + location.
5) Repo isolation: no mixing across different repos.
6) Files > 10 MB skipped with warning, no crash.
7) Privacy defaults prevent any remote usage unless explicitly enabled.
8) E2E test suite passes on macOS; design supports Linux/Windows.

