# DSEEK

> Local-first documentation search with hybrid retrieval for Claude Code

DSEEK indexes your project documentation and provides fast, accurate search using a combination of semantic (vector) and keyword (BM25) retrieval.

## Features

- **Hybrid Search**: Combines semantic similarity with keyword matching
- **Local-First**: All data stays on your machine, no cloud required
- **Multi-Format**: Supports Markdown, PDF, DOCX, HTML, and plain text
- **Claude Code Integration**: Plugin for seamless AI assistant integration
- **Real-Time Updates**: File watcher keeps index in sync

## Installation

### From GitHub Release (recommended)

```bash
npm install -g https://github.com/oanton/dseek/releases/download/v1.0.1/dseek-cli-1.0.1.tgz
```

### From Source

```bash
git clone https://github.com/oanton/dseek
cd dseek
npm install
npm link
```

### Claude Code Plugin

```
/plugin marketplace add oanton/dseek
/plugin install dseek@dseek-marketplace
```

> **Note**: Restart Claude Code after installing the plugin for changes to take effect.

## Quick Start

```bash
# Initialize in your project
dseek add ./docs

# Start watching for changes
dseek watch &

# Search your documentation
dseek search "authentication flow"
```

## Commands

| Command | Description |
|---------|-------------|
| `dseek bootstrap` | Download embedding model (~1.2GB) |
| `dseek bootstrap --reranker` | Also download reranker model (~1.2GB) |
| `dseek bootstrap --all` | Download all models (~2.4GB total) |
| `dseek add <path>` | Add a docs folder to index |
| `dseek search "<query>"` | Search with hybrid retrieval |
| `dseek search "<query>" --rerank` | Search with cross-encoder reranking |
| `dseek search "<query>" --path <prefix>` | Filter results by path prefix |
| `dseek search "<query>" --source <name>` | Filter results by source name |
| `dseek chat "<query>"` | Get answer via local LLM (requires Ollama) |
| `dseek chat "<query>" --rerank` | Chat with reranked context |
| `dseek chat "<query>" --no-cite` | Chat without source citations |
| `dseek watch` | Run file watcher daemon |
| `dseek status` | Show index state and statistics |
| `dseek list` | List indexed documents |
| `dseek delete <path>` | Remove document from index |
| `dseek audit duplicates` | Find duplicate content |
| `dseek audit conflicts` | Find conflicting information |

## Configuration

Configuration is stored in `.dseek/config.json`. See the **[Configuration Reference](docs/configuration.md)** for all available options.

```json
{
  "schema_version": 1,
  "sources": [
    {
      "name": "docs",
      "path": "./docs",
      "include": ["**/*.md", "**/*.pdf"],
      "watch": true
    }
  ],
  "retrieval": {
    "mode": "hybrid",
    "semantic_weight": 0.75,
    "keyword_weight": 0.25,
    "default_limit": 8
  }
}
```

## Search Output

```json
{
  "results": [
    {
      "path": "docs/auth.md",
      "line_start": 120,
      "line_end": 156,
      "score": 0.81,
      "snippet": "The refresh token rotation..."
    }
  ],
  "next_cursor": "eyJvZmZzZXQiOjh9"
}
```

## Requirements

- **Node.js** >= 20
- **Ollama** (optional, for `chat` command)
  - Set `OLLAMA_HOST` env or `runtime.ollama_url` in config for remote server

## Development

```bash
# Clone and install
git clone https://github.com/oanton/dseek
cd dseek
npm install

# Download embedding model (required before running tests)
npm run dev -- bootstrap

# Run CLI in development
npm run dev -- search "test"

# Run tests
npm run test
```

> **Note**: The embedding model (`gte-multilingual-base`, ~1.2GB) is downloaded to `.dseek/models/` on first run or via `bootstrap`. The optional reranker model (`gte-multilingual-reranker-base`, ~1.2GB) can be downloaded with `bootstrap --reranker`. Total disk space: ~2.4GB for all models. This directory is gitignored.

## License

[MIT](LICENSE)
