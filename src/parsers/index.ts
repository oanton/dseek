/**
 * Parser factory for document processing
 *
 * Routes documents to appropriate parsers based on file extension.
 * Supports markdown, text, HTML, PDF, and DOCX formats.
 *
 * @module parsers
 */

import { LIMITS } from '../core/constants.js';
import type { DocumentFormat, ParsedDocument } from '../types/index.js';
import { parseDocx } from './docx.js';
import { parseHtml } from './html.js';
import { parseMarkdown } from './markdown.js';
import { parsePdf } from './pdf.js';
import { parseText } from './text.js';

export type Parser = (content: Buffer, filePath: string) => Promise<ParsedDocument>;

const PARSERS: Record<DocumentFormat, Parser> = {
  md: parseMarkdown,
  txt: parseText,
  html: parseHtml,
  pdf: parsePdf,
  docx: parseDocx,
};

const EXTENSION_MAP: Record<string, DocumentFormat> = {
  '.md': 'md',
  '.markdown': 'md',
  '.txt': 'txt',
  '.text': 'txt',
  '.html': 'html',
  '.htm': 'html',
  '.pdf': 'pdf',
  '.docx': 'docx',
};

/**
 * Get document format from file extension.
 *
 * @param filePath - Path to the file
 * @returns Document format or null if unsupported
 *
 * @example
 * ```ts
 * getFormat("docs/api.md") // "md"
 * getFormat("data.json")   // null
 * ```
 */
export function getFormat(filePath: string): DocumentFormat | null {
  const ext = filePath.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (!ext) return null;
  return EXTENSION_MAP[ext] ?? null;
}

/**
 * Check if file format is supported for indexing.
 *
 * @param filePath - Path to the file
 * @returns True if file can be parsed and indexed
 */
export function isSupported(filePath: string): boolean {
  return getFormat(filePath) !== null;
}

/**
 * Get parser function for a document format.
 *
 * @param format - Document format (md, txt, html, pdf, docx)
 * @returns Parser function for the format
 */
export function getParser(format: DocumentFormat): Parser {
  return PARSERS[format];
}

/**
 * Parse a document file to extract text content.
 *
 * @param content - File content as buffer
 * @param filePath - Path to the file (for format detection)
 * @returns Parsed document with text and metadata
 * @throws Error if format unsupported or file too large
 *
 * @example
 * ```ts
 * const buffer = await readFile("docs/api.md");
 * const parsed = await parseDocument(buffer, "docs/api.md");
 * console.log(parsed.content);
 * ```
 */
export async function parseDocument(content: Buffer, filePath: string): Promise<ParsedDocument> {
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

/**
 * Get list of supported file extensions.
 *
 * @returns Array of extensions (e.g., [".md", ".txt", ".pdf"])
 */
export function getSupportedExtensions(): string[] {
  return Object.keys(EXTENSION_MAP);
}

/**
 * Create glob patterns for supported files.
 *
 * @returns Array of glob patterns (e.g., ["**\/*.md", "**\/*.pdf"])
 */
export function getSupportedGlobs(): string[] {
  return Object.keys(EXTENSION_MAP).map((ext) => `**/*${ext}`);
}

export { parseDocx } from './docx.js';
export { parseHtml } from './html.js';
export { parseMarkdown } from './markdown.js';
export { parsePdf } from './pdf.js';
export { parseText } from './text.js';
