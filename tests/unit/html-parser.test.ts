/**
 * HTML parser unit tests
 *
 * Consolidated tests for HTML parsing, text extraction, and heading extraction.
 */

import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import { extractHtmlHeadings, extractHtmlTitle, parseHtml } from '../../src/parsers/html.js';

describe('HTML Parser', () => {
  describe('parseHtml', () => {
    it('extracts text and removes scripts/styles', async () => {
      const html = `
        <html>
          <head>
            <style>.hidden { display: none; }</style>
          </head>
          <body>
            <h1>Page Title</h1>
            <script>console.log('removed');</script>
            <p>Visible content here</p>
            <noscript>No JS content</noscript>
          </body>
        </html>`;

      const result = await parseHtml(Buffer.from(html), 'test.html');

      expect(result.content).toContain('Page Title');
      expect(result.content).toContain('Visible content');
      expect(result.content).not.toContain('console.log');
      expect(result.content).not.toContain('.hidden');
      expect(result.content).not.toContain('noscript');
    });

    it('converts headings to markdown format', async () => {
      const html = '<body><h1>H1</h1><h2>H2</h2><h3>H3</h3><h4>H4</h4></body>';
      const result = await parseHtml(Buffer.from(html), 'test.html');

      expect(result.content).toContain('# H1');
      expect(result.content).toContain('## H2');
      expect(result.content).toContain('### H3');
      expect(result.content).toContain('#### H4');
    });

    it('converts list items with markers', async () => {
      const html = '<ul><li>First item</li><li>Second item</li></ul>';
      const result = await parseHtml(Buffer.from(html), 'test.html');

      expect(result.content).toContain('- First item');
      expect(result.content).toContain('- Second item');
    });

    it('handles empty body gracefully', async () => {
      const html = '<html><body></body></html>';
      const result = await parseHtml(Buffer.from(html), 'test.html');

      expect(result.content).toBe('');
      expect(result.metadata.lines).toBeGreaterThanOrEqual(1);
    });

    it('removes hidden elements', async () => {
      const html = `
        <body>
          <p>Visible</p>
          <div hidden>Hidden by attribute</div>
          <span style="display: none;">Hidden by style</span>
        </body>`;

      const result = await parseHtml(Buffer.from(html), 'test.html');

      expect(result.content).toContain('Visible');
      expect(result.content).not.toContain('Hidden by attribute');
      expect(result.content).not.toContain('Hidden by style');
    });
  });

  describe('extractHtmlHeadings', () => {
    it('returns all headings with correct levels', () => {
      const $ = cheerio.load('<h1>First</h1><h2>Second</h2><h3>Third</h3>');
      const headings = extractHtmlHeadings($);

      expect(headings).toHaveLength(3);
      expect(headings[0]).toEqual({ level: 1, text: 'First' });
      expect(headings[1]).toEqual({ level: 2, text: 'Second' });
      expect(headings[2]).toEqual({ level: 3, text: 'Third' });
    });

    it('returns empty array when no headings', () => {
      const $ = cheerio.load('<p>Just a paragraph</p>');
      const headings = extractHtmlHeadings($);

      expect(headings).toHaveLength(0);
    });

    it('trims and skips empty headings', () => {
      const $ = cheerio.load('<h1></h1><h2>  Spaces around  </h2><h3>Valid</h3><h4>   </h4>');
      const headings = extractHtmlHeadings($);

      expect(headings).toHaveLength(2);
      expect(headings[0].text).toBe('Spaces around');
      expect(headings[1].text).toBe('Valid');
    });
  });

  describe('extractHtmlTitle', () => {
    it('extracts with priority fallback (title > h1)', () => {
      // From title tag
      const $1 = cheerio.load('<head><title>Page Title</title></head>');
      expect(extractHtmlTitle($1)).toBe('Page Title');

      // Falls back to h1 if no title
      const $2 = cheerio.load('<body><h1>Heading Title</h1></body>');
      expect(extractHtmlTitle($2)).toBe('Heading Title');

      // Prefers title over h1
      const $3 = cheerio.load('<head><title>Title Tag</title></head><body><h1>H1 Tag</h1></body>');
      expect(extractHtmlTitle($3)).toBe('Title Tag');
    });

    it('returns null if no title or h1', () => {
      const $ = cheerio.load('<body><p>Just text</p></body>');

      expect(extractHtmlTitle($)).toBeNull();
    });

    it('trims whitespace from title', () => {
      const $ = cheerio.load('<title>  Spaced Title  </title>');

      expect(extractHtmlTitle($)).toBe('Spaced Title');
    });
  });
});
