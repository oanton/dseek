/**
 * Plain text parser
 *
 * Simple passthrough parser for .txt files.
 *
 * @module parsers/text
 */

import type { ParsedDocument } from '../types/index.js';

/**
 * Parse a plain text file.
 *
 * @param content - File content as buffer
 * @param _filePath - File path (unused)
 * @returns Parsed document with text and line count
 */
export async function parseText(content: Buffer, _filePath: string): Promise<ParsedDocument> {
  const text = content.toString('utf-8');
  const lines = text.split('\n').length;

  return {
    content: text,
    metadata: {
      lines,
    },
  };
}
