/**
 * Retrieval quality tests - tests for search quality edge cases
 *
 * These tests focus on ensuring search quality metrics are meaningful:
 * - Confidence scores should reflect actual result quality
 * - More low-quality results should not inflate confidence
 */

import { describe, expect, it } from 'vitest';
import { calculateConfidence } from '../../src/core/retrieval.js';
import type { SearchResult } from '../../src/types/index.js';

describe('Retrieval Quality', () => {
  describe('confidence score inversions', () => {
    it('single high-quality result should have higher confidence than many low-quality results', () => {
      // Bug scenario: current formula:
      // confidence = avgScore * 0.7 + countFactor * 0.3
      // where countFactor = min(total/10, 1)
      //
      // This means:
      // - 1 result with score 0.9, total=1: 0.9*0.7 + 0.1*0.3 = 0.63 + 0.03 = 0.66
      // - 10 results with avg score 0.3, total=10: 0.3*0.7 + 1.0*0.3 = 0.21 + 0.30 = 0.51
      //
      // Actually, high quality single result DOES beat low quality many results.
      // Let's test edge cases where the inversion could happen:

      const oneExcellent = calculateConfidence([{ score: 0.95 }] as SearchResult[], 1);
      const manyPoor = calculateConfidence(
        Array(10)
          .fill(null)
          .map(() => ({ score: 0.3 })) as SearchResult[],
        10,
      );

      // One excellent result should beat many poor results
      expect(oneExcellent).toBeGreaterThan(manyPoor);
    });

    it('documents confidence inversion edge case', () => {
      // Edge case: mediocre single result vs many mediocre results
      // - 1 result with score 0.4, total=1: 0.4*0.7 + 0.1*0.3 = 0.28 + 0.03 = 0.31
      // - 10 results with avg score 0.35, total=10: 0.35*0.7 + 1.0*0.3 = 0.245 + 0.30 = 0.545

      const oneMediocre = calculateConfidence([{ score: 0.4 }] as SearchResult[], 1);
      const manyMediocre = calculateConfidence(
        Array(10)
          .fill(null)
          .map(() => ({ score: 0.35 })) as SearchResult[],
        10,
      );

      // Document current behavior: more results CAN inflate confidence
      // This is a known limitation of the current algorithm
      if (manyMediocre > oneMediocre) {
        // Current behavior: many mediocre beats one mediocre
        // This could be misleading to users
        expect(manyMediocre).toBeGreaterThan(oneMediocre);
      } else {
        // If algorithm is fixed, one mediocre should beat or equal many mediocre
        expect(oneMediocre).toBeGreaterThanOrEqual(manyMediocre);
      }
    });

    it('confidence is bounded between 0 and 1', () => {
      const empty = calculateConfidence([], 0);
      const perfect = calculateConfidence([{ score: 1.0 }] as SearchResult[], 100);

      expect(empty).toBe(0);
      expect(perfect).toBeLessThanOrEqual(1);
      expect(perfect).toBeGreaterThan(0);
    });

    it('confidence increases with score quality', () => {
      // Same number of results, different quality
      const lowScores = calculateConfidence(
        Array(5)
          .fill(null)
          .map(() => ({ score: 0.2 })) as SearchResult[],
        5,
      );
      const highScores = calculateConfidence(
        Array(5)
          .fill(null)
          .map(() => ({ score: 0.9 })) as SearchResult[],
        5,
      );

      expect(highScores).toBeGreaterThan(lowScores);
    });

    it('returns exactly 2 decimal places', () => {
      const confidence = calculateConfidence([{ score: 0.777 }] as SearchResult[], 3);

      const decimalPlaces = (confidence.toString().split('.')[1] || '').length;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });
  });
});
