# DSEEK Product Requirements Document

## Executive Summary

DSEEK is a local-first documentation search tool that provides fast, accurate retrieval using hybrid search (semantic + BM25). Primary integration target is Claude Code.

## Problem Statement

When working with large documentation sets, AI assistants like Claude Code often:
- Scan entire doc folders repeatedly (slow, context-heavy)
- Miss relevant information due to keyword-only search
- Lack cross-lingual matching capability

## Goals

1. **Fast retrieval**: Sub-100ms search latency for indexed docs
2. **High relevance**: Semantic understanding + keyword precision
3. **Privacy-first**: All data local, no cloud dependencies
4. **Seamless integration**: Claude Code plugin for automatic use

## Success Metrics

- Search latency < 100ms for 1000-document index
- Recall@10 > 0.85 on test suite
- Zero external API calls in default mode
- Claude Code correctly uses DSEEK for doc questions

## User Stories

### Developer with Claude Code
> As a developer using Claude Code, I want my AI assistant to find relevant documentation automatically so I don't have to manually search or paste context.

### Technical Writer
> As a technical writer, I want to find duplicate or conflicting content across my docs so I can maintain consistency.

### Team Lead
> As a team lead, I want documentation search that works offline and keeps our data private.

## Functional Requirements

### Core (v1)
| ID | Requirement | Priority |
|----|-------------|----------|
| F1 | Index documents from configured folders | P0 |
| F2 | Hybrid search (semantic + BM25) | P0 |
| F3 | Return snippets with file:line references | P0 |
| F4 | Watch mode for real-time updates | P0 |
| F5 | JSON output for tool integration | P0 |
| F6 | Support MD, TXT, HTML, PDF, DOCX | P0 |
| F7 | Claude Code plugin | P1 |
| F8 | Chat command with local LLM | P1 |
| F9 | Duplicate detection | P2 |
| F10 | Conflict detection | P2 |

### Non-Functional
| ID | Requirement | Target |
|----|-------------|--------|
| NF1 | Search latency | < 100ms |
| NF2 | Index update latency | < 500ms |
| NF3 | Max file size | 10MB |
| NF4 | Platform support | macOS (v1), Linux/Windows (v2) |

## Constraints

- Local-only mode by default (privacy)
- No cloud dependencies for core functionality
- Must work without internet after initial model download

## Out of Scope (v1)

- Code file indexing
- Jira/Confluence/Google Drive integration
- Web UI
- Multi-repo search

## Dependencies

- Ollama (optional, for chat command)
- Node.js >= 20

## Acceptance Criteria

See [Implementation Plan](plans/implementation-plan.md#acceptance-criteria-from-spec)
