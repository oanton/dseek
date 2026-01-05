/**
 * Document chunking strategies
 *
 * Splits documents into semantic chunks for embedding and retrieval.
 * Supports markdown-aware chunking and fixed-size fallback.
 *
 * @module chunker
 */

import { createHash } from 'node:crypto';
import { extractSections } from '../parsers/markdown.js';
import type { Chunk, ChunkingConfig, DocumentFormat } from '../types/index.js';
import { LIMITS, TEXT_PROCESSING } from './constants.js';

const DEFAULT_CONFIG: ChunkingConfig = {
  strategy: 'markdown-structure',
  fallback: {
    chunk_size: LIMITS.DEFAULT_CHUNK_SIZE,
    overlap: LIMITS.DEFAULT_CHUNK_OVERLAP,
  },
};

export interface ChunkOptions {
  docId: string;
  format: DocumentFormat;
  config?: ChunkingConfig;
}

/**
 * Generate content hash (first 8 chars of SHA256)
 */
export function generateContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').substring(0, 8);
}

/**
 * Generate chunk ID
 */
export function generateChunkId(docId: string, lineStart: number, lineEnd: number, hash: string): string {
  return `${docId}:${lineStart}-${lineEnd}:${hash}`;
}

/**
 * Create a preview snippet from text.
 *
 * Truncates at sentence or word boundaries for readability.
 *
 * @param text - Full text content
 * @param maxLength - Maximum snippet length (default 500)
 * @returns Truncated text with ellipsis if needed
 *
 * @example
 * ```ts
 * const snippet = createSnippet(longText, 200);
 * ```
 */
export function createSnippet(text: string, maxLength: number = LIMITS.MAX_SNIPPET_LENGTH): string {
  if (text.length <= maxLength) {
    return text;
  }

  // Try to cut at a sentence boundary
  const truncated = text.substring(0, maxLength);
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf('.\n'),
    truncated.lastIndexOf('? '),
    truncated.lastIndexOf('! '),
  );

  if (lastSentenceEnd > maxLength * TEXT_PROCESSING.SENTENCE_BOUNDARY_RATIO) {
    return truncated.substring(0, lastSentenceEnd + 1).trim();
  }

  // Fall back to word boundary
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength * TEXT_PROCESSING.WORD_BOUNDARY_RATIO) {
    return `${truncated.substring(0, lastSpace).trim()}...`;
  }

  return `${truncated.trim()}...`;
}

/**
 * Chunk document using appropriate strategy.
 *
 * Uses markdown-structure for .md files, fixed-size for others.
 *
 * @param content - Document text content
 * @param options - Chunking options (docId, format, config)
 * @returns Array of chunks without embeddings
 *
 * @example
 * ```ts
 * const chunks = chunkDocument(markdownContent, {
 *   docId: "docs/api.md",
 *   format: "md",
 *   config: { strategy: "markdown-structure" }
 * });
 * ```
 */
export function chunkDocument(content: string, options: ChunkOptions): Omit<Chunk, 'embedding'>[] {
  const { docId, format, config = DEFAULT_CONFIG } = options;

  // Use markdown structure for markdown files
  if (format === 'md' && config.strategy === 'markdown-structure') {
    return chunkMarkdownStructure(content, docId);
  }

  // Fallback to fixed-size chunking
  return chunkFallback(content, docId, config.fallback);
}

/**
 * Chunk markdown by structure (headers)
 */
function chunkMarkdownStructure(content: string, docId: string): Omit<Chunk, 'embedding'>[] {
  const sections = extractSections(content);
  const chunks: Omit<Chunk, 'embedding'>[] = [];

  for (const section of sections) {
    // Skip empty sections
    const trimmedContent = section.content.trim();
    if (!trimmedContent) continue;

    // If section is too large, split it further
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
        line_end: section.endLine,
      });
    }
  }

  return chunks;
}

/**
 * Split a large section into smaller chunks
 */
function splitLargeSection(
  content: string,
  docId: string,
  startLine: number,
  heading: string | null,
): Omit<Chunk, 'embedding'>[] {
  const chunks: Omit<Chunk, 'embedding'>[] = [];
  const lines = content.split('\n');
  const paragraphs: Array<{ text: string; startLine: number; endLine: number }> = [];

  let currentParagraph = '';
  let paragraphStart = startLine;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = startLine + i;

    if (line.trim() === '') {
      if (currentParagraph.trim()) {
        paragraphs.push({
          text: currentParagraph.trim(),
          startLine: paragraphStart,
          endLine: lineNum - 1,
        });
        currentParagraph = '';
      }
      paragraphStart = lineNum + 1;
    } else {
      if (!currentParagraph) {
        paragraphStart = lineNum;
      }
      currentParagraph += `${line}\n`;
    }
  }

  // Add last paragraph
  if (currentParagraph.trim()) {
    paragraphs.push({
      text: currentParagraph.trim(),
      startLine: paragraphStart,
      endLine: startLine + lines.length - 1,
    });
  }

  // Merge paragraphs into chunks of appropriate size
  let currentChunk = heading ? `# ${heading}\n\n` : '';
  let chunkStartLine = paragraphs[0]?.startLine ?? startLine;
  let chunkEndLine = chunkStartLine;

  for (const para of paragraphs) {
    if (currentChunk.length + para.text.length > LIMITS.DEFAULT_CHUNK_SIZE && currentChunk.length > 0) {
      // Save current chunk
      const hash = generateContentHash(currentChunk);
      const chunkId = generateChunkId(docId, chunkStartLine, chunkEndLine, hash);

      chunks.push({
        chunk_id: chunkId,
        doc_id: docId,
        text: currentChunk.trim(),
        snippet: createSnippet(currentChunk.trim()),
        line_start: chunkStartLine,
        line_end: chunkEndLine,
      });

      // Start new chunk (include overlap from context)
      currentChunk = `${para.text}\n\n`;
      chunkStartLine = para.startLine;
    } else {
      currentChunk += `${para.text}\n\n`;
    }
    chunkEndLine = para.endLine;
  }

  // Save last chunk
  if (currentChunk.trim()) {
    const hash = generateContentHash(currentChunk);
    const chunkId = generateChunkId(docId, chunkStartLine, chunkEndLine, hash);

    chunks.push({
      chunk_id: chunkId,
      doc_id: docId,
      text: currentChunk.trim(),
      snippet: createSnippet(currentChunk.trim()),
      line_start: chunkStartLine,
      line_end: chunkEndLine,
    });
  }

  return chunks;
}

/**
 * Fallback chunking with fixed size and overlap
 */
function chunkFallback(
  content: string,
  docId: string,
  config: { chunk_size: number; overlap: number },
): Omit<Chunk, 'embedding'>[] {
  const chunkSize = config.chunk_size || LIMITS.DEFAULT_CHUNK_SIZE;
  const overlap = config.overlap || LIMITS.DEFAULT_CHUNK_OVERLAP;
  const chunks: Omit<Chunk, 'embedding'>[] = [];
  const lines = content.split('\n');

  let currentChunk = '';
  let chunkStartLine = 1;
  let chunkEndLine = 1;
  let charCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    currentChunk += `${line}\n`;
    charCount += line.length + 1;
    chunkEndLine = lineNum;

    if (charCount >= chunkSize) {
      // Create chunk
      const text = currentChunk.trim();
      if (text) {
        const hash = generateContentHash(text);
        const chunkId = generateChunkId(docId, chunkStartLine, chunkEndLine, hash);

        chunks.push({
          chunk_id: chunkId,
          doc_id: docId,
          text,
          snippet: createSnippet(text),
          line_start: chunkStartLine,
          line_end: chunkEndLine,
        });
      }

      // Calculate overlap
      const overlapLines = [];
      let overlapCharCount = 0;
      for (let j = i; j >= 0 && overlapCharCount < overlap; j--) {
        overlapLines.unshift(lines[j]);
        overlapCharCount += lines[j].length + 1;
        chunkStartLine = j + 1;
      }

      currentChunk = `${overlapLines.join('\n')}\n`;
      charCount = overlapCharCount;
    }
  }

  // Add last chunk
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
      line_end: chunkEndLine,
    });
  }

  return chunks;
}

/**
 * Estimate number of chunks for a document.
 *
 * @param contentLength - Document content length in characters
 * @param chunkSize - Target chunk size (default 900)
 * @returns Estimated chunk count
 */
export function estimateChunkCount(contentLength: number, chunkSize: number = LIMITS.DEFAULT_CHUNK_SIZE): number {
  if (contentLength <= chunkSize) return 1;
  return Math.ceil(contentLength / (chunkSize - LIMITS.DEFAULT_CHUNK_OVERLAP));
}
