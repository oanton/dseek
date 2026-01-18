#!/usr/bin/env node
import{createRequire}from"node:module";const require=createRequire(import.meta.url);
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/cli/index.ts
import { Command as Command10 } from "commander";

// src/cli/commands/add.ts
import { existsSync as existsSync5 } from "node:fs";
import { basename, isAbsolute, relative as relative2, resolve as resolve2 } from "node:path";
import { Command } from "commander";

// src/core/config.ts
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

// src/core/constants.ts
var LIMITS = {
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
  MAX_CHUNKS_PER_SEARCH: 1e3,
  /** Maximum documents to scan for stats */
  MAX_DOCS_STATS_SCAN: 1e4,
  /** Number of files to index in parallel */
  INDEXING_CONCURRENCY: 4
};
var MODELS = {
  /** Embedding model for semantic search (768 dimensions, ~1.2GB, 70+ languages) */
  EMBEDDING: "onnx-community/gte-multilingual-base",
  /** Cross-encoder model for reranking (15+ languages, 512 tokens) */
  RERANKER: "cross-encoder/mmarco-mMiniLMv2-L12-H384-v1",
  /** Default LLM for chat command */
  DEFAULT_LLM: "qwen2.5:7b-instruct"
};
var EMBEDDING_CONFIG = {
  /** Vector dimensions for gte-multilingual-base */
  DIMENSIONS: 768,
  /** Data type for model inference */
  DTYPE: "fp32",
  /** Maximum tokens for embedding input (model limit is 512) */
  MAX_TOKENS: 512
};
var RETRIEVAL_WEIGHTS = {
  /** Semantic (vector) search weight */
  SEMANTIC: 0.75,
  /** Keyword (BM25) search weight */
  KEYWORD: 0.25
};
var RERANK_FUSION = {
  /** Weight for original hybrid search score */
  HYBRID_WEIGHT: 0.4,
  /** Weight for cross-encoder rerank score */
  RERANK_WEIGHT: 0.6
};
var NETWORK = {
  /** Default Ollama API URL */
  DEFAULT_OLLAMA_URL: "http://localhost:11434"
};
var TIMING = {
  /** Model loading poll interval */
  MODEL_POLL_INTERVAL_MS: 100,
  /** File watch debounce delay */
  WATCH_DEBOUNCE_MS: 300,
  /** File watcher poll interval */
  WATCHER_POLL_INTERVAL_MS: 100,
  /** Ollama startup wait time */
  OLLAMA_STARTUP_WAIT_MS: 1e3,
  /** Maximum Ollama startup attempts */
  OLLAMA_MAX_STARTUP_ATTEMPTS: 30
};
var DEFAULTS = {
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
  SNIPPET_PREVIEW_LENGTH: 80
};
var CONFIDENCE = {
  /** Weight for average score in confidence calculation */
  SCORE_WEIGHT: 0.7,
  /** Weight for result count in confidence calculation */
  COUNT_WEIGHT: 0.3,
  /** Normalization divisor for result count */
  COUNT_NORMALIZATION: 10
};
var UI = {
  /** Separator line width for chat command */
  SEPARATOR_WIDTH: 60,
  /** Separator line width for list command */
  LIST_SEPARATOR_WIDTH: 80
};
var TEXT_PROCESSING = {
  /** Minimum ratio for sentence boundary truncation */
  SENTENCE_BOUNDARY_RATIO: 0.6,
  /** Minimum ratio for word boundary truncation */
  WORD_BOUNDARY_RATIO: 0.8
};
var SEARCH = {
  /** Minimum similarity threshold for vector search */
  MIN_SIMILARITY: 0.6,
  /** Conflict detection threshold modifier */
  CONFLICT_THRESHOLD_MODIFIER: 0.8
};
var DIRS = {
  /** Main dseek directory */
  DSEEK: ".dseek",
  /** Search index directory */
  INDEX: "index",
  /** ML models cache */
  MODELS: "models",
  /** Runtime files (locks, pids) */
  RUN: "run",
  /** Log files */
  LOGS: "logs",
  /** General cache */
  CACHE: "cache"
};
var FILES = {
  /** Main configuration file */
  CONFIG: ".dseek/config.json",
  /** Ignore patterns file */
  IGNORE: ".dseek/ignore",
  /** Orama search index */
  INDEX: "orama.json",
  /** Document metadata */
  METADATA: "metadata.json",
  /** Watcher lock file */
  WATCH_LOCK: "watch.lock",
  /** Watcher PID file */
  WATCH_PID: "watch.pid"
};

// src/core/config.ts
var DEFAULT_CONFIG = {
  schema_version: 1,
  project_id: "auto",
  sources: [],
  chunking: {
    strategy: "markdown-structure",
    fallback: {
      chunk_size: LIMITS.DEFAULT_CHUNK_SIZE,
      overlap: LIMITS.DEFAULT_CHUNK_OVERLAP
    }
  },
  retrieval: {
    mode: "hybrid",
    fusion: "rrf",
    semantic_weight: RETRIEVAL_WEIGHTS.SEMANTIC,
    keyword_weight: RETRIEVAL_WEIGHTS.KEYWORD,
    default_limit: LIMITS.DEFAULT_RESULTS,
    max_limit: LIMITS.MAX_RESULTS,
    pagination: {
      enabled: true
    }
  },
  privacy: {
    local_only: true,
    allow_remote: false,
    require_boundary_key: true,
    boundary_key_env: "DSEEK_DATA_BOUNDARY_KEY",
    redact_before_remote: true,
    pii_detectors: ["regex_rules"]
  },
  runtime: {
    auto_bootstrap: true,
    log_level: "info"
  }
};
var DEFAULT_IGNORE = `# DSEEK ignore patterns
.git/
.dseek/
node_modules/
build/
dist/
.dart_tool/
Pods/
DerivedData/
`;
function findProjectRoot(startPath = process.cwd()) {
  const envRoot = process.env.DSEEK_PROJECT_ROOT;
  if (envRoot) {
    return envRoot;
  }
  let current = startPath;
  while (current !== "/") {
    if (existsSync(join(current, DIRS.DSEEK)) || existsSync(join(current, ".git"))) {
      return current;
    }
    current = dirname(current);
  }
  return startPath;
}
function getDseekDir(projectRoot) {
  const root = projectRoot ?? findProjectRoot();
  return join(root, DIRS.DSEEK);
}
function getConfigPath(projectRoot) {
  const root = projectRoot ?? findProjectRoot();
  return join(root, FILES.CONFIG);
}
function isInitialized(projectRoot) {
  return existsSync(getConfigPath(projectRoot));
}
async function loadConfig(projectRoot) {
  const configPath = getConfigPath(projectRoot);
  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }
  const content = await readFile(configPath, "utf-8");
  const config = JSON.parse(content);
  return {
    ...DEFAULT_CONFIG,
    ...config,
    chunking: { ...DEFAULT_CONFIG.chunking, ...config.chunking },
    retrieval: { ...DEFAULT_CONFIG.retrieval, ...config.retrieval },
    privacy: { ...DEFAULT_CONFIG.privacy, ...config.privacy },
    runtime: { ...DEFAULT_CONFIG.runtime, ...config.runtime }
  };
}
async function saveConfig(config, projectRoot) {
  const configPath = getConfigPath(projectRoot);
  const dseekDir = getDseekDir(projectRoot);
  if (!existsSync(dseekDir)) {
    await mkdir(dseekDir, { recursive: true });
  }
  await writeFile(configPath, JSON.stringify(config, null, 2));
}
async function initializeProject(projectRoot) {
  const root = projectRoot ?? findProjectRoot();
  const dseekDir = join(root, DIRS.DSEEK);
  await mkdir(join(dseekDir, DIRS.INDEX), { recursive: true });
  await mkdir(join(dseekDir, DIRS.MODELS), { recursive: true });
  await mkdir(join(dseekDir, DIRS.RUN), { recursive: true });
  await mkdir(join(dseekDir, DIRS.LOGS), { recursive: true });
  await mkdir(join(dseekDir, DIRS.CACHE), { recursive: true });
  const configPath = getConfigPath(root);
  if (!existsSync(configPath)) {
    await saveConfig(DEFAULT_CONFIG, root);
  }
  const ignorePath = join(root, FILES.IGNORE);
  if (!existsSync(ignorePath)) {
    await writeFile(ignorePath, DEFAULT_IGNORE);
  }
}
async function addSource(source, projectRoot) {
  const config = await loadConfig(projectRoot);
  config.sources = config.sources.filter((s) => s.name !== source.name);
  config.sources.push(source);
  await saveConfig(config, projectRoot);
}
async function loadIgnorePatterns(projectRoot) {
  const root = projectRoot ?? findProjectRoot();
  const ignorePath = join(root, FILES.IGNORE);
  if (!existsSync(ignorePath)) {
    return DEFAULT_IGNORE.split("\n").filter((line) => line && !line.startsWith("#"));
  }
  const content = await readFile(ignorePath, "utf-8");
  return content.split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
}

// src/core/indexer.ts
import { createHash as createHash2 } from "node:crypto";
import { existsSync as existsSync4 } from "node:fs";
import { readFile as readFile4, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { glob } from "glob";

// src/parsers/docx.ts
import mammoth from "mammoth";
async function parseDocx(content, _filePath) {
  try {
    const result = await mammoth.convertToMarkdown({ buffer: content });
    if (result.messages.length > 0) {
      for (const msg of result.messages) {
        if (msg.type === "warning") {
          console.warn(`DOCX warning: ${msg.message}`);
        }
      }
    }
    const text = result.value.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
    const lines = text.split("\n").length;
    return {
      content: text,
      metadata: {
        lines
      }
    };
  } catch (error) {
    throw new Error(`Failed to parse DOCX: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// src/parsers/html.ts
import * as cheerio from "cheerio";
async function parseHtml(content, _filePath) {
  const html = content.toString("utf-8");
  const $ = cheerio.load(html);
  $("script, style, noscript, iframe, svg").remove();
  $('[hidden], [style*="display: none"], [style*="display:none"]').remove();
  const body = $("body").length ? $("body") : $.root();
  const text = extractTextWithStructure($, body);
  const lines = text.split("\n").length;
  return {
    content: text,
    metadata: {
      lines
    }
  };
}
function extractTextWithStructure($, element) {
  const blocks = [];
  element.find("h1, h2, h3, h4, h5, h6, p, li, td, th, blockquote, pre, div").each((_i, el) => {
    const $el = $(el);
    const tagName = el.tagName?.toLowerCase();
    if ($el.parents("h1, h2, h3, h4, h5, h6, p, li, td, th, blockquote, pre").length > 0) {
      return;
    }
    let text = $el.text().trim();
    if (!text) return;
    text = text.replace(/\s+/g, " ");
    if (tagName?.startsWith("h")) {
      const level = parseInt(tagName[1], 10);
      const marker = "#".repeat(level);
      text = `${marker} ${text}`;
    }
    if (tagName === "li") {
      text = `- ${text}`;
    }
    blocks.push(text);
  });
  if (blocks.length === 0) {
    return element.text().replace(/\s+/g, " ").trim();
  }
  return blocks.join("\n\n");
}

// src/parsers/markdown.ts
import remarkParse from "remark-parse";
import { unified } from "unified";
async function parseMarkdown(content, _filePath) {
  const text = content.toString("utf-8");
  const lines = text.split("\n").length;
  try {
    const processor = unified().use(remarkParse);
    await processor.parse(text);
  } catch (error) {
    console.warn(`Markdown parsing warning: ${error}`);
  }
  return {
    content: text,
    metadata: {
      lines
    }
  };
}
function isCodeBlockDelimiter(line) {
  return line.trim().startsWith("```");
}
function extractSections(content) {
  const lines = content.split("\n");
  const sections = [];
  let currentSection = null;
  const sectionStartLine = 1;
  let inCodeBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    if (isCodeBlockDelimiter(line)) {
      inCodeBlock = !inCodeBlock;
    }
    if (!inCodeBlock) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        if (currentSection) {
          currentSection.endLine = lineNum - 1;
          currentSection.content = lines.slice(currentSection.startLine - 1, lineNum - 1).join("\n");
          sections.push(currentSection);
        } else if (sectionStartLine < lineNum) {
          sections.push({
            heading: null,
            level: 0,
            startLine: sectionStartLine,
            endLine: lineNum - 1,
            content: lines.slice(sectionStartLine - 1, lineNum - 1).join("\n")
          });
        }
        currentSection = {
          heading: headingMatch[2].trim(),
          level: headingMatch[1].length,
          startLine: lineNum,
          endLine: lineNum,
          content: ""
        };
      }
    }
  }
  if (currentSection) {
    currentSection.endLine = lines.length;
    currentSection.content = lines.slice(currentSection.startLine - 1).join("\n");
    sections.push(currentSection);
  } else if (sectionStartLine <= lines.length) {
    sections.push({
      heading: null,
      level: 0,
      startLine: sectionStartLine,
      endLine: lines.length,
      content
    });
  }
  return sections;
}

// src/parsers/pdf.ts
import pdf from "pdf-parse";
async function parsePdf(content, _filePath) {
  try {
    const data = await pdf(content);
    const text = data.text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n{3,}/g, "\n\n");
    return {
      content: text,
      metadata: {
        pages: data.numpages
      }
    };
  } catch (error) {
    throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// src/parsers/text.ts
async function parseText(content, _filePath) {
  const text = content.toString("utf-8");
  const lines = text.split("\n").length;
  return {
    content: text,
    metadata: {
      lines
    }
  };
}

// src/parsers/index.ts
var PARSERS = {
  md: parseMarkdown,
  txt: parseText,
  html: parseHtml,
  pdf: parsePdf,
  docx: parseDocx
};
var EXTENSION_MAP = {
  ".md": "md",
  ".markdown": "md",
  ".txt": "txt",
  ".text": "txt",
  ".html": "html",
  ".htm": "html",
  ".pdf": "pdf",
  ".docx": "docx"
};
function getFormat(filePath) {
  const ext = filePath.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (!ext) return null;
  return EXTENSION_MAP[ext] ?? null;
}
function isSupported(filePath) {
  return getFormat(filePath) !== null;
}
function getParser(format) {
  return PARSERS[format];
}
async function parseDocument(content, filePath) {
  const format = getFormat(filePath);
  if (!format) {
    throw new Error(`Unsupported file format: ${filePath}`);
  }
  if (content.length > LIMITS.MAX_FILE_SIZE_BYTES) {
    throw new Error(`File exceeds maximum size of ${LIMITS.MAX_FILE_SIZE_BYTES / 1024 / 1024}MB: ${filePath}`);
  }
  const parser = getParser(format);
  return parser(content, filePath);
}

// src/storage/index.ts
import { existsSync as existsSync2 } from "node:fs";
import { mkdir as mkdir2, readFile as readFile2, writeFile as writeFile2 } from "node:fs/promises";
import { join as join3 } from "node:path";
import { count, create, insert, load as load2, remove, save, search } from "@orama/orama";

// src/core/embedder.ts
import { join as join2 } from "node:path";
import { AutoTokenizer, pipeline } from "@huggingface/transformers";
var embedderInstance = null;
var tokenizerInstance = null;
var isLoading = false;
var loadError = null;
function getModelsDir() {
  return join2(getDseekDir(), DIRS.MODELS);
}
async function getTokenizer() {
  if (!tokenizerInstance) {
    tokenizerInstance = await AutoTokenizer.from_pretrained(MODELS.EMBEDDING, {
      cache_dir: getModelsDir()
    });
  }
  return tokenizerInstance;
}
async function truncateText(text, maxTokens) {
  if (!text || !text.trim()) {
    return text;
  }
  const tokenizer = await getTokenizer();
  const encoded = tokenizer(text, {
    truncation: true,
    max_length: maxTokens
  });
  const tokenIdsData = encoded.input_ids.data;
  if (!tokenIdsData || tokenIdsData.length === 0) {
    return text;
  }
  const tokenIds = Array.from(tokenIdsData, (x) => Number(x));
  if (tokenIds.length === 0) {
    return text;
  }
  return tokenizer.decode(tokenIds, { skip_special_tokens: true });
}
async function getEmbedder() {
  if (embedderInstance) {
    return embedderInstance;
  }
  if (isLoading) {
    return new Promise((resolve3, reject) => {
      const checkInterval = setInterval(() => {
        if (embedderInstance) {
          clearInterval(checkInterval);
          resolve3(embedderInstance);
        } else if (loadError) {
          clearInterval(checkInterval);
          reject(loadError);
        }
      }, TIMING.MODEL_POLL_INTERVAL_MS);
    });
  }
  isLoading = true;
  try {
    console.error(`Loading embedding model: ${MODELS.EMBEDDING}...`);
    const startTime = Date.now();
    embedderInstance = await pipeline("feature-extraction", MODELS.EMBEDDING, {
      cache_dir: getModelsDir(),
      dtype: EMBEDDING_CONFIG.DTYPE
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
async function embed(text) {
  const embedder = await getEmbedder();
  const truncatedText = await truncateText(text, EMBEDDING_CONFIG.MAX_TOKENS);
  const result = await embedder(truncatedText, {
    pooling: "mean",
    normalize: true
  });
  const embedding = Array.from(result.data);
  if (embedding.length !== EMBEDDING_CONFIG.DIMENSIONS) {
    throw new Error(`Unexpected embedding dimension: ${embedding.length}, expected ${EMBEDDING_CONFIG.DIMENSIONS}`);
  }
  return embedding;
}
async function embedBatch(texts) {
  if (texts.length === 0) {
    return [];
  }
  const embedder = await getEmbedder();
  const embeddings = [];
  for (let i = 0; i < texts.length; i += LIMITS.EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + LIMITS.EMBEDDING_BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (text) => {
        const truncatedText = await truncateText(text, EMBEDDING_CONFIG.MAX_TOKENS);
        const result = await embedder(truncatedText, {
          pooling: "mean",
          normalize: true
        });
        return Array.from(result.data);
      })
    );
    embeddings.push(...results);
  }
  return embeddings;
}
function getEmbeddingDim() {
  return EMBEDDING_CONFIG.DIMENSIONS;
}
function getModelName() {
  return MODELS.EMBEDDING;
}

// src/storage/index.ts
var SCHEMA = {
  doc_id: "string",
  chunk_id: "string",
  text: "string",
  snippet: "string",
  line_start: "number",
  line_end: "number",
  page_start: "number",
  page_end: "number",
  embedding: `vector[${getEmbeddingDim()}]`
};
var db = null;
function getIndexDir() {
  return join3(getDseekDir(), DIRS.INDEX);
}
function getIndexPath() {
  return join3(getIndexDir(), FILES.INDEX);
}
async function initIndex() {
  if (db) return db;
  const indexPath = getIndexPath();
  const indexDir = getIndexDir();
  if (!existsSync2(indexDir)) {
    await mkdir2(indexDir, { recursive: true });
  }
  db = await create({ schema: SCHEMA });
  if (existsSync2(indexPath)) {
    try {
      const data = await readFile2(indexPath, "utf-8");
      load2(db, JSON.parse(data));
      return db;
    } catch (error) {
      console.warn("Failed to load index, creating new one:", error);
      db = await create({ schema: SCHEMA });
    }
  }
  return db;
}
async function saveIndex() {
  if (!db) return;
  const indexPath = getIndexPath();
  const data = await save(db);
  await writeFile2(indexPath, JSON.stringify(data));
}
async function getDb() {
  if (!db) {
    db = await initIndex();
  }
  return db;
}
async function insertChunk(chunk) {
  const database = await getDb();
  const doc = {
    doc_id: chunk.doc_id,
    chunk_id: chunk.chunk_id,
    text: chunk.text,
    snippet: chunk.snippet,
    line_start: chunk.line_start,
    line_end: chunk.line_end,
    page_start: chunk.page_start ?? 0,
    page_end: chunk.page_end ?? 0,
    embedding: chunk.embedding ?? []
  };
  await insert(database, doc);
}
async function insertChunks(chunks) {
  for (const chunk of chunks) {
    await insertChunk(chunk);
  }
}
async function removeDocument(docId) {
  const database = await getDb();
  const results = await search(database, {
    term: docId,
    properties: ["doc_id"],
    limit: LIMITS.MAX_CHUNKS_PER_SEARCH
  });
  let removed = 0;
  for (const hit of results.hits) {
    await remove(database, hit.id);
    removed++;
  }
  return removed;
}
async function searchIndex(query, embedding, options = {}) {
  const database = await getDb();
  const {
    limit = LIMITS.DEFAULT_RESULTS,
    offset = 0,
    semanticWeight = RETRIEVAL_WEIGHTS.SEMANTIC,
    keywordWeight = RETRIEVAL_WEIGHTS.KEYWORD
  } = options;
  const results = await search(database, {
    mode: "hybrid",
    term: query,
    vector: {
      value: embedding,
      property: "embedding"
    },
    hybridWeights: {
      text: keywordWeight,
      vector: semanticWeight
    },
    limit: limit + offset,
    similarity: SEARCH.MIN_SIMILARITY
  });
  const hits = results.hits.slice(offset, offset + limit);
  const searchResults = hits.map((hit) => ({
    chunk_id: hit.document.chunk_id,
    path: hit.document.doc_id,
    line_start: hit.document.line_start,
    line_end: hit.document.line_end,
    page_start: hit.document.page_start || null,
    page_end: hit.document.page_end || null,
    score: hit.score,
    snippet: hit.document.snippet
  }));
  return {
    results: searchResults,
    total: results.count
  };
}
async function getIndexStats() {
  const database = await getDb();
  const totalChunks = await count(database);
  const results = await search(database, {
    term: "",
    limit: LIMITS.MAX_DOCS_STATS_SCAN
  });
  const documents = /* @__PURE__ */ new Set();
  for (const hit of results.hits) {
    documents.add(hit.document.doc_id);
  }
  return {
    chunks: totalChunks,
    documents
  };
}

// src/storage/metadata.ts
import { existsSync as existsSync3 } from "node:fs";
import { mkdir as mkdir3, readFile as readFile3, writeFile as writeFile3 } from "node:fs/promises";
import { join as join4 } from "node:path";
var store = null;
function getMetadataPath() {
  return join4(getDseekDir(), DIRS.INDEX, FILES.METADATA);
}
function createEmptyStore() {
  return {
    version: 1,
    documents: {},
    last_event: null,
    index_version: generateIndexVersion(),
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function generateIndexVersion() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
}
async function loadMetadata() {
  if (store) return store;
  const metadataPath = getMetadataPath();
  if (existsSync3(metadataPath)) {
    try {
      const data = await readFile3(metadataPath, "utf-8");
      store = JSON.parse(data);
      return store;
    } catch (error) {
      console.warn("Failed to load metadata, creating new store:", error);
    }
  }
  store = createEmptyStore();
  return store;
}
async function saveMetadata() {
  if (!store) return;
  const metadataPath = getMetadataPath();
  const indexDir = join4(getDseekDir(), DIRS.INDEX);
  if (!existsSync3(indexDir)) {
    await mkdir3(indexDir, { recursive: true });
  }
  store.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  await writeFile3(metadataPath, JSON.stringify(store, null, 2));
}
async function getDocument(docId) {
  const metadata = await loadMetadata();
  return metadata.documents[docId] ?? null;
}
async function setDocument(doc) {
  const metadata = await loadMetadata();
  metadata.documents[doc.doc_id] = doc;
  metadata.index_version = generateIndexVersion();
}
async function removeDocument2(docId) {
  const metadata = await loadMetadata();
  if (metadata.documents[docId]) {
    delete metadata.documents[docId];
    metadata.index_version = generateIndexVersion();
    return true;
  }
  return false;
}
async function getAllDocuments() {
  const metadata = await loadMetadata();
  return Object.values(metadata.documents);
}
async function getDocumentCount() {
  const metadata = await loadMetadata();
  return Object.keys(metadata.documents).length;
}
async function recordEvent(event) {
  const metadata = await loadMetadata();
  metadata.last_event = event;
}
async function getLastEvent() {
  const metadata = await loadMetadata();
  return metadata.last_event;
}
async function getIndexVersion() {
  const metadata = await loadMetadata();
  return metadata.index_version;
}
async function needsUpdate(docId, contentHash) {
  const doc = await getDocument(docId);
  if (!doc) return true;
  return doc.content_hash !== contentHash;
}

// src/core/chunker.ts
import { createHash } from "node:crypto";
var DEFAULT_CONFIG2 = {
  strategy: "markdown-structure",
  fallback: {
    chunk_size: LIMITS.DEFAULT_CHUNK_SIZE,
    overlap: LIMITS.DEFAULT_CHUNK_OVERLAP
  }
};
function generateContentHash(content) {
  return createHash("sha256").update(content).digest("hex").substring(0, 8);
}
function generateChunkId(docId, lineStart, lineEnd, hash) {
  return `${docId}:${lineStart}-${lineEnd}:${hash}`;
}
function createSnippet(text, maxLength = LIMITS.MAX_SNIPPET_LENGTH) {
  if (text.length <= maxLength) {
    return text;
  }
  const truncated = text.substring(0, maxLength);
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf(". "),
    truncated.lastIndexOf(".\n"),
    truncated.lastIndexOf("? "),
    truncated.lastIndexOf("! ")
  );
  if (lastSentenceEnd > maxLength * TEXT_PROCESSING.SENTENCE_BOUNDARY_RATIO) {
    return truncated.substring(0, lastSentenceEnd + 1).trim();
  }
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > maxLength * TEXT_PROCESSING.WORD_BOUNDARY_RATIO) {
    return `${truncated.substring(0, lastSpace).trim()}...`;
  }
  return `${truncated.trim()}...`;
}
function chunkDocument(content, options) {
  const { docId, format, config = DEFAULT_CONFIG2 } = options;
  if (format === "md" && config.strategy === "markdown-structure") {
    return chunkMarkdownStructure(content, docId);
  }
  return chunkFallback(content, docId, config.fallback);
}
function chunkMarkdownStructure(content, docId) {
  const sections = extractSections(content);
  const chunks = [];
  for (const section of sections) {
    const trimmedContent = section.content.trim();
    if (!trimmedContent) continue;
    if (trimmedContent.length > LIMITS.DEFAULT_CHUNK_SIZE * 2) {
      const subChunks = splitLargeSection(trimmedContent, docId, section.startLine, section.heading);
      chunks.push(...subChunks);
    } else {
      const hash = generateContentHash(trimmedContent);
      const chunkId = generateChunkId(docId, section.startLine, section.endLine, hash);
      chunks.push({
        chunk_id: chunkId,
        doc_id: docId,
        text: trimmedContent,
        snippet: createSnippet(trimmedContent),
        line_start: section.startLine,
        line_end: section.endLine
      });
    }
  }
  return chunks;
}
function splitLargeSection(content, docId, startLine, heading) {
  const chunks = [];
  const lines = content.split("\n");
  const paragraphs = [];
  let currentParagraph = "";
  let paragraphStart = startLine;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = startLine + i;
    if (line.trim() === "") {
      if (currentParagraph.trim()) {
        paragraphs.push({
          text: currentParagraph.trim(),
          startLine: paragraphStart,
          endLine: lineNum - 1
        });
        currentParagraph = "";
      }
      paragraphStart = lineNum + 1;
    } else {
      if (!currentParagraph) {
        paragraphStart = lineNum;
      }
      currentParagraph += `${line}
`;
    }
  }
  if (currentParagraph.trim()) {
    paragraphs.push({
      text: currentParagraph.trim(),
      startLine: paragraphStart,
      endLine: startLine + lines.length - 1
    });
  }
  let currentChunk = heading ? `# ${heading}

` : "";
  let chunkStartLine = paragraphs[0]?.startLine ?? startLine;
  let chunkEndLine = chunkStartLine;
  for (const para of paragraphs) {
    if (currentChunk.length + para.text.length > LIMITS.DEFAULT_CHUNK_SIZE && currentChunk.length > 0) {
      const hash = generateContentHash(currentChunk);
      const chunkId = generateChunkId(docId, chunkStartLine, chunkEndLine, hash);
      chunks.push({
        chunk_id: chunkId,
        doc_id: docId,
        text: currentChunk.trim(),
        snippet: createSnippet(currentChunk.trim()),
        line_start: chunkStartLine,
        line_end: chunkEndLine
      });
      currentChunk = `${para.text}

`;
      chunkStartLine = para.startLine;
    } else {
      currentChunk += `${para.text}

`;
    }
    chunkEndLine = para.endLine;
  }
  if (currentChunk.trim()) {
    const hash = generateContentHash(currentChunk);
    const chunkId = generateChunkId(docId, chunkStartLine, chunkEndLine, hash);
    chunks.push({
      chunk_id: chunkId,
      doc_id: docId,
      text: currentChunk.trim(),
      snippet: createSnippet(currentChunk.trim()),
      line_start: chunkStartLine,
      line_end: chunkEndLine
    });
  }
  return chunks;
}
function chunkFallback(content, docId, config) {
  const chunkSize = config.chunk_size || LIMITS.DEFAULT_CHUNK_SIZE;
  const overlap = config.overlap || LIMITS.DEFAULT_CHUNK_OVERLAP;
  const chunks = [];
  const lines = content.split("\n");
  let currentChunk = "";
  let chunkStartLine = 1;
  let chunkEndLine = 1;
  let charCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    currentChunk += `${line}
`;
    charCount += line.length + 1;
    chunkEndLine = lineNum;
    if (charCount >= chunkSize) {
      const text2 = currentChunk.trim();
      if (text2) {
        const hash = generateContentHash(text2);
        const chunkId = generateChunkId(docId, chunkStartLine, chunkEndLine, hash);
        chunks.push({
          chunk_id: chunkId,
          doc_id: docId,
          text: text2,
          snippet: createSnippet(text2),
          line_start: chunkStartLine,
          line_end: chunkEndLine
        });
      }
      const overlapLines = [];
      let overlapCharCount = 0;
      for (let j = i; j >= 0 && overlapCharCount < overlap; j--) {
        overlapLines.unshift(lines[j]);
        overlapCharCount += lines[j].length + 1;
        chunkStartLine = j + 1;
      }
      currentChunk = `${overlapLines.join("\n")}
`;
      charCount = overlapCharCount;
    }
  }
  const text = currentChunk.trim();
  if (text && text.length > overlap) {
    const hash = generateContentHash(text);
    const chunkId = generateChunkId(docId, chunkStartLine, chunkEndLine, hash);
    chunks.push({
      chunk_id: chunkId,
      doc_id: docId,
      text,
      snippet: createSnippet(text),
      line_start: chunkStartLine,
      line_end: chunkEndLine
    });
  }
  return chunks;
}

// src/core/indexer.ts
function generateDocId(filePath, projectRoot) {
  return relative(projectRoot, resolve(filePath));
}
function generateHash(content) {
  return createHash2("sha256").update(content).digest("hex");
}
function shouldIgnore(path, ignorePatterns, excludePatterns) {
  const allPatterns = [...ignorePatterns, ...excludePatterns];
  for (const pattern of allPatterns) {
    if (pattern.endsWith("/")) {
      if (path.includes(pattern.slice(0, -1))) return true;
    } else if (path.includes(pattern) || path.match(new RegExp(pattern.replace(/\*/g, ".*")))) {
      return true;
    }
  }
  return false;
}
async function indexFile(filePath, projectRoot) {
  const root = projectRoot ?? findProjectRoot();
  const docId = generateDocId(filePath, root);
  const config = await loadConfig(root);
  try {
    if (!existsSync4(filePath)) {
      return { success: false, error: `File not found: ${filePath}` };
    }
    const fileStat = await stat(filePath);
    if (fileStat.size > LIMITS.MAX_FILE_SIZE_BYTES) {
      return { success: false, error: `File exceeds ${LIMITS.MAX_FILE_SIZE_BYTES / 1024 / 1024}MB limit` };
    }
    const format = getFormat(filePath);
    if (!format) {
      return { success: false, error: `Unsupported format: ${filePath}` };
    }
    const content = await readFile4(filePath);
    const contentHash = generateHash(content);
    if (!await needsUpdate(docId, contentHash)) {
      return { success: true, chunks: 0 };
    }
    await removeDocument(docId);
    const parsed = await parseDocument(content, filePath);
    const rawChunks = chunkDocument(parsed.content, {
      docId,
      format,
      config: config.chunking
    });
    const texts = rawChunks.map((c) => c.text);
    const embeddings = await embedBatch(texts);
    const chunks = rawChunks.map((chunk, i) => ({
      ...chunk,
      embedding: embeddings[i]
    }));
    await insertChunks(chunks);
    const doc = {
      doc_id: docId,
      source_name: "default",
      // TODO: determine from source config
      format,
      content_hash: contentHash,
      updated_at: (/* @__PURE__ */ new Date()).toISOString(),
      size_bytes: fileStat.size
    };
    await setDocument(doc);
    await recordEvent({
      type: "add",
      path: docId,
      at: (/* @__PURE__ */ new Date()).toISOString()
    });
    return { success: true, chunks: chunks.length };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
async function indexSource(source, projectRoot) {
  const root = projectRoot ?? findProjectRoot();
  const sourcePath = resolve(root, source.path);
  const ignorePatterns = await loadIgnorePatterns(root);
  const result = {
    indexed: 0,
    skipped: 0,
    errors: []
  };
  const sourceStat = await stat(sourcePath);
  let uniqueFiles = [];
  if (sourceStat.isFile()) {
    if (isSupported(sourcePath)) {
      const relativePath = relative(root, sourcePath);
      if (!shouldIgnore(relativePath, ignorePatterns, source.exclude)) {
        uniqueFiles = [sourcePath];
      }
    }
  } else {
    const patterns = source.include.length > 0 ? source.include : ["**/*"];
    const files = [];
    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: sourcePath,
        nodir: true,
        absolute: true
      });
      files.push(...matches);
    }
    uniqueFiles = [...new Set(files)].filter((f) => {
      if (!isSupported(f)) return false;
      const relativePath = relative(root, f);
      if (shouldIgnore(relativePath, ignorePatterns, source.exclude)) return false;
      return true;
    });
  }
  console.log(`Found ${uniqueFiles.length} files to index in ${source.name}`);
  const concurrency = LIMITS.INDEXING_CONCURRENCY;
  for (let i = 0; i < uniqueFiles.length; i += concurrency) {
    const batch = uniqueFiles.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map((file) => indexFile(file, root)));
    for (let j = 0; j < batchResults.length; j++) {
      const { success, chunks, error } = batchResults[j];
      const file = batch[j];
      if (success) {
        if (chunks && chunks > 0) {
          result.indexed++;
          console.log(`  Indexed: ${relative(root, file)} (${chunks} chunks)`);
        } else {
          result.skipped++;
        }
      } else {
        result.errors.push(`${file}: ${error}`);
        console.error(`  Error: ${relative(root, file)} - ${error}`);
      }
    }
  }
  await saveIndex();
  await saveMetadata();
  return result;
}
async function deleteDocument(docIdOrPath, projectRoot) {
  const root = projectRoot ?? findProjectRoot();
  const docId = docIdOrPath.startsWith("/") ? relative(root, docIdOrPath) : docIdOrPath;
  const chunksRemoved = await removeDocument(docId);
  const metaRemoved = await removeDocument2(docId);
  if (chunksRemoved > 0 || metaRemoved) {
    await recordEvent({
      type: "delete",
      path: docId,
      at: (/* @__PURE__ */ new Date()).toISOString()
    });
    await saveIndex();
    await saveMetadata();
    return true;
  }
  return false;
}

// src/cli/commands/add.ts
var addCommand = new Command("add").description("Add a file or folder to the index").argument("<path>", "Path to the file or folder to index").option("-n, --name <name>", "Source name (defaults to folder name)").option("-i, --include <patterns...>", 'Include patterns (e.g., "**/*.md")').option("-e, --exclude <patterns...>", "Exclude patterns").option("--no-index", "Add source without indexing").action(async (path, options) => {
  try {
    const absolutePath = resolve2(path);
    if (!existsSync5(absolutePath)) {
      console.error(`Error: Path not found: ${absolutePath}`);
      process.exit(1);
    }
    let projectRoot;
    try {
      projectRoot = findProjectRoot();
    } catch {
      console.log("No dseek project found. Initializing...");
      projectRoot = process.cwd();
      await initializeProject(projectRoot);
      console.log("Initialized dseek project in", projectRoot);
    }
    const relativePath = relative2(projectRoot, absolutePath);
    const isWithinProject = !relativePath.startsWith("..") && !isAbsolute(relativePath);
    const sourcePath = isWithinProject ? relativePath : absolutePath;
    const source = {
      name: options.name ?? basename(absolutePath),
      path: sourcePath,
      include: options.include ?? ["**/*.md", "**/*.txt", "**/*.html", "**/*.pdf", "**/*.docx"],
      exclude: options.exclude ?? [],
      watch: true
    };
    await addSource(source, projectRoot);
    console.log(`Added source: ${source.name} (${source.path})`);
    if (options.index !== false) {
      console.log("\nIndexing...");
      const result = await indexSource(source, projectRoot);
      console.log("\nIndexing complete:");
      console.log(`  Indexed: ${result.indexed} files`);
      console.log(`  Skipped: ${result.skipped} files (unchanged)`);
      if (result.errors.length > 0) {
        console.log(`  Errors: ${result.errors.length}`);
        for (const e of result.errors) {
          console.log(`    - ${e}`);
        }
      }
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});

// src/cli/commands/audit.ts
import { search as oramaSearch } from "@orama/orama";
import { Command as Command2 } from "commander";
var auditCommand = new Command2("audit").description("Audit the index for issues").argument("<type>", "Audit type: duplicates | conflicts").option("-t, --threshold <number>", "Similarity threshold (0-1)", String(DEFAULTS.SIMILARITY_THRESHOLD)).option("-l, --limit <number>", "Maximum results", String(DEFAULTS.AUDIT_LIMIT)).option("--json", "Output as JSON").action(async (type, options) => {
  try {
    switch (type) {
      case "duplicates":
        await auditDuplicates(options);
        break;
      case "conflicts":
        await auditConflicts(options);
        break;
      default:
        console.error(`Unknown audit type: ${type}`);
        console.error("Available types: duplicates, conflicts");
        process.exit(1);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
async function auditDuplicates(options) {
  const threshold = parseFloat(options.threshold);
  const limit = parseInt(options.limit, 10);
  console.log(`Searching for near-duplicate content (threshold: ${threshold})...
`);
  const db2 = await getDb();
  const allResults = await oramaSearch(db2, {
    term: "",
    limit: LIMITS.MAX_DOCS_STATS_SCAN
  });
  if (allResults.hits.length === 0) {
    console.log("No chunks in index.");
    return;
  }
  const chunks = allResults.hits.map((hit) => ({
    chunk_id: hit.document.chunk_id,
    doc_id: hit.document.doc_id,
    text: hit.document.text,
    snippet: hit.document.snippet,
    line_start: hit.document.line_start,
    line_end: hit.document.line_end,
    embedding: hit.document.embedding
  }));
  const duplicates = [];
  const seen = /* @__PURE__ */ new Set();
  for (let i = 0; i < chunks.length && duplicates.length < limit; i++) {
    if (seen.has(chunks[i].chunk_id)) continue;
    const group = {
      chunks: [
        {
          chunk_id: chunks[i].chunk_id,
          path: chunks[i].doc_id,
          line_start: chunks[i].line_start,
          line_end: chunks[i].line_end,
          snippet: chunks[i].snippet
        }
      ],
      similarity: 1
    };
    for (let j = i + 1; j < chunks.length; j++) {
      if (seen.has(chunks[j].chunk_id)) continue;
      const similarity = cosineSimilarity(chunks[i].embedding, chunks[j].embedding);
      if (similarity >= threshold) {
        group.chunks.push({
          chunk_id: chunks[j].chunk_id,
          path: chunks[j].doc_id,
          line_start: chunks[j].line_start,
          line_end: chunks[j].line_end,
          snippet: chunks[j].snippet
        });
        group.similarity = Math.min(group.similarity, similarity);
        seen.add(chunks[j].chunk_id);
      }
    }
    if (group.chunks.length > 1) {
      duplicates.push(group);
      seen.add(chunks[i].chunk_id);
    }
  }
  if (options.json) {
    console.log(JSON.stringify(duplicates, null, 2));
    return;
  }
  if (duplicates.length === 0) {
    console.log("No near-duplicates found.");
    return;
  }
  console.log(`Found ${duplicates.length} duplicate groups:
`);
  for (let i = 0; i < duplicates.length; i++) {
    const group = duplicates[i];
    console.log(`Group ${i + 1} (similarity: ${(group.similarity * 100).toFixed(1)}%):`);
    for (const chunk of group.chunks) {
      console.log(`  - ${chunk.path}:${chunk.line_start}-${chunk.line_end}`);
      console.log(`    "${chunk.snippet.substring(0, DEFAULTS.SNIPPET_PREVIEW_LENGTH)}..."`);
    }
    console.log();
  }
}
async function auditConflicts(options) {
  console.log("Searching for potentially conflicting information...\n");
  const db2 = await getDb();
  const allResults = await oramaSearch(db2, {
    term: "",
    limit: LIMITS.MAX_DOCS_STATS_SCAN
  });
  if (allResults.hits.length === 0) {
    console.log("No chunks in index.");
    return;
  }
  const chunks = allResults.hits.map((hit) => ({
    chunk_id: hit.document.chunk_id,
    doc_id: hit.document.doc_id,
    text: hit.document.text,
    snippet: hit.document.snippet,
    line_start: hit.document.line_start,
    line_end: hit.document.line_end,
    embedding: hit.document.embedding
  }));
  const conflicts = [];
  const limit = parseInt(options.limit, 10);
  const threshold = parseFloat(options.threshold);
  for (let i = 0; i < chunks.length && conflicts.length < limit; i++) {
    for (let j = i + 1; j < chunks.length && conflicts.length < limit; j++) {
      if (chunks[i].doc_id === chunks[j].doc_id) continue;
      const similarity = cosineSimilarity(chunks[i].embedding, chunks[j].embedding);
      if (similarity >= threshold * SEARCH.CONFLICT_THRESHOLD_MODIFIER && similarity < 1) {
        const hasConflict = detectPotentialConflict(chunks[i].text, chunks[j].text);
        if (hasConflict.isConflict) {
          conflicts.push({
            chunk1: {
              path: chunks[i].doc_id,
              line_start: chunks[i].line_start,
              snippet: chunks[i].snippet
            },
            chunk2: {
              path: chunks[j].doc_id,
              line_start: chunks[j].line_start,
              snippet: chunks[j].snippet
            },
            reason: hasConflict.reason,
            similarity
          });
        }
      }
    }
  }
  if (options.json) {
    console.log(JSON.stringify(conflicts, null, 2));
    return;
  }
  if (conflicts.length === 0) {
    console.log("No potential conflicts found.");
    return;
  }
  console.log(`Found ${conflicts.length} potential conflicts:
`);
  for (let i = 0; i < conflicts.length; i++) {
    const conflict = conflicts[i];
    console.log(`Conflict ${i + 1}: ${conflict.reason}`);
    console.log(`  File 1: ${conflict.chunk1.path}:${conflict.chunk1.line_start}`);
    console.log(`    "${conflict.chunk1.snippet.substring(0, DEFAULTS.SNIPPET_PREVIEW_LENGTH)}..."`);
    console.log(`  File 2: ${conflict.chunk2.path}:${conflict.chunk2.line_start}`);
    console.log(`    "${conflict.chunk2.snippet.substring(0, DEFAULTS.SNIPPET_PREVIEW_LENGTH)}..."`);
    console.log();
  }
}
function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
function detectPotentialConflict(text1, text2) {
  const numberPattern = /(\d+(?:\.\d+)?)\s*(MB|GB|KB|ms|seconds?|minutes?|hours?|days?|%)/gi;
  const nums1 = [...text1.matchAll(numberPattern)];
  const nums2 = [...text2.matchAll(numberPattern)];
  for (const n1 of nums1) {
    for (const n2 of nums2) {
      if (n1[2].toLowerCase() === n2[2].toLowerCase() && n1[1] !== n2[1]) {
        return { isConflict: true, reason: `Different values: ${n1[0]} vs ${n2[0]}` };
      }
    }
  }
  const versionPattern = /v?(\d+\.\d+(?:\.\d+)?)/gi;
  const vers1 = [...text1.matchAll(versionPattern)];
  const vers2 = [...text2.matchAll(versionPattern)];
  if (vers1.length > 0 && vers2.length > 0) {
    const v1 = vers1[0][1];
    const v2 = vers2[0][1];
    if (v1 !== v2) {
      return { isConflict: true, reason: `Different versions: ${v1} vs ${v2}` };
    }
  }
  return { isConflict: false, reason: "" };
}

// src/cli/commands/bootstrap.ts
import { existsSync as existsSync6 } from "node:fs";
import { mkdir as mkdir4 } from "node:fs/promises";
import { Command as Command3 } from "commander";

// src/core/reranker.ts
import { AutoModelForSequenceClassification, AutoTokenizer as AutoTokenizer2 } from "@huggingface/transformers";
var rerankerInstance = null;
var isLoading2 = false;
var loadError2 = null;
async function getReranker() {
  if (rerankerInstance) {
    return rerankerInstance;
  }
  if (isLoading2) {
    return new Promise((resolve3, reject) => {
      const checkInterval = setInterval(() => {
        if (rerankerInstance) {
          clearInterval(checkInterval);
          resolve3(rerankerInstance);
        } else if (loadError2) {
          clearInterval(checkInterval);
          reject(loadError2);
        }
      }, TIMING.MODEL_POLL_INTERVAL_MS);
    });
  }
  isLoading2 = true;
  try {
    console.error(`Loading reranker model: ${MODELS.RERANKER}...`);
    const startTime = Date.now();
    const [model, tokenizer] = await Promise.all([
      AutoModelForSequenceClassification.from_pretrained(MODELS.RERANKER, {
        cache_dir: getModelsDir()
      }),
      AutoTokenizer2.from_pretrained(MODELS.RERANKER, {
        cache_dir: getModelsDir()
      })
    ]);
    rerankerInstance = { model, tokenizer };
    const loadTime = Date.now() - startTime;
    console.error(`Reranker loaded in ${loadTime}ms`);
    return rerankerInstance;
  } catch (error) {
    loadError2 = error instanceof Error ? error : new Error(String(error));
    throw loadError2;
  } finally {
    isLoading2 = false;
  }
}
async function rerank(query, documents, topK) {
  if (documents.length === 0) {
    return [];
  }
  const { model, tokenizer } = await getReranker();
  const queries = documents.map(() => query);
  const texts = documents.map((doc) => doc.text);
  const inputs = tokenizer(queries, {
    text_pair: texts,
    padding: true,
    truncation: true,
    max_length: DEFAULTS.RERANKER_MAX_LENGTH
  });
  const output = await model(inputs);
  const logits = output.logits.data;
  const scores = Array.from(logits).map((logit) => 1 / (1 + Math.exp(-logit)));
  const ranked = documents.map((doc, idx) => ({
    id: doc.id,
    score: scores[idx]
  })).sort((a, b) => b.score - a.score);
  return topK ? ranked.slice(0, topK) : ranked;
}
function getRerankerModelName() {
  return MODELS.RERANKER;
}
async function bootstrapReranker() {
  await getReranker();
}

// src/cli/commands/bootstrap.ts
var bootstrapCommand = new Command3("bootstrap").description("Download required models and initialize DSEEK").option("-f, --force", "Force re-download even if models exist").option("--reranker", "Also download reranker model (~80MB)").option("--all", "Download all models (embedding + reranker)").action(async (options) => {
  try {
    console.log("DSEEK Bootstrap");
    console.log("===============\n");
    if (!isInitialized()) {
      console.log("Initializing project structure...");
      await initializeProject();
      console.log(`Created ${DIRS.DSEEK}/ directory
`);
    }
    const modelsDir = getModelsDir();
    if (!existsSync6(modelsDir)) {
      await mkdir4(modelsDir, { recursive: true });
    }
    const startTime = Date.now();
    if (options.all) {
      console.log("Downloading all models in parallel:");
      console.log(`  - Embedding: ${getModelName()}`);
      console.log(`  - Reranker: ${getRerankerModelName()}`);
      console.log("This may take a few minutes on first run...\n");
      try {
        await Promise.all([getEmbedder(), bootstrapReranker()]);
        const elapsed = ((Date.now() - startTime) / 1e3).toFixed(1);
        console.log(`
All models ready! (${elapsed}s)`);
      } catch (error) {
        console.error("\nFailed to download models:", error);
        process.exit(1);
      }
    } else {
      console.log(`Downloading embedding model: ${getModelName()}`);
      console.log("This may take a few minutes on first run...\n");
      try {
        await getEmbedder();
        const elapsed = ((Date.now() - startTime) / 1e3).toFixed(1);
        console.log(`
Model ready! (${elapsed}s)`);
      } catch (error) {
        console.error("\nFailed to download model:", error);
        process.exit(1);
      }
      if (options.reranker) {
        console.log(`
Downloading reranker model: ${getRerankerModelName()}`);
        console.log("This may take a few minutes...\n");
        const rerankerStart = Date.now();
        try {
          await bootstrapReranker();
          const elapsed = ((Date.now() - rerankerStart) / 1e3).toFixed(1);
          console.log(`
Reranker ready! (${elapsed}s)`);
        } catch (error) {
          console.error("\nFailed to download reranker model:", error);
          process.exit(1);
        }
      }
    }
    console.log("\nBootstrap complete!");
    console.log("-------------------");
    console.log(`Models directory: ${modelsDir}`);
    console.log(`Config: ${getDseekDir()}/config.json`);
    console.log("\nNext steps:");
    console.log("  dseek add ./docs    # Add a docs folder to index");
    console.log('  dseek search "..."  # Search your documentation');
    if (!options.reranker && !options.all) {
      console.log('\nTip: Run "dseek bootstrap --reranker" to enable --rerank option');
    }
  } catch (error) {
    console.error("Bootstrap failed:", error);
    process.exit(1);
  }
});

// src/cli/commands/chat.ts
import { Command as Command4 } from "commander";

// src/core/llm.ts
import { execSync, spawn } from "node:child_process";
function detectLanguage(text) {
  if (/[\u0400-\u04FF]/.test(text)) return "Ukrainian";
  if (/[\u4E00-\u9FFF]/.test(text)) return "Chinese";
  if (/[\u3040-\u30FF]/.test(text)) return "Japanese";
  if (/[\uAC00-\uD7AF]/.test(text)) return "Korean";
  return null;
}
function getOllamaUrl(config) {
  return process.env.OLLAMA_HOST ?? config?.runtime?.ollama_url ?? NETWORK.DEFAULT_OLLAMA_URL;
}
function isOllamaInstalled() {
  try {
    execSync("which ollama", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
async function ensureOllamaRunning() {
  if (await isOllamaAvailable()) {
    return true;
  }
  if (!isOllamaInstalled()) {
    console.error("Error: Ollama not found.");
    console.error("Install from: https://ollama.ai");
    return false;
  }
  console.log("Starting Ollama...");
  const ollamaProcess = spawn("ollama", ["serve"], {
    detached: true,
    stdio: "ignore"
  });
  ollamaProcess.unref();
  for (let i = 0; i < TIMING.OLLAMA_MAX_STARTUP_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, TIMING.OLLAMA_STARTUP_WAIT_MS));
    if (await isOllamaAvailable()) {
      console.log("Ollama started.");
      return true;
    }
  }
  console.error("Error: Could not start Ollama.");
  console.error("Try manually: ollama serve");
  return false;
}
async function ensureModelAvailable(model = MODELS.DEFAULT_LLM) {
  const models = await listModels();
  const modelBase = model.split(":")[0];
  const hasModel = models.some((m) => m.startsWith(modelBase));
  if (hasModel) {
    return true;
  }
  console.log(`Pulling model ${model}...`);
  try {
    execSync(`ollama pull ${model}`, { stdio: "inherit" });
    console.log(`Model ${model} ready.`);
    return true;
  } catch {
    console.error(`Error: Could not pull model ${model}.`);
    console.error(`Try manually: ollama pull ${model}`);
    return false;
  }
}
async function isOllamaAvailable() {
  try {
    const url = getOllamaUrl();
    const response = await fetch(`${url}/api/tags`);
    return response.ok;
  } catch {
    return false;
  }
}
async function listModels() {
  try {
    const url = getOllamaUrl();
    const response = await fetch(`${url}/api/tags`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.models?.map((m) => m.name) ?? [];
  } catch {
    return [];
  }
}
async function generate(prompt, options = {}) {
  const config = await loadConfig();
  const model = options.model ?? config.runtime.ollama_model ?? MODELS.DEFAULT_LLM;
  const url = getOllamaUrl(config);
  const response = await fetch(`${url}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: {
        temperature: options.temperature ?? DEFAULTS.LLM_TEMPERATURE,
        num_predict: options.maxTokens ?? DEFAULTS.LLM_MAX_TOKENS
      }
    })
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ollama error: ${error}`);
  }
  const data = await response.json();
  return data.response;
}
function buildRAGPrompt(query, contexts, options) {
  const contextText = contexts.map((c, i) => `[${i + 1}] Source: ${c.path} (lines ${c.line_start}-${c.line_end})
${c.snippet}`).join("\n\n");
  const exampleCitation = contexts.length > 0 ? `[1: ${contexts[0].path}:${contexts[0].line_start}-${contexts[0].line_end}]` : "[1: filename.md:10-20]";
  const language = detectLanguage(query);
  let languageRules;
  if (language) {
    if (language === "Chinese") {
      languageRules = `LANGUAGE: Respond in Chinese (\u4E2D\u6587).`;
    } else {
      languageRules = `LANGUAGE (CRITICAL):
- You MUST respond ONLY in ${language}.
- NEVER use Chinese characters (\u4E2D\u6587) in your response.
- NEVER mix languages.`;
    }
  } else {
    languageRules = `LANGUAGE (CRITICAL):
- Respond in the same language as the question.
- NEVER use Chinese characters (\u4E2D\u6587) unless the question is in Chinese.
- NEVER mix languages.`;
  }
  const citationSection = options?.noCite ? `If information is not in sources, say so briefly.` : `CITATION FORMAT:
- Cite sources as [N: file:lines], for example: ${exampleCitation}
- When combining facts from multiple sources, cite all: [1][2] or [1, 2]
- Only cite sources you actually use.
- If information is not in sources, say so briefly.`;
  return `${languageRules}

You are a documentation assistant. Answer questions based ONLY on the provided sources.

SOURCES:
${contextText}

${citationSection}

QUESTION: ${query}

ANSWER:`;
}
async function generateWithRAG(query, contexts, options = {}) {
  const prompt = buildRAGPrompt(query, contexts, { noCite: options.noCite });
  return generate(prompt, options);
}

// src/core/retrieval.ts
import { createHash as createHash3 } from "node:crypto";

// src/privacy/pii.ts
var PII_PATTERNS = [
  // Email addresses
  {
    type: "email",
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: "[EMAIL]"
  },
  // Phone numbers (international)
  {
    type: "phone",
    pattern: /\+?[0-9]{1,4}[-.\s]?\(?[0-9]{1,3}\)?[-.\s]?[0-9]{1,4}[-.\s]?[0-9]{1,9}/g,
    replacement: "[PHONE]"
  },
  // Credit card numbers
  {
    type: "credit_card",
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    replacement: "[CREDIT_CARD]"
  },
  // Social Security Numbers (US)
  {
    type: "ssn",
    pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    replacement: "[SSN]"
  },
  // JWT tokens
  {
    type: "jwt",
    pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
    replacement: "[JWT]"
  },
  // API keys (common patterns)
  {
    type: "api_key",
    pattern: /\b(sk|pk|api|key|token|secret|password)[_-]?[a-zA-Z0-9]{20,}\b/gi,
    replacement: "[API_KEY]"
  },
  // AWS keys
  {
    type: "aws_key",
    pattern: /\b(AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}\b/g,
    replacement: "[AWS_KEY]"
  },
  // Private keys
  {
    type: "private_key",
    pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(RSA\s+)?PRIVATE\s+KEY-----/g,
    replacement: "[PRIVATE_KEY]"
  },
  // IP addresses (v4)
  {
    type: "ip_address",
    pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    replacement: "[IP_ADDRESS]"
  },
  // Passwords in common formats
  {
    type: "password",
    pattern: /(?:password|passwd|pwd)\s*[:=]\s*["']?[^\s"']+["']?/gi,
    replacement: "[PASSWORD]"
  }
];
function detectPII(text) {
  const matches = [];
  for (const { type, pattern } of PII_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      matches.push({
        type,
        value: match[0],
        start: match.index,
        end: match.index + match[0].length
      });
    }
  }
  return matches.sort((a, b) => a.start - b.start);
}
function redactPII(text) {
  const matches = detectPII(text);
  if (matches.length === 0) {
    return { text, matches: [], redacted: false };
  }
  let redactedText = text;
  let offset = 0;
  for (const match of matches) {
    const replacement = PII_PATTERNS.find((p) => p.type === match.type)?.replacement ?? "[REDACTED]";
    const adjustedStart = match.start + offset;
    const adjustedEnd = match.end + offset;
    redactedText = redactedText.substring(0, adjustedStart) + replacement + redactedText.substring(adjustedEnd);
    offset += replacement.length - (match.end - match.start);
  }
  return {
    text: redactedText,
    matches,
    redacted: true
  };
}

// src/core/retrieval.ts
function encodeCursor(data) {
  return Buffer.from(JSON.stringify(data)).toString("base64");
}
function decodeCursor(cursor) {
  try {
    const json = Buffer.from(cursor, "base64").toString("utf-8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}
function hashQuery(query) {
  return createHash3("sha256").update(query).digest("hex").substring(0, 16);
}
function calculateConfidence(results, total) {
  if (results.length === 0) return 0;
  const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
  const normalizedScore = Math.min(avgScore, 1);
  const countFactor = Math.min(total / CONFIDENCE.COUNT_NORMALIZATION, 1);
  return Number((normalizedScore * CONFIDENCE.SCORE_WEIGHT + countFactor * CONFIDENCE.COUNT_WEIGHT).toFixed(2));
}
async function search2(query) {
  const startTime = Date.now();
  const config = await loadConfig();
  const limit = Math.min(query.limit ?? config.retrieval.default_limit, config.retrieval.max_limit);
  let offset = 0;
  if (query.cursor) {
    const cursorData = decodeCursor(query.cursor);
    if (cursorData && cursorData.query_hash === hashQuery(query.query)) {
      offset = cursorData.offset;
    }
  }
  const queryEmbedding = await embed(query.query);
  const searchLimit = limit;
  const { results: rawResults, total } = await searchIndex(query.query, queryEmbedding, {
    limit: searchLimit,
    offset,
    semanticWeight: config.retrieval.semantic_weight,
    keywordWeight: config.retrieval.keyword_weight
  });
  const searchTime = Date.now() - startTime;
  let results = rawResults;
  let rerankingTime;
  if (query.rerank && rawResults.length > 0) {
    const rerankStart = Date.now();
    try {
      const rerankInput = rawResults.map((r) => ({
        id: r.chunk_id,
        text: r.snippet
      }));
      const reranked = await rerank(query.query, rerankInput);
      const scoreMap = new Map(reranked.map((r) => [r.id, r.score]));
      results = rawResults.filter((r) => scoreMap.has(r.chunk_id)).map((r) => {
        const rerankScore = scoreMap.get(r.chunk_id) ?? 0;
        const hybridScore = r.score;
        return {
          ...r,
          score: hybridScore * RERANK_FUSION.HYBRID_WEIGHT + rerankScore * RERANK_FUSION.RERANK_WEIGHT
        };
      }).sort((a, b) => b.score - a.score).slice(0, limit);
      rerankingTime = Date.now() - rerankStart;
    } catch (error) {
      console.error("Reranking failed, using original results:", error);
      results = rawResults.slice(0, limit);
    }
  }
  let nextCursor = null;
  if (offset + results.length < total && config.retrieval.pagination.enabled) {
    const cursorData = {
      query_hash: hashQuery(query.query),
      offset: offset + limit,
      index_version: await getIndexVersion()
    };
    nextCursor = encodeCursor(cursorData);
  }
  let piiRedacted = false;
  const redactedResults = results.map((r) => {
    const redaction = redactPII(r.snippet);
    if (redaction.redacted) piiRedacted = true;
    return { ...r, snippet: redaction.text };
  });
  return {
    schema_version: 1,
    project_id: config.project_id,
    query: query.query,
    index_state: "ready",
    confidence: calculateConfidence(results, total),
    results: redactedResults,
    next_cursor: nextCursor,
    pii_redacted: piiRedacted,
    timing_ms: {
      search: searchTime,
      reranking: rerankingTime
    }
  };
}
async function getStatus() {
  const config = await loadConfig();
  const stats = await getIndexStats();
  const lastEvent = await getLastEvent();
  const documentCount = await getDocumentCount();
  return {
    schema_version: 1,
    project_id: config.project_id,
    index_state: "ready",
    queued_files: 0,
    documents: documentCount,
    chunks: stats.chunks,
    last_event: lastEvent,
    warnings: []
  };
}

// src/cli/commands/chat.ts
var chatCommand = new Command4("chat").description("Chat with your documentation using local LLM").argument("<query>", "Your question").option("-m, --model <model>", "Ollama model to use").option("-k, --top-k <number>", "Number of context chunks", String(DEFAULTS.CHAT_TOP_K)).option("-t, --temperature <number>", "Generation temperature", String(DEFAULTS.LLM_TEMPERATURE)).option("--show-context", "Show retrieved context chunks").option("--show-prompt", "Show the prompt sent to LLM").option("--rerank", "Use cross-encoder reranking for better context").option("--no-cite", "Disable source citations in response").option("--json", "Output as JSON").action(async (query, options) => {
  try {
    const ollamaReady = await ensureOllamaRunning();
    if (!ollamaReady) {
      process.exit(1);
    }
    const model = options.model ?? MODELS.DEFAULT_LLM;
    const modelReady = await ensureModelAvailable(model);
    if (!modelReady) {
      process.exit(1);
    }
    const topK = parseInt(options.topK, 10);
    const searchResult = await search2({
      query,
      limit: topK,
      rerank: options.rerank ?? false
    });
    if (searchResult.results.length === 0) {
      const response = {
        query,
        answer: "No relevant documentation found for your question.",
        context: [],
        model
      };
      if (options.json) {
        console.log(JSON.stringify(response, null, 2));
      } else {
        console.log(response.answer);
      }
      return;
    }
    const contexts = searchResult.results.map((r) => ({
      path: r.path,
      line_start: r.line_start,
      line_end: r.line_end,
      snippet: r.snippet,
      score: r.score
    }));
    if (options.showContext && !options.json) {
      console.log("Retrieved context:");
      console.log("\u2500".repeat(UI.SEPARATOR_WIDTH));
      for (const ctx of contexts) {
        console.log(`[${ctx.path}:${ctx.line_start}-${ctx.line_end}] (score: ${ctx.score.toFixed(3)})`);
        console.log(ctx.snippet);
        console.log("\u2500".repeat(UI.SEPARATOR_WIDTH));
      }
    }
    if (options.showPrompt && !options.json) {
      const prompt = buildRAGPrompt(query, contexts);
      console.log("\nPrompt sent to LLM:");
      console.log("\u2500".repeat(UI.SEPARATOR_WIDTH));
      console.log(prompt);
      console.log("\u2500".repeat(UI.SEPARATOR_WIDTH));
    }
    if ((options.showContext || options.showPrompt) && !options.json) {
      console.log("\nGenerating answer...\n");
    }
    const temperature = parseFloat(options.temperature);
    const startTime = Date.now();
    const answer = await generateWithRAG(query, contexts, {
      model,
      temperature,
      noCite: !options.cite
    });
    const genTime = ((Date.now() - startTime) / 1e3).toFixed(1);
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            query,
            answer,
            context: contexts,
            model,
            confidence: searchResult.confidence,
            generation_time_s: parseFloat(genTime)
          },
          null,
          2
        )
      );
    } else {
      console.log(answer);
      console.error(`
Answer generated in ${genTime}s`);
    }
  } catch (error) {
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            error: error instanceof Error ? error.message : String(error)
          },
          null,
          2
        )
      );
    } else {
      console.error("Error:", error instanceof Error ? error.message : error);
    }
    process.exit(1);
  }
});

// src/cli/commands/delete.ts
import { Command as Command5 } from "commander";
var deleteCommand = new Command5("delete").description("Remove a document from the index").argument("<path>", "Document path or ID to delete").option("-f, --force", "Skip confirmation").action(async (path, options) => {
  try {
    if (!options.force) {
      console.log(`About to delete: ${path}`);
      console.log("Use --force to skip this confirmation.");
      const readline = await import("node:readline");
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      const answer = await new Promise((resolve3) => {
        rl.question("Continue? (y/N) ", resolve3);
      });
      rl.close();
      if (answer.toLowerCase() !== "y") {
        console.log("Cancelled.");
        return;
      }
    }
    const deleted = await deleteDocument(path);
    if (deleted) {
      console.log(`Deleted: ${path}`);
    } else {
      console.log(`Document not found: ${path}`);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});

// src/cli/commands/list.ts
import { Command as Command6 } from "commander";
var listCommand = new Command6("list").description("List indexed documents").option("--json", "Output as JSON").option("-s, --sort <field>", "Sort by field (path, size, updated)", "path").action(async (options) => {
  try {
    const documents = await getAllDocuments();
    const sorted = [...documents].sort((a, b) => {
      switch (options.sort) {
        case "size":
          return b.size_bytes - a.size_bytes;
        case "updated":
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        default:
          return a.doc_id.localeCompare(b.doc_id);
      }
    });
    if (options.json) {
      console.log(JSON.stringify(sorted, null, 2));
      return;
    }
    if (sorted.length === 0) {
      console.log("No documents indexed.");
      console.log("Run `dseek add <path>` to index documents.");
      return;
    }
    console.log(`Indexed Documents (${sorted.length}):`);
    console.log("\u2500".repeat(UI.LIST_SEPARATOR_WIDTH));
    for (const doc of sorted) {
      const sizeKB = (doc.size_bytes / 1024).toFixed(1);
      const updated = new Date(doc.updated_at).toLocaleString();
      console.log(`${doc.doc_id}`);
      console.log(`  Format: ${doc.format} | Size: ${sizeKB} KB | Updated: ${updated}`);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});

// src/cli/commands/search.ts
import { readFileSync } from "node:fs";
import { Command as Command7 } from "commander";
var searchCommand = new Command7("search").description("Search indexed documents").argument("<query>", "Search query").option("-l, --limit <number>", "Maximum results", String(LIMITS.DEFAULT_RESULTS)).option("-c, --cursor <cursor>", "Pagination cursor").option("--batch <file>", "Batch search from file (one query per line)").option("--rerank", "Enable cross-encoder reranking (slower, more accurate)").option("--rerank-top-k <number>", "Number of candidates to rerank", String(LIMITS.DEFAULT_RERANK_TOP_K)).option("--pretty", "Pretty print JSON output").action(async (query, options) => {
  try {
    if (options.batch) {
      const queries = readFileSync(options.batch, "utf-8").split("\n").filter((line) => line.trim().length > 0);
      const results = [];
      for (const q of queries) {
        const searchQuery2 = {
          query: q,
          limit: parseInt(options.limit, 10),
          rerank: options.rerank ?? false,
          rerank_top_k: options.rerank ? parseInt(options.rerankTopK, 10) : void 0
        };
        const result2 = await search2(searchQuery2);
        results.push(result2);
      }
      outputJSON(results, options.pretty);
      return;
    }
    const searchQuery = {
      query,
      limit: parseInt(options.limit, 10),
      cursor: options.cursor,
      rerank: options.rerank ?? false,
      rerank_top_k: options.rerank ? parseInt(options.rerankTopK, 10) : void 0
    };
    const result = await search2(searchQuery);
    outputJSON(result, options.pretty);
  } catch (error) {
    const errorResponse = {
      error: error instanceof Error ? error.message : String(error)
    };
    outputJSON(errorResponse, options.pretty);
    process.exit(1);
  }
});
function outputJSON(data, pretty) {
  if (pretty) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(JSON.stringify(data));
  }
}

// src/cli/commands/status.ts
import { Command as Command8 } from "commander";
var statusCommand = new Command8("status").description("Show index status").option("--json", "Output as JSON").action(async (options) => {
  try {
    const status = await getStatus();
    if (options.json) {
      console.log(JSON.stringify(status, null, 2));
      return;
    }
    console.log("DSEEK Index Status");
    console.log("==================");
    console.log(`Project ID: ${status.project_id}`);
    console.log(`State: ${status.index_state}`);
    console.log(`Documents: ${status.documents}`);
    console.log(`Chunks: ${status.chunks}`);
    console.log(`Queued files: ${status.queued_files}`);
    if (status.last_event) {
      console.log(`
Last event:`);
      console.log(`  Type: ${status.last_event.type}`);
      console.log(`  Path: ${status.last_event.path}`);
      console.log(`  At: ${status.last_event.at}`);
    }
    if (status.warnings.length > 0) {
      console.log(`
Warnings:`);
      for (const w of status.warnings) {
        console.log(`  - ${w}`);
      }
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});

// src/cli/commands/watch.ts
import { Command as Command9 } from "commander";

// src/core/watcher.ts
import { existsSync as existsSync7, readFileSync as readFileSync2, unlinkSync, writeFileSync } from "node:fs";
import { join as join5, relative as relative3 } from "node:path";
import chokidar from "chokidar";
var state = {
  watcher: null,
  projectRoot: "",
  ignorePatterns: [],
  pendingChanges: /* @__PURE__ */ new Map(),
  isShuttingDown: false
};
function getRunDir() {
  return join5(getDseekDir(), DIRS.RUN);
}
function isWatcherRunning() {
  const lockPath = join5(getRunDir(), FILES.WATCH_LOCK);
  if (!existsSync7(lockPath)) {
    return false;
  }
  const pidPath = join5(getRunDir(), FILES.WATCH_PID);
  if (existsSync7(pidPath)) {
    try {
      const pid = parseInt(readFileSync2(pidPath, "utf-8").trim(), 10);
      process.kill(pid, 0);
      return true;
    } catch {
      cleanupLockFiles();
      return false;
    }
  }
  return false;
}
function cleanupLockFiles() {
  const lockPath = join5(getRunDir(), FILES.WATCH_LOCK);
  const pidPath = join5(getRunDir(), FILES.WATCH_PID);
  try {
    if (existsSync7(lockPath)) unlinkSync(lockPath);
    if (existsSync7(pidPath)) unlinkSync(pidPath);
  } catch {
  }
}
function createLockFiles() {
  const runDir = getRunDir();
  const { mkdirSync } = __require("node:fs");
  if (!existsSync7(runDir)) {
    mkdirSync(runDir, { recursive: true });
  }
  writeFileSync(join5(runDir, FILES.WATCH_LOCK), (/* @__PURE__ */ new Date()).toISOString());
  writeFileSync(join5(runDir, FILES.WATCH_PID), process.pid.toString());
}
function shouldIgnore2(filePath) {
  const relativePath = relative3(state.projectRoot, filePath);
  if (relativePath.includes("/.") || relativePath.startsWith(".")) {
    return true;
  }
  if (relativePath.includes(DIRS.DSEEK)) {
    return true;
  }
  for (const pattern of state.ignorePatterns) {
    if (pattern.endsWith("/")) {
      if (relativePath.includes(pattern.slice(0, -1))) return true;
    } else if (relativePath.includes(pattern)) {
      return true;
    }
  }
  return false;
}
function handleChange(eventType, filePath) {
  if (state.isShuttingDown) return;
  if (shouldIgnore2(filePath)) return;
  if (eventType !== "unlink" && !isSupported(filePath)) return;
  const existing = state.pendingChanges.get(filePath);
  if (existing) {
    clearTimeout(existing);
  }
  const timeout = setTimeout(async () => {
    state.pendingChanges.delete(filePath);
    try {
      const relativePath = relative3(state.projectRoot, filePath);
      if (eventType === "unlink") {
        console.log(`[${(/* @__PURE__ */ new Date()).toISOString()}] Removed: ${relativePath}`);
        await deleteDocument(filePath, state.projectRoot);
      } else {
        console.log(`[${(/* @__PURE__ */ new Date()).toISOString()}] ${eventType === "add" ? "Added" : "Updated"}: ${relativePath}`);
        const result = await indexFile(filePath, state.projectRoot);
        if (result.success && result.chunks && result.chunks > 0) {
          console.log(`  Indexed ${result.chunks} chunks`);
        } else if (!result.success) {
          console.error(`  Error: ${result.error}`);
        }
      }
      await saveIndex();
      await saveMetadata();
    } catch (error) {
      console.error(`Error processing ${filePath}:`, error);
    }
  }, TIMING.WATCH_DEBOUNCE_MS);
  state.pendingChanges.set(filePath, timeout);
}
async function startWatcher(projectRoot) {
  if (state.watcher) {
    throw new Error("Watcher is already running");
  }
  if (isWatcherRunning()) {
    throw new Error("Another watcher instance is already running");
  }
  state.projectRoot = projectRoot ?? findProjectRoot();
  const config = await loadConfig(state.projectRoot);
  state.ignorePatterns = await loadIgnorePatterns(state.projectRoot);
  const watchPaths = config.sources.map((s) => s.path.startsWith("/") ? s.path : join5(state.projectRoot, s.path));
  if (watchPaths.length === 0) {
    throw new Error("No sources configured. Run `dseek add <path>` first.");
  }
  createLockFiles();
  state.watcher = chokidar.watch(watchPaths, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: TIMING.WATCH_DEBOUNCE_MS,
      pollInterval: TIMING.WATCHER_POLL_INTERVAL_MS
    },
    ignored: (path) => shouldIgnore2(path)
  });
  state.watcher.on("add", (path) => handleChange("add", path)).on("change", (path) => handleChange("change", path)).on("unlink", (path) => handleChange("unlink", path)).on("error", (error) => console.error("Watcher error:", error));
  console.log(`Watching ${watchPaths.length} source(s) for changes...`);
  console.log("Press Ctrl+C to stop.\n");
  const shutdown = async () => {
    if (state.isShuttingDown) return;
    state.isShuttingDown = true;
    console.log("\nShutting down watcher...");
    for (const timeout of state.pendingChanges.values()) {
      clearTimeout(timeout);
    }
    state.pendingChanges.clear();
    if (state.watcher) {
      await state.watcher.close();
      state.watcher = null;
    }
    cleanupLockFiles();
    console.log("Watcher stopped.");
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// src/cli/commands/watch.ts
var watchCommand = new Command9("watch").description("Watch source folders for changes and auto-index").option("--check", "Check if watcher is running").action(async (options) => {
  try {
    if (options.check) {
      const running = isWatcherRunning();
      console.log(running ? "Watcher is running" : "Watcher is not running");
      process.exit(running ? 0 : 1);
    }
    let projectRoot;
    try {
      projectRoot = findProjectRoot();
    } catch {
      console.error("Error: No dseek project found.");
      console.error("Run `dseek add <path>` to initialize and add sources.");
      process.exit(1);
    }
    if (isWatcherRunning()) {
      console.error("Error: Watcher is already running.");
      console.error("Use --check to verify status.");
      process.exit(1);
    }
    await startWatcher(projectRoot);
    await new Promise(() => {
    });
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});

// src/cli/index.ts
var VERSION = true ? "1.0.0" : "1.0.0";
function createCLI() {
  const program = new Command10();
  program.name("dseek").description("Local documentation search with hybrid retrieval for Claude Code").version(VERSION);
  program.addCommand(bootstrapCommand);
  program.addCommand(addCommand);
  program.addCommand(searchCommand);
  program.addCommand(chatCommand);
  program.addCommand(statusCommand);
  program.addCommand(listCommand);
  program.addCommand(deleteCommand);
  program.addCommand(auditCommand);
  program.addCommand(watchCommand);
  return program;
}
async function runCLI(args = process.argv) {
  const program = createCLI();
  await program.parseAsync(args);
}

// bin/dseek.ts
runCLI().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
