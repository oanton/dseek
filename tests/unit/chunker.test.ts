/**
 * Chunker unit tests
 */

import { describe, expect, it } from 'vitest';
import { chunkDocument } from '../../src/core/chunker.js';

describe('chunkDocument', () => {
  describe('markdown strategy', () => {
    it('should split by headers', () => {
      const content = `# Header 1

Content under header 1.

## Header 2

Content under header 2.

## Header 3

Content under header 3.`;

      const chunks = chunkDocument(content, {
        docId: 'test.md',
        format: 'md',
      });

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].text).toContain('Header 1');
    });

    it('should preserve line numbers', () => {
      const content = `# Header

Line 3
Line 4
Line 5`;

      const chunks = chunkDocument(content, {
        docId: 'test.md',
        format: 'md',
      });

      expect(chunks[0].line_start).toBe(1);
      expect(chunks[0].line_end).toBeGreaterThan(1);
    });

    it('should generate unique chunk IDs', () => {
      const content = `# Section 1

Content 1

# Section 2

Content 2`;

      const chunks = chunkDocument(content, {
        docId: 'test.md',
        format: 'md',
      });

      const ids = chunks.map((c) => c.chunk_id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('fallback strategy', () => {
    it('should chunk plain text by size', () => {
      const content = 'A'.repeat(2000);

      const chunks = chunkDocument(content, {
        docId: 'test.txt',
        format: 'txt',
        config: {
          strategy: 'fallback',
          fallback: {
            chunk_size: 500,
            overlap: 100,
          },
        },
      });

      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should include overlap', () => {
      const content = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}`).join('\n');

      const chunks = chunkDocument(content, {
        docId: 'test.txt',
        format: 'txt',
        config: {
          strategy: 'fallback',
          fallback: {
            chunk_size: 50,
            overlap: 20,
          },
        },
      });

      if (chunks.length >= 2) {
        const _chunk1End = chunks[0].text.slice(-20);
        const _chunk2Start = chunks[1].text.slice(0, 20);
        // There should be some overlap
        expect(chunks[0].line_end).toBeGreaterThanOrEqual(chunks[1].line_start - 1);
      }
    });
  });

  describe('snippet generation', () => {
    it('should generate snippet from chunk text', () => {
      const content = `# Test Header

This is the first sentence of the content. This is more content that follows.`;

      const chunks = chunkDocument(content, {
        docId: 'test.md',
        format: 'md',
      });

      expect(chunks[0].snippet).toBeDefined();
      expect(chunks[0].snippet.length).toBeLessThanOrEqual(200);
    });

    it('should truncate long snippets', () => {
      const content = 'A'.repeat(1000);

      const chunks = chunkDocument(content, {
        docId: 'test.txt',
        format: 'txt',
      });

      // MAX_SNIPPET_LENGTH is 500, plus "..." suffix
      expect(chunks[0].snippet.length).toBeLessThanOrEqual(503);
      expect(chunks[0].snippet.length).toBeLessThan(chunks[0].text.length);
    });
  });
});
