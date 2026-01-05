/**
 * List command sorting tests
 *
 * Tests the sorting logic used in the list command.
 * We test the sorting algorithm directly since it's a pure function pattern.
 */

import { describe, expect, it } from 'vitest';
import type { Document } from '../../../src/types/index.js';

/**
 * Sort documents by field (mirrors list.ts implementation)
 */
function sortDocuments(documents: Document[], sortField: 'path' | 'size' | 'updated'): Document[] {
  return [...documents].sort((a, b) => {
    switch (sortField) {
      case 'size':
        return b.size_bytes - a.size_bytes;
      case 'updated':
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      default:
        return a.doc_id.localeCompare(b.doc_id);
    }
  });
}

describe('List Command Sorting', () => {
  const testDocuments: Document[] = [
    {
      doc_id: 'docs/zebra.md',
      source_name: 'docs',
      format: 'markdown',
      content_hash: 'hash1',
      updated_at: '2024-01-15T10:00:00Z',
      size_bytes: 1024,
    },
    {
      doc_id: 'docs/alpha.md',
      source_name: 'docs',
      format: 'markdown',
      content_hash: 'hash2',
      updated_at: '2024-01-20T10:00:00Z',
      size_bytes: 2048,
    },
    {
      doc_id: 'docs/beta.md',
      source_name: 'docs',
      format: 'markdown',
      content_hash: 'hash3',
      updated_at: '2024-01-10T10:00:00Z',
      size_bytes: 512,
    },
  ];

  describe('sortDocuments', () => {
    it('sorts by path (doc_id) alphabetically by default', () => {
      const sorted = sortDocuments(testDocuments, 'path');

      expect(sorted[0].doc_id).toBe('docs/alpha.md');
      expect(sorted[1].doc_id).toBe('docs/beta.md');
      expect(sorted[2].doc_id).toBe('docs/zebra.md');
    });

    it('sorts by size descending (largest first)', () => {
      const sorted = sortDocuments(testDocuments, 'size');

      expect(sorted[0].size_bytes).toBe(2048);
      expect(sorted[1].size_bytes).toBe(1024);
      expect(sorted[2].size_bytes).toBe(512);
    });

    it('sorts by updated descending (newest first)', () => {
      const sorted = sortDocuments(testDocuments, 'updated');

      expect(sorted[0].doc_id).toBe('docs/alpha.md'); // Jan 20
      expect(sorted[1].doc_id).toBe('docs/zebra.md'); // Jan 15
      expect(sorted[2].doc_id).toBe('docs/beta.md'); // Jan 10
    });

    it('does not mutate the original array', () => {
      const original = [...testDocuments];
      sortDocuments(testDocuments, 'size');

      expect(testDocuments).toEqual(original);
    });

    it('handles empty array', () => {
      const sorted = sortDocuments([], 'path');

      expect(sorted).toEqual([]);
    });

    it('handles single document', () => {
      const single = [testDocuments[0]];
      const sorted = sortDocuments(single, 'path');

      expect(sorted).toHaveLength(1);
      expect(sorted[0]).toEqual(testDocuments[0]);
    });

    it('handles documents with same values', () => {
      const sameSizeDocs: Document[] = [
        { ...testDocuments[0], size_bytes: 1000, doc_id: 'b.md' },
        { ...testDocuments[1], size_bytes: 1000, doc_id: 'a.md' },
      ];

      const sorted = sortDocuments(sameSizeDocs, 'size');

      // Same size - order depends on stable sort
      expect(sorted).toHaveLength(2);
      expect(sorted.every((d) => d.size_bytes === 1000)).toBe(true);
    });
  });
});
