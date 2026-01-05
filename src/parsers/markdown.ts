/**
 * Markdown parser using remark
 *
 * Parses markdown files and extracts structure for chunking.
 *
 * @module parsers/markdown
 */

import remarkParse from 'remark-parse';
import { unified } from 'unified';
import type { ParsedDocument } from '../types/index.js';

/**
 * Parse a markdown file.
 *
 * Returns raw content; structure extraction handled by chunker.
 *
 * @param content - File content as buffer
 * @param _filePath - File path (unused)
 * @returns Parsed document with content and line count
 */
export async function parseMarkdown(content: Buffer, _filePath: string): Promise<ParsedDocument> {
  const text = content.toString('utf-8');
  const lines = text.split('\n').length;

  // Parse to validate markdown and get metadata
  try {
    const processor = unified().use(remarkParse);
    await processor.parse(text);
  } catch (error) {
    // If parsing fails, still return the content as plain text
    console.warn(`Markdown parsing warning: ${error}`);
  }

  return {
    content: text,
    metadata: {
      lines,
    },
  };
}

/**
 * Extract headings from markdown.
 *
 * @param content - Markdown content
 * @returns Array of headings with level, text, and line number
 */
export function extractHeadings(content: string): Array<{ level: number; text: string; line: number }> {
  const headings: Array<{ level: number; text: string; line: number }> = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(#{1,6})\s+(.+)$/);

    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        line: i + 1,
      });
    }
  }

  return headings;
}

/**
 * Check if a line is a code block delimiter (```).
 *
 * @param line - Line to check
 * @returns True if line starts with ```
 */
export function isCodeBlockDelimiter(line: string): boolean {
  return line.trim().startsWith('```');
}

/**
 * Extract sections from markdown based on headings.
 *
 * Splits content at heading boundaries for structure-aware chunking.
 *
 * @param content - Markdown content
 * @returns Array of sections with heading, level, lines, and content
 */
export function extractSections(content: string): Array<{
  heading: string | null;
  level: number;
  startLine: number;
  endLine: number;
  content: string;
}> {
  const lines = content.split('\n');
  const sections: Array<{
    heading: string | null;
    level: number;
    startLine: number;
    endLine: number;
    content: string;
  }> = [];

  let currentSection: (typeof sections)[0] | null = null;
  const sectionStartLine = 1;
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Track code blocks to avoid splitting on headers inside them
    if (isCodeBlockDelimiter(line)) {
      inCodeBlock = !inCodeBlock;
    }

    if (!inCodeBlock) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headingMatch) {
        // Save previous section
        if (currentSection) {
          currentSection.endLine = lineNum - 1;
          currentSection.content = lines.slice(currentSection.startLine - 1, lineNum - 1).join('\n');
          sections.push(currentSection);
        } else if (sectionStartLine < lineNum) {
          // Content before first heading
          sections.push({
            heading: null,
            level: 0,
            startLine: sectionStartLine,
            endLine: lineNum - 1,
            content: lines.slice(sectionStartLine - 1, lineNum - 1).join('\n'),
          });
        }

        // Start new section
        currentSection = {
          heading: headingMatch[2].trim(),
          level: headingMatch[1].length,
          startLine: lineNum,
          endLine: lineNum,
          content: '',
        };
      }
    }
  }

  // Save last section
  if (currentSection) {
    currentSection.endLine = lines.length;
    currentSection.content = lines.slice(currentSection.startLine - 1).join('\n');
    sections.push(currentSection);
  } else if (sectionStartLine <= lines.length) {
    // All content without headings
    sections.push({
      heading: null,
      level: 0,
      startLine: sectionStartLine,
      endLine: lines.length,
      content: content,
    });
  }

  return sections;
}
