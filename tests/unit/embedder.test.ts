/**
 * Embedder unit tests
 *
 * Consolidated tests for model constants and cosine similarity.
 * Note: No model loading required - tests pure functions only.
 */

import { describe, expect, it } from 'vitest';
import {
  cosineSimilarity,
  getEmbeddingDim,
  getModelName,
  getModelsDir,
  isEmbedderReady,
  resetEmbedder,
} from '../../src/core/embedder.js';

describe('Embedder', () => {
  it('model constants are correct', () => {
    expect(getEmbeddingDim()).toBe(768);
    expect(getModelName()).toBe('onnx-community/gte-multilingual-base');
  });

  describe('getModelsDir', () => {
    it('returns path ending with models directory', () => {
      const dir = getModelsDir();

      expect(dir).toContain('.dseek');
      expect(dir).toMatch(/models$/);
    });
  });

  describe('isEmbedderReady / resetEmbedder', () => {
    it('reports ready state correctly', () => {
      // Reset to known state
      resetEmbedder();

      // Should not be ready after reset (model not loaded)
      expect(isEmbedderReady()).toBe(false);
    });

    it('resetEmbedder clears the singleton state', () => {
      resetEmbedder();
      expect(isEmbedderReady()).toBe(false);

      // Multiple resets should be safe
      resetEmbedder();
      resetEmbedder();
      expect(isEmbedderReady()).toBe(false);
    });
  });

  describe('cosineSimilarity', () => {
    it('computes correct values for standard cases', () => {
      // Identical vectors → 1
      const vec = [0.5, 0.5, 0.5, 0.5];
      expect(cosineSimilarity(vec, vec)).toBeCloseTo(1.0);

      // Orthogonal vectors → 0
      const a = [1, 0, 0, 0];
      const b = [0, 1, 0, 0];
      expect(cosineSimilarity(a, b)).toBeCloseTo(0);

      // Opposite vectors → -1
      const c = [1, 0];
      const d = [-1, 0];
      expect(cosineSimilarity(c, d)).toBeCloseTo(-1.0);

      // 45 degrees → cos(45°) ≈ 0.707
      const e = [1, 0];
      const f = [Math.SQRT1_2, Math.SQRT1_2];
      expect(cosineSimilarity(e, f)).toBeCloseTo(Math.SQRT1_2);
    });

    it('throws for vectors with different dimensions', () => {
      expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow('Embeddings must have the same dimension');
    });

    it('returns 0 for zero vectors', () => {
      const zero = [0, 0, 0, 0];
      expect(cosineSimilarity(zero, zero)).toBe(0);
    });
  });
});
