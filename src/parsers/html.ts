/**
 * HTML parser using cheerio
 *
 * Extracts text content from HTML with structure preservation.
 *
 * @module parsers/html
 */

import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import type { ParsedDocument } from '../types/index.js';

/**
 * Parse an HTML file and extract text content.
 *
 * Removes scripts, styles, and hidden elements.
 * Converts headings to markdown format.
 *
 * @param content - File content as buffer
 * @param _filePath - File path (unused)
 * @returns Parsed document with text and line count
 */
export async function parseHtml(content: Buffer, _filePath: string): Promise<ParsedDocument> {
  const html = content.toString('utf-8');
  const $ = cheerio.load(html);

  // Remove script and style elements
  $('script, style, noscript, iframe, svg').remove();

  // Remove hidden elements
  $('[hidden], [style*="display: none"], [style*="display:none"]').remove();

  // Extract text from body or whole document
  const body = $('body').length ? $('body') : $.root();

  // Get text content with basic structure preservation
  const text = extractTextWithStructure($, body);
  const lines = text.split('\n').length;

  return {
    content: text,
    metadata: {
      lines,
    },
  };
}

/**
 * Extract text with basic structure preservation
 */
function extractTextWithStructure($: cheerio.CheerioAPI, element: cheerio.Cheerio<AnyNode>): string {
  const blocks: string[] = [];

  // Process block elements
  element.find('h1, h2, h3, h4, h5, h6, p, li, td, th, blockquote, pre, div').each((_i, el) => {
    const $el = $(el);
    const tagName = el.tagName?.toLowerCase();

    // Skip if already processed as child of another block
    if ($el.parents('h1, h2, h3, h4, h5, h6, p, li, td, th, blockquote, pre').length > 0) {
      return;
    }

    let text = $el.text().trim();

    if (!text) return;

    // Clean up whitespace
    text = text.replace(/\s+/g, ' ');

    // Add markdown-style heading markers for structure
    if (tagName?.startsWith('h')) {
      const level = parseInt(tagName[1], 10);
      const marker = '#'.repeat(level);
      text = `${marker} ${text}`;
    }

    // Add list markers
    if (tagName === 'li') {
      text = `- ${text}`;
    }

    blocks.push(text);
  });

  // If no blocks found, get all text
  if (blocks.length === 0) {
    return element.text().replace(/\s+/g, ' ').trim();
  }

  return blocks.join('\n\n');
}

/**
 * Extract headings from HTML document.
 *
 * @param $ - Cheerio instance
 * @returns Array of headings with level and text
 */
export function extractHtmlHeadings($: cheerio.CheerioAPI): Array<{ level: number; text: string }> {
  const headings: Array<{ level: number; text: string }> = [];

  $('h1, h2, h3, h4, h5, h6').each((_i, el) => {
    const $el = $(el);
    const level = parseInt(el.tagName[1], 10);
    const text = $el.text().trim();

    if (text) {
      headings.push({ level, text });
    }
  });

  return headings;
}

/**
 * Extract title from HTML document.
 *
 * Tries <title> tag first, falls back to first <h1>.
 *
 * @param $ - Cheerio instance
 * @returns Title string or null
 */
export function extractHtmlTitle($: cheerio.CheerioAPI): string | null {
  const title = $('title').text().trim();
  if (title) return title;

  const h1 = $('h1').first().text().trim();
  if (h1) return h1;

  return null;
}
