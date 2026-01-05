/**
 * PII detection unit tests
 *
 * Consolidated tests - one test per equivalence class
 * Based on: https://github.com/goldbergyoni/javascript-testing-best-practices
 */

import { describe, expect, it } from 'vitest';
import { detectPII, isSensitivePath, redactPII } from '../../src/privacy/pii.js';

describe('PII Detection', () => {
  it('detects all PII patterns in mixed text', () => {
    const text = `
      Contact Information:
      Email: test@example.com
      Phone: +1-555-123-4567
      Alternative: (555) 987-6543

      Credentials:
      JWT: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U
      AWS: AKIAIOSFODNN7EXAMPLE

      Payment:
      Card: 4111-1111-1111-1111

      Network:
      Server IP: 192.168.1.100
    `;

    const matches = detectPII(text);
    const types = new Set(matches.map((m) => m.type));

    // All PII types should be detected
    expect(types).toContain('email');
    expect(types).toContain('phone');
    expect(types).toContain('jwt');
    expect(types).toContain('aws_key');
    expect(types).toContain('credit_card');
    expect(types).toContain('ip_address');

    // Should have found multiple matches
    expect(matches.length).toBeGreaterThanOrEqual(6);
  });

  it('redacts all PII types with correct placeholders', () => {
    const text = 'Contact test@example.com or call +1-555-123-4567 from 192.168.1.1';
    const result = redactPII(text);

    expect(result.redacted).toBe(true);
    expect(result.text).toContain('[EMAIL]');
    expect(result.text).toContain('[PHONE]');
    expect(result.text).toContain('[IP_ADDRESS]');
    expect(result.text).not.toContain('test@example.com');
    expect(result.text).not.toContain('+1-555-123-4567');
    expect(result.matches.length).toBeGreaterThanOrEqual(3);
  });

  it('returns clean text unchanged', () => {
    const text = 'Hello world, this document has no PII whatsoever!';
    const result = redactPII(text);

    expect(result.redacted).toBe(false);
    expect(result.text).toBe(text);
    expect(result.matches).toHaveLength(0);
  });

  it('identifies sensitive file paths', () => {
    // Sensitive paths - should return true
    const sensitivePaths = [
      '.env',
      '.env.local',
      '.env.production',
      'credentials.json',
      'secrets.yml',
      'private.key',
      'id_rsa',
      'id_ed25519',
    ];

    for (const path of sensitivePaths) {
      expect(isSensitivePath(path)).toBe(true);
    }

    // Regular paths - should return false
    const regularPaths = ['readme.md', 'index.ts', 'package.json', 'config.json', 'main.go'];

    for (const path of regularPaths) {
      expect(isSensitivePath(path)).toBe(false);
    }
  });
});
