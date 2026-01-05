/**
 * Retrieval module tests - pure functions
 *
 * Consolidated tests for cursor encoding, query hashing, and confidence calculation.
 */

import { describe, expect, it } from 'vitest';
import { calculateConfidence, decodeCursor, encodeCursor, hashQuery } from '../../src/core/retrieval.js';
import type { SearchResult } from '../../src/types/index.js';

describe('Retrieval', () => {
  describe('encodeCursor / decodeCursor', () => {
    it('round-trips cursor data as base64', () => {
      const data = { query_hash: 'abc123', offset: 10, index_version: 1 };
      const cursor = encodeCursor(data);

      // Verify base64 format
      expect(cursor).toMatch(/^[A-Za-z0-9+/]+=*$/);

      // Verify round-trip
      const decoded = decodeCursor(cursor);
      expect(decoded).toEqual(data);
    });

    it('handles invalid input gracefully', () => {
      // Invalid base64
      expect(decodeCursor('not-valid-base64!!!')).toBeNull();

      // Valid base64 but invalid JSON
      const invalidJson = Buffer.from('not json').toString('base64');
      expect(decodeCursor(invalidJson)).toBeNull();
    });
  });

  describe('hashQuery', () => {
    it('produces consistent 16-char hex hashes', () => {
      const hash1 = hashQuery('test query');
      const hash2 = hashQuery('test query');
      const hashDifferent = hashQuery('different query');

      // Same query = same hash
      expect(hash1).toBe(hash2);

      // Different query = different hash
      expect(hash1).not.toBe(hashDifferent);

      // Format: 16 hex chars
      expect(hash1).toMatch(/^[a-f0-9]{16}$/);
    });

    it('handles edge cases (empty, unicode)', () => {
      const emptyHash = hashQuery('');
      const unicodeHash = hashQuery('тест запит 🔍');

      expect(emptyHash).toMatch(/^[a-f0-9]{16}$/);
      expect(unicodeHash).toMatch(/^[a-f0-9]{16}$/);
    });
  });

  describe('calculateConfidence', () => {
    it('returns 0 for empty results', () => {
      expect(calculateConfidence([], 0)).toBe(0);
    });

    it('produces valid 0-1 scores based on result quality', () => {
      const highScores = [{ score: 0.95 }, { score: 0.9 }] as SearchResult[];
      const lowScores = [{ score: 0.3 }, { score: 0.2 }] as SearchResult[];

      const highConf = calculateConfidence(highScores, 10);
      const lowConf = calculateConfidence(lowScores, 10);

      // Both in valid range
      expect(highConf).toBeGreaterThanOrEqual(0);
      expect(highConf).toBeLessThanOrEqual(1);
      expect(lowConf).toBeGreaterThanOrEqual(0);
      expect(lowConf).toBeLessThanOrEqual(1);

      // Higher scores = higher confidence
      expect(highConf).toBeGreaterThan(lowConf);
    });

    it('factors in result count and formatting', () => {
      const results = [{ score: 0.5 }] as SearchResult[];

      const fewTotal = calculateConfidence(results, 1);
      const manyTotal = calculateConfidence(results, 20);

      // More results increases confidence
      expect(manyTotal).toBeGreaterThan(fewTotal);

      // Should be formatted to 2 decimal places
      const decimalPlaces = (manyTotal.toString().split('.')[1] || '').length;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });
  });
});
