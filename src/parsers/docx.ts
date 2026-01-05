/**
 * DOCX parser using mammoth
 *
 * Extracts text from Word documents, converting to markdown.
 *
 * @module parsers/docx
 */

import mammoth from 'mammoth';
import type { ParsedDocument } from '../types/index.js';

/**
 * Parse a DOCX file and extract text as markdown.
 *
 * @param content - File content as buffer
 * @param _filePath - File path (unused)
 * @returns Parsed document with markdown content and line count
 * @throws Error if DOCX parsing fails
 */
export async function parseDocx(content: Buffer, _filePath: string): Promise<ParsedDocument> {
  try {
    // Convert to markdown for better structure preservation
    const result = await mammoth.convertToMarkdown({ buffer: content });

    if (result.messages.length > 0) {
      // Log warnings but don't fail
      for (const msg of result.messages) {
        if (msg.type === 'warning') {
          console.warn(`DOCX warning: ${msg.message}`);
        }
      }
    }

    const text = result.value.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');

    const lines = text.split('\n').length;

    return {
      content: text,
      metadata: {
        lines,
      },
    };
  } catch (error) {
    throw new Error(`Failed to parse DOCX: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract raw text from DOCX without formatting.
 *
 * @param content - File content as buffer
 * @returns Plain text content
 */
export async function parseDocxRaw(content: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer: content });
  return result.value;
}

/**
 * Convert DOCX to HTML.
 *
 * @param content - File content as buffer
 * @returns HTML content
 */
export async function parseDocxToHtml(content: Buffer): Promise<string> {
  const result = await mammoth.convertToHtml({ buffer: content });
  return result.value;
}

/**
 * Get DOCX document properties.
 *
 * @param content - File content as buffer
 * @returns Metadata with hasImages, hasTables, and warnings
 */
export async function getDocxMetadata(content: Buffer): Promise<{
  hasImages: boolean;
  hasTables: boolean;
  warnings: string[];
}> {
  const result = await mammoth.convertToMarkdown({ buffer: content });

  const hasImages = result.value.includes('![');
  const hasTables = result.value.includes('|');
  const warnings = result.messages.filter((m) => m.type === 'warning').map((m) => m.message);

  return {
    hasImages,
    hasTables,
    warnings,
  };
}
