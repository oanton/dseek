/**
 * Search command helper tests
 *
 * Tests the helper logic used in the search command.
 */

import { describe, expect, it } from 'vitest';

/**
 * Parse batch file content into queries (mirrors search.ts implementation)
 */
function parseBatchQueries(content: string): string[] {
  return content.split('\n').filter((line) => line.trim().length > 0);
}

/**
 * Format JSON output (mirrors search.ts implementation)
 */
function formatJSON(data: unknown, pretty: boolean): string {
  if (pretty) {
    return JSON.stringify(data, null, 2);
  }
  return JSON.stringify(data);
}

/**
 * Parse limit option (mirrors search.ts parseInt usage)
 */
function parseLimit(value: string): number {
  return parseInt(value, 10);
}

describe('Search Command Helpers', () => {
  describe('parseBatchQueries', () => {
    it('parses newline-separated queries', () => {
      const content = 'query one\nquery two\nquery three';
      const queries = parseBatchQueries(content);

      expect(queries).toEqual(['query one', 'query two', 'query three']);
    });

    it('filters out empty lines', () => {
      const content = 'query one\n\nquery two\n   \nquery three\n';
      const queries = parseBatchQueries(content);

      expect(queries).toEqual(['query one', 'query two', 'query three']);
    });

    it('handles single query', () => {
      const content = 'single query';
      const queries = parseBatchQueries(content);

      expect(queries).toEqual(['single query']);
    });

    it('returns empty array for empty content', () => {
      expect(parseBatchQueries('')).toEqual([]);
      expect(parseBatchQueries('\n\n')).toEqual([]);
    });

    it('preserves leading/trailing spaces in query text', () => {
      const content = '  query with spaces  ';
      const queries = parseBatchQueries(content);

      expect(queries).toEqual(['  query with spaces  ']);
    });

    it('handles CRLF line endings', () => {
      const content = 'query one\r\nquery two\r\n';
      const queries = parseBatchQueries(content);

      // Split by \n leaves \r attached
      expect(queries.length).toBe(2);
    });
  });

  describe('formatJSON', () => {
    it('formats compact JSON when pretty is false', () => {
      const data = { key: 'value', nested: { a: 1 } };
      const output = formatJSON(data, false);

      expect(output).toBe('{"key":"value","nested":{"a":1}}');
      expect(output).not.toContain('\n');
    });

    it('formats pretty JSON when pretty is true', () => {
      const data = { key: 'value' };
      const output = formatJSON(data, true);

      expect(output).toContain('\n');
      expect(output).toContain('  '); // indentation
    });

    it('handles arrays', () => {
      const data = [1, 2, 3];
      expect(formatJSON(data, false)).toBe('[1,2,3]');
    });

    it('handles null', () => {
      expect(formatJSON(null, false)).toBe('null');
    });

    it('handles search response structure', () => {
      const response = {
        schema_version: 1,
        query: 'test',
        results: [{ doc_id: 'doc.md', score: 0.9 }],
      };

      const output = formatJSON(response, false);
      const parsed = JSON.parse(output);

      expect(parsed.schema_version).toBe(1);
      expect(parsed.results).toHaveLength(1);
    });
  });

  describe('parseLimit', () => {
    it('parses valid integer strings', () => {
      expect(parseLimit('10')).toBe(10);
      expect(parseLimit('100')).toBe(100);
      expect(parseLimit('1')).toBe(1);
    });

    it('returns NaN for invalid strings', () => {
      expect(Number.isNaN(parseLimit('abc'))).toBe(true);
      expect(Number.isNaN(parseLimit(''))).toBe(true);
    });

    it('parses decimal strings as integers (truncates)', () => {
      expect(parseLimit('10.5')).toBe(10);
      expect(parseLimit('10.9')).toBe(10);
    });

    it('handles leading/trailing whitespace', () => {
      expect(parseLimit(' 10 ')).toBe(10);
    });

    it('handles negative numbers', () => {
      expect(parseLimit('-5')).toBe(-5);
    });
  });
});
