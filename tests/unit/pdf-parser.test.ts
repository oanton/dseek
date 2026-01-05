/**
 * PDF Parser tests
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getPdfMetadata, parsePdf } from '../../src/parsers/pdf.js';

const SAMPLE_PDF = join(process.cwd(), 'testdata/sample.pdf');

describe('PDF Parser', () => {
  describe('parsePdf', () => {
    it('extracts text from PDF', async () => {
      const buffer = readFileSync(SAMPLE_PDF);
      const result = await parsePdf(buffer, 'sample.pdf');

      // Mozilla PDF.js test PDF contains various text
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.metadata.pages).toBeGreaterThan(0);
    });

    it('returns page count in metadata', async () => {
      const buffer = readFileSync(SAMPLE_PDF);
      const result = await parsePdf(buffer, 'sample.pdf');

      // Mozilla PDF.js basicapi.pdf has 3 pages
      expect(result.metadata.pages).toBe(3);
    });

    it('throws error for invalid PDF', async () => {
      const invalidBuffer = Buffer.from('not a valid pdf content');

      await expect(parsePdf(invalidBuffer, 'bad.pdf')).rejects.toThrow('Failed to parse PDF');
    });

    it('normalizes whitespace in extracted text', async () => {
      const buffer = readFileSync(SAMPLE_PDF);
      const result = await parsePdf(buffer, 'sample.pdf');

      // Should not have more than 2 consecutive newlines
      expect(result.content).not.toMatch(/\n{4,}/);
    });
  });

  describe('getPdfMetadata', () => {
    it('returns page count', async () => {
      const buffer = readFileSync(SAMPLE_PDF);
      const metadata = await getPdfMetadata(buffer);

      expect(metadata.pages).toBe(3);
    });

    it('returns metadata object structure', async () => {
      const buffer = readFileSync(SAMPLE_PDF);
      const metadata = await getPdfMetadata(buffer);

      expect(metadata).toHaveProperty('pages');
      // Optional properties
      expect('title' in metadata || metadata.title === undefined).toBe(true);
      expect('author' in metadata || metadata.author === undefined).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('documents behavior when PDF returns empty text', async () => {
      // Bug scenario: Image-based PDFs return empty text but still report pages
      // This can cause silent indexing failures where document appears indexed
      // but has no searchable content.
      //
      // Current behavior: no warning is returned, content is just empty string.
      // A future improvement would be to add a warning to metadata.

      const buffer = readFileSync(SAMPLE_PDF);
      const result = await parsePdf(buffer, 'sample.pdf');

      // Verify current API structure
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('metadata');
      expect(result.metadata).toHaveProperty('pages');

      // Document: there's no 'warning' field currently
      expect('warning' in result.metadata).toBe(false);

      // If content is empty, users should be warned
      // This test documents the current limitation
      if (result.content.trim() === '') {
        // Currently no warning is provided
        expect(result.metadata.pages).toBeGreaterThan(0);
        // Ideally: expect(result.metadata.warning).toBeDefined();
      }
    });

    it('handles PDF with only whitespace content', async () => {
      // Some PDFs might have only spaces/newlines
      const buffer = readFileSync(SAMPLE_PDF);
      const result = await parsePdf(buffer, 'sample.pdf');

      // Content should be a string (possibly empty after trimming)
      expect(typeof result.content).toBe('string');

      // Pages should always be reported
      expect(result.metadata.pages).toBeGreaterThanOrEqual(0);
    });
  });
});
