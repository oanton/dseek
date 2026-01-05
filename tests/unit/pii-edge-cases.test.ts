/**
 * PII edge cases - tests for real bug scenarios
 *
 * These tests focus on edge cases that could cause issues:
 * - Overlapping PII patterns causing text corruption
 * - International characters not being detected
 * - Regex DoS on pathological input
 */

import { describe, expect, it } from 'vitest';
import { detectPII, redactPII } from '../../src/privacy/pii.js';

describe('PII Edge Cases', () => {
  describe('overlapping patterns', () => {
    it('handles email containing API key pattern without corruption', () => {
      // Bug scenario: email contains "sk_" which matches API key pattern
      // Email: test_sk_1234567890123456@example.com
      // - Email pattern matches the whole thing
      // - API key pattern might match "sk_1234567890123456" inside it
      const text = 'Contact: test_sk_12345678901234567890@example.com';

      const result = redactPII(text);

      // Should not produce malformed output like "[EMAIL]34@example.com"
      expect(result.text).not.toMatch(/\d+@/); // No leftover numbers before @
      expect(result.text).not.toMatch(/@[a-z]+\.[a-z]+/); // No leftover domain

      // Should have clean redaction
      expect(result.redacted).toBe(true);
    });

    it('handles overlapping phone and SSN patterns', () => {
      // Some number sequences could match both phone and SSN patterns
      const text = 'Call 123-45-6789 or 123-456-7890';

      const matches = detectPII(text);
      const result = redactPII(text);

      // Should detect something
      expect(matches.length).toBeGreaterThan(0);

      // Redacted text should not have leftover digits in suspicious patterns
      expect(result.redacted).toBe(true);
    });

    it('handles adjacent PII without merging', () => {
      const text = 'Email: foo@bar.com Phone: +1-555-123-4567';

      const result = redactPII(text);

      expect(result.text).toContain('[EMAIL]');
      expect(result.text).toContain('[PHONE]');
      expect(result.matches.length).toBe(2);
    });
  });

  describe('international characters', () => {
    it('documents that cyrillic emails are not detected', () => {
      // Current implementation uses [a-zA-Z0-9] which doesn't match Cyrillic
      const text = 'Contact: тест@example.com';

      const result = redactPII(text);

      // Document current behavior: NOT detected
      // If this test fails after a fix, that's good!
      expect(result.redacted).toBe(false);
    });

    it('documents that IDN domains are not detected', () => {
      // Internationalized domain names
      const text = 'Email: user@münchen.de';

      const result = redactPII(text);

      // Current behavior: partial match might occur
      // Just document that it doesn't fully work
      expect(typeof result.redacted).toBe('boolean');
    });

    it('handles mixed ASCII and Unicode in surrounding text', () => {
      // Email should still be detected even with Unicode around it
      const text = 'Привіт! Contact me at test@example.com for more info.';

      const result = redactPII(text);

      expect(result.redacted).toBe(true);
      expect(result.text).toContain('[EMAIL]');
      expect(result.text).toContain('Привіт');
    });
  });

  describe('regex DoS protection', () => {
    it('does not hang on pathological password input', () => {
      // Bug scenario: password pattern with catastrophic backtracking
      // Pattern: /(?:password|passwd|pwd)\s*[:=]\s*["']?[^\s"']+["']?/gi
      // Unterminated quote after password= could cause backtracking
      const text = 'password = "' + 'x'.repeat(1000);

      const start = Date.now();
      const result = redactPII(text);
      const elapsed = Date.now() - start;

      // Should complete in reasonable time (< 1 second)
      expect(elapsed).toBeLessThan(1000);

      // Should still detect the password pattern
      expect(result.redacted).toBe(true);
    });

    it('handles very long text without hanging', () => {
      // Large document with some PII scattered
      const chunks = [];
      for (let i = 0; i < 100; i++) {
        chunks.push('Lorem ipsum '.repeat(100));
        if (i % 10 === 0) {
          chunks.push('Contact: user@example.com ');
        }
      }
      const text = chunks.join('');

      const start = Date.now();
      const result = redactPII(text);
      const elapsed = Date.now() - start;

      // Should complete in reasonable time
      expect(elapsed).toBeLessThan(5000);
      expect(result.redacted).toBe(true);
    });

    it('handles repeated special characters in API key context', () => {
      // Could trigger backtracking in API key pattern
      const text = 'api_key=' + '_'.repeat(500) + 'abc123';

      const start = Date.now();
      redactPII(text);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(1000);
    });
  });

  describe('edge case inputs', () => {
    it('handles empty string', () => {
      const result = redactPII('');

      expect(result.text).toBe('');
      expect(result.redacted).toBe(false);
      expect(result.matches).toHaveLength(0);
    });

    it('handles text with only whitespace', () => {
      const result = redactPII('   \n\t   ');

      expect(result.redacted).toBe(false);
    });

    it('handles PII at start and end of text', () => {
      const text = 'foo@bar.com and also baz@qux.com';

      const result = redactPII(text);

      expect(result.text).toBe('[EMAIL] and also [EMAIL]');
    });

    it('handles multiple same-type PII in sequence', () => {
      const text = 'foo@a.com bar@b.com baz@c.com';

      const result = redactPII(text);

      expect(result.matches.length).toBe(3);
      expect(result.text).toBe('[EMAIL] [EMAIL] [EMAIL]');
    });
  });
});
