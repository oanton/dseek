/**
 * PDF parser using pdf-parse
 *
 * Extracts text content and metadata from PDF files.
 *
 * @module parsers/pdf
 */

import pdf from 'pdf-parse';
import type { ParsedDocument } from '../types/index.js';

/**
 * Parse a PDF file and extract text content.
 *
 * @param content - File content as buffer
 * @param _filePath - File path (unused)
 * @returns Parsed document with text and page count
 * @throws Error if PDF parsing fails
 */
export async function parsePdf(content: Buffer, _filePath: string): Promise<ParsedDocument> {
  try {
    const data = await pdf(content);

    // Get text and normalize whitespace
    const text = data.text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n');

    return {
      content: text,
      metadata: {
        pages: data.numpages,
      },
    };
  } catch (error) {
    throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract text from a specific page range.
 *
 * @param content - File content as buffer
 * @param startPage - First page to extract (1-based)
 * @param endPage - Last page to extract
 * @returns Extracted text from page range
 */
export async function parsePdfPages(content: Buffer, startPage: number, endPage: number): Promise<string> {
  const options = {
    max: endPage,
    pagerender: (pageData: {
      pageNumber: number;
      getTextContent: () => Promise<{ items: Array<{ str: string }> }>;
    }) => {
      if (pageData.pageNumber < startPage) {
        return '';
      }
      return pageData.getTextContent().then((textContent) => textContent.items.map((item) => item.str).join(' '));
    },
  };

  const data = await pdf(content, options);
  return data.text;
}

/**
 * Get PDF metadata.
 *
 * @param content - File content as buffer
 * @returns Metadata including pages, title, author, subject, keywords
 */
export async function getPdfMetadata(content: Buffer): Promise<{
  pages: number;
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
}> {
  const data = await pdf(content);

  return {
    pages: data.numpages,
    title: data.info?.Title,
    author: data.info?.Author,
    subject: data.info?.Subject,
    keywords: data.info?.Keywords,
  };
}
