/**
 * Parser factory unit tests
 *
 * Tests format detection, supported file checks, and document parsing.
 */

import { describe, expect, it } from 'vitest';
import {
  getFormat,
  getSupportedExtensions,
  getSupportedGlobs,
  isSupported,
  parseDocument,
} from '../../src/parsers/index.js';
import { parseText } from '../../src/parsers/text.js';

describe('Parsers', () => {
  describe('getFormat', () => {
    it('returns md for markdown extensions', () => {
      expect(getFormat('doc.md')).toBe('md');
      expect(getFormat('doc.markdown')).toBe('md');
      expect(getFormat('README.MD')).toBe('md'); // case insensitive
    });

    it('returns html for html extensions', () => {
      expect(getFormat('page.html')).toBe('html');
      expect(getFormat('page.htm')).toBe('html');
      expect(getFormat('index.HTML')).toBe('html');
    });

    it('returns correct format for all supported types', () => {
      expect(getFormat('file.txt')).toBe('txt');
      expect(getFormat('file.text')).toBe('txt');
      expect(getFormat('file.pdf')).toBe('pdf');
      expect(getFormat('file.docx')).toBe('docx');
    });

    it('returns null for unknown extensions', () => {
      expect(getFormat('file.xyz')).toBeNull();
      expect(getFormat('noext')).toBeNull();
      expect(getFormat('.gitignore')).toBeNull();
      expect(getFormat('script.js')).toBeNull();
      expect(getFormat('style.css')).toBeNull();
    });

    it('handles paths with multiple dots', () => {
      expect(getFormat('file.test.md')).toBe('md');
      expect(getFormat('my.doc.v2.html')).toBe('html');
    });
  });

  describe('isSupported', () => {
    it('returns true for supported formats', () => {
      expect(isSupported('doc.md')).toBe(true);
      expect(isSupported('doc.html')).toBe(true);
      expect(isSupported('doc.txt')).toBe(true);
      expect(isSupported('doc.pdf')).toBe(true);
      expect(isSupported('doc.docx')).toBe(true);
    });

    it('returns false for unsupported formats', () => {
      expect(isSupported('file.xyz')).toBe(false);
      expect(isSupported('script.js')).toBe(false);
      expect(isSupported('style.css')).toBe(false);
      expect(isSupported('image.png')).toBe(false);
      expect(isSupported('noextension')).toBe(false);
    });
  });

  describe('getSupportedExtensions', () => {
    it('returns all extension strings', () => {
      const exts = getSupportedExtensions();

      expect(exts).toContain('.md');
      expect(exts).toContain('.markdown');
      expect(exts).toContain('.html');
      expect(exts).toContain('.htm');
      expect(exts).toContain('.txt');
      expect(exts).toContain('.pdf');
      expect(exts).toContain('.docx');
    });

    it('returns array of strings starting with dot', () => {
      const exts = getSupportedExtensions();

      expect(Array.isArray(exts)).toBe(true);
      expect(exts.every((e) => e.startsWith('.'))).toBe(true);
    });
  });

  describe('getSupportedGlobs', () => {
    it('returns glob patterns for all extensions', () => {
      const globs = getSupportedGlobs();

      expect(globs).toContain('**/*.md');
      expect(globs).toContain('**/*.html');
      expect(globs).toContain('**/*.pdf');
    });
  });

  describe('parseDocument', () => {
    it('throws for unsupported format', async () => {
      await expect(parseDocument(Buffer.from('content'), 'file.xyz')).rejects.toThrow('Unsupported file format');
    });

    it('throws for files exceeding 10MB', async () => {
      const big = Buffer.alloc(11 * 1024 * 1024);
      await expect(parseDocument(big, 'big.md')).rejects.toThrow('exceeds maximum size');
    });

    it('parses markdown files correctly', async () => {
      const result = await parseDocument(Buffer.from('# Test\nContent here'), 'test.md');

      expect(result.content).toContain('# Test');
      expect(result.content).toContain('Content here');
      expect(result.metadata.lines).toBe(2);
    });

    it('parses text files correctly', async () => {
      const result = await parseDocument(Buffer.from('Plain text content'), 'test.txt');

      expect(result.content).toBe('Plain text content');
    });
  });

  describe('parseText', () => {
    it('returns content and correct line count', async () => {
      const result = await parseText(Buffer.from('line1\nline2\nline3'), 'test.txt');

      expect(result.content).toBe('line1\nline2\nline3');
      expect(result.metadata.lines).toBe(3);
    });

    it('handles single line files', async () => {
      const result = await parseText(Buffer.from('single line'), 'test.txt');

      expect(result.content).toBe('single line');
      expect(result.metadata.lines).toBe(1);
    });

    it('handles empty files', async () => {
      const result = await parseText(Buffer.from(''), 'empty.txt');

      expect(result.content).toBe('');
      expect(result.metadata.lines).toBe(1);
    });

    it('preserves unicode content', async () => {
      const unicode = 'Привіт світ! 你好世界 🌍';
      const result = await parseText(Buffer.from(unicode), 'unicode.txt');

      expect(result.content).toBe(unicode);
    });
  });
});
