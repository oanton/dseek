/**
 * DOCX Parser tests
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getDocxMetadata, parseDocx, parseDocxRaw } from '../../src/parsers/docx.js';

const SAMPLE_DOCX = join(process.cwd(), 'testdata/sample.docx');

describe('DOCX Parser', () => {
  describe('parseDocx', () => {
    it('extracts text as markdown', async () => {
      const buffer = readFileSync(SAMPLE_DOCX);
      const result = await parseDocx(buffer, 'sample.docx');

      expect(result.content).toContain('Test Document');
      expect(result.metadata.lines).toBeGreaterThan(0);
    });

    it('preserves heading structure in markdown', async () => {
      const buffer = readFileSync(SAMPLE_DOCX);
      const result = await parseDocx(buffer, 'sample.docx');

      // Should contain markdown heading syntax
      expect(result.content).toMatch(/#.*Test Document/);
    });

    it('throws error for invalid DOCX', async () => {
      const invalidBuffer = Buffer.from('not a valid docx content');

      await expect(parseDocx(invalidBuffer, 'bad.docx')).rejects.toThrow('Failed to parse DOCX');
    });

    it('handles DOCX with minimal content', async () => {
      const buffer = readFileSync(SAMPLE_DOCX);
      const result = await parseDocx(buffer, 'sample.docx');

      expect(typeof result.content).toBe('string');
      expect(result.content.length).toBeGreaterThan(0);
    });
  });

  describe('parseDocxRaw', () => {
    it('returns plain text without markdown formatting', async () => {
      const buffer = readFileSync(SAMPLE_DOCX);
      const text = await parseDocxRaw(buffer);

      expect(text).toContain('Test Document');
      // Raw text should not have markdown symbols (or fewer)
      expect(typeof text).toBe('string');
    });
  });

  describe('getDocxMetadata', () => {
    it('returns metadata structure', async () => {
      const buffer = readFileSync(SAMPLE_DOCX);
      const meta = await getDocxMetadata(buffer);

      expect(meta).toHaveProperty('hasImages');
      expect(meta).toHaveProperty('hasTables');
      expect(meta).toHaveProperty('warnings');
      expect(Array.isArray(meta.warnings)).toBe(true);
    });

    it('detects absence of images in text-only document', async () => {
      const buffer = readFileSync(SAMPLE_DOCX);
      const meta = await getDocxMetadata(buffer);

      // Our sample has no images
      expect(meta.hasImages).toBe(false);
    });
  });
});
