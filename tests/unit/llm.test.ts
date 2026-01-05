/**
 * LLM module unit tests
 *
 * Consolidated tests for RAG prompt construction.
 * Tests pure functions only (no Ollama calls required).
 */

import { describe, expect, it } from 'vitest';
import { buildRAGPrompt } from '../../src/core/llm.js';

describe('LLM', () => {
  describe('buildRAGPrompt', () => {
    it('formats contexts with numbered references', () => {
      const contexts = [
        { path: 'docs/auth.md', line_start: 1, line_end: 10, snippet: 'OAuth 2.0 flow' },
        { path: 'docs/api.md', line_start: 5, line_end: 15, snippet: 'REST API endpoints' },
      ];

      const prompt = buildRAGPrompt('How does authentication work?', contexts);

      // Should include snippets
      expect(prompt).toContain('OAuth 2.0 flow');
      expect(prompt).toContain('REST API endpoints');

      // Should include file:line references in source headers
      expect(prompt).toContain('docs/auth.md (lines 1-10)');
      expect(prompt).toContain('docs/api.md (lines 5-15)');

      // Should include numbered markers
      expect(prompt).toContain('[1]');
      expect(prompt).toContain('[2]');

      // Should include the query
      expect(prompt).toContain('How does authentication work?');
    });

    it('includes required instructions', () => {
      const prompt = buildRAGPrompt('query', []);

      // Should include instruction about citations
      expect(prompt.toLowerCase()).toContain('cite');

      // Should include instruction about language matching
      expect(prompt.toLowerCase()).toContain('language');
    });

    it('handles empty contexts', () => {
      const prompt = buildRAGPrompt('What is X?', []);

      expect(prompt).toContain('What is X?');
      expect(prompt).toContain('SOURCES:');
    });
  });
});
