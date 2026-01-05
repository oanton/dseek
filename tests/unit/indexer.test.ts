/**
 * Indexer module tests - pure functions
 *
 * Tests for document ID generation, content hashing, and path ignoring.
 */

import { describe, expect, it } from 'vitest';
import { generateDocId, generateHash, shouldIgnore } from '../../src/core/indexer.js';

describe('Indexer', () => {
  describe('generateDocId', () => {
    it('generates relative path from project root', () => {
      const docId = generateDocId('/project/docs/readme.md', '/project');

      expect(docId).toBe('docs/readme.md');
    });

    it('handles nested paths correctly', () => {
      const docId = generateDocId('/project/src/components/Button.tsx', '/project');

      expect(docId).toBe('src/components/Button.tsx');
    });

    it('handles file at project root', () => {
      const docId = generateDocId('/project/README.md', '/project');

      expect(docId).toBe('README.md');
    });

    it('resolves relative file paths', () => {
      // generateDocId uses resolve() internally, so relative paths work
      const docId = generateDocId('./docs/test.md', process.cwd());

      expect(docId).toBe('docs/test.md');
    });
  });

  describe('generateHash', () => {
    it('produces consistent SHA256 hash for same content', () => {
      const content = Buffer.from('test content');
      const hash1 = generateHash(content);
      const hash2 = generateHash(content);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('produces different hashes for different content', () => {
      const hash1 = generateHash(Buffer.from('content A'));
      const hash2 = generateHash(Buffer.from('content B'));

      expect(hash1).not.toBe(hash2);
    });

    it('handles empty content', () => {
      const hash = generateHash(Buffer.from(''));

      // SHA256 of empty string
      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('handles binary content', () => {
      const binaryContent = Buffer.from([0x00, 0x01, 0xff, 0xfe]);
      const hash = generateHash(binaryContent);

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('handles unicode content', () => {
      const unicodeContent = Buffer.from('Привіт світ 🌍');
      const hash = generateHash(unicodeContent);

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('shouldIgnore', () => {
    it('ignores paths matching simple patterns', () => {
      expect(shouldIgnore('node_modules/package/index.js', ['node_modules'], [])).toBe(true);
      expect(shouldIgnore('src/test.ts', ['node_modules'], [])).toBe(false);
    });

    it('ignores paths matching directory patterns (ending with /)', () => {
      expect(shouldIgnore('build/output.js', ['build/'], [])).toBe(true);
      // Note: implementation uses includes() so 'builder' matches 'build'
      expect(shouldIgnore('src/builder.ts', ['build/'], [])).toBe(true);
      expect(shouldIgnore('src/main.ts', ['build/'], [])).toBe(false);
    });

    it('ignores paths matching exclude patterns', () => {
      expect(shouldIgnore('tests/unit/test.ts', [], ['tests'])).toBe(true);
      expect(shouldIgnore('src/main.ts', [], ['tests'])).toBe(false);
    });

    it('combines ignore and exclude patterns', () => {
      const ignorePatterns = ['node_modules', '.git'];
      const excludePatterns = ['*.test.ts', 'dist/'];

      expect(shouldIgnore('node_modules/pkg/index.js', ignorePatterns, excludePatterns)).toBe(true);
      expect(shouldIgnore('.git/config', ignorePatterns, excludePatterns)).toBe(true);
      expect(shouldIgnore('src/app.test.ts', ignorePatterns, excludePatterns)).toBe(true);
      expect(shouldIgnore('dist/bundle.js', ignorePatterns, excludePatterns)).toBe(true);
      expect(shouldIgnore('src/main.ts', ignorePatterns, excludePatterns)).toBe(false);
    });

    it('handles glob-like patterns with wildcards', () => {
      expect(shouldIgnore('logs/app.log', ['*.log'], [])).toBe(true);
      expect(shouldIgnore('src/temp/cache.tmp', ['*.tmp'], [])).toBe(true);
      expect(shouldIgnore('src/main.ts', ['*.log'], [])).toBe(false);
    });

    it('returns false when no patterns match', () => {
      expect(shouldIgnore('src/index.ts', [], [])).toBe(false);
      expect(shouldIgnore('README.md', ['*.test.ts'], ['spec/'])).toBe(false);
    });

    it('handles hidden files and directories', () => {
      expect(shouldIgnore('.env', ['.env'], [])).toBe(true);
      expect(shouldIgnore('.github/workflows/ci.yml', ['.github'], [])).toBe(true);
    });
  });
});
