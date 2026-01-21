---
name: dseek
description: Search local documentation using hybrid retrieval (semantic + keyword). Use when user asks about project docs, specs, guides, or needs to find information in markdown/pdf/docx files.
allowed-tools: Bash(dseek:*)
---

# DSEEK - Local Documentation Search

Fast, local-first retrieval of documentation chunks with hybrid search (semantic + BM25).

## When to Use

- User asks questions about project documentation
- Need to find specific information in docs folder
- Searching for API references, specs, or guides
- Looking for code examples or configuration details

## Prerequisites

Ensure DSEEK is initialized in the project:
```bash
dseek status
```

If not initialized, run:
```bash
dseek add ./docs
```

## Commands

### Search (Primary)
```bash
dseek search "<query>" [--limit N] [--cursor X]
```
Returns ranked chunks in text format with file paths, line ranges, scores, and snippets.

Example output:
```
# Query: "authentication flow"
# Confidence: 0.85 | Results: 3 | Index: ready

---
[docs/auth.md:45-67] score:0.92

The authentication flow begins with validating the JWT token...

---
[docs/api.md:120-145] score:0.78

To authenticate API requests, include the Bearer token...
```

Use `--json` flag for machine-parseable JSON output.

### Chat (with Ollama)
```bash
dseek chat "<query>"
```
Get a natural language answer from local LLM (requires Ollama running).

### Status
```bash
dseek status
```
Check index state, document count, and queue status.

## Response Format

Use `file:line_start-line_end` references from results when citing documentation.

Example response handling:
```
Based on docs/auth.md:120-156, the refresh token rotation is configured to...
```

If results are insufficient, request next page:
```bash
dseek search "<query>" --cursor <next_cursor>
```

## Best Practices

1. Use specific, keyword-rich queries for better results
2. Check `Index:` in response - if "updating", results may be incomplete
3. For mixed UA/EN queries, results will match across languages
4. Combine with file read when full context is needed
