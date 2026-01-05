/**
 * Audit helpers unit tests
 *
 * Tests conflict detection logic for the audit command.
 */

import { describe, expect, it } from 'vitest';
import { detectPotentialConflict } from '../../src/cli/commands/audit.js';

describe('Audit Helpers', () => {
  describe('detectPotentialConflict', () => {
    describe('numeric value conflicts', () => {
      it('detects different numeric values with same unit', () => {
        const result = detectPotentialConflict('File size limit is 10MB', 'Maximum file size is 20MB');

        expect(result.isConflict).toBe(true);
        expect(result.reason).toContain('10MB');
        expect(result.reason).toContain('20MB');
      });

      it('detects different time values', () => {
        const result = detectPotentialConflict('Timeout is set to 30 seconds', 'Default timeout: 60 seconds');

        expect(result.isConflict).toBe(true);
        expect(result.reason).toContain('30 seconds');
        expect(result.reason).toContain('60 seconds');
      });

      it('detects different percentage values', () => {
        const result = detectPotentialConflict('Coverage must be at least 80%', 'Minimum coverage: 90%');

        expect(result.isConflict).toBe(true);
        expect(result.reason).toContain('%');
      });

      it('returns no conflict for same numeric values', () => {
        const result = detectPotentialConflict('Timeout is 30 seconds', 'Default timeout: 30 seconds');

        expect(result.isConflict).toBe(false);
      });
    });

    describe('version number conflicts', () => {
      it('detects different semantic versions', () => {
        const result = detectPotentialConflict('Requires Node.js v18.0.0', 'Requires Node.js v20.0.0');

        expect(result.isConflict).toBe(true);
        expect(result.reason.toLowerCase()).toContain('version');
      });

      it('detects different minor versions', () => {
        const result = detectPotentialConflict('Uses React 18.2.0', 'Uses React 18.3.0');

        expect(result.isConflict).toBe(true);
      });

      it('returns no conflict for same versions', () => {
        const result = detectPotentialConflict('Node.js v18.0.0 required', 'Needs Node.js v18.0.0');

        expect(result.isConflict).toBe(false);
      });
    });

    describe('no conflict cases', () => {
      it('returns no conflict for unrelated content', () => {
        const result = detectPotentialConflict('Authentication uses OAuth 2.0', 'Database uses PostgreSQL 15');

        expect(result.isConflict).toBe(false);
        expect(result.reason).toBe('');
      });

      it('returns no conflict for text without numbers', () => {
        const result = detectPotentialConflict(
          'The system supports multiple users',
          'Users can log in with their credentials',
        );

        expect(result.isConflict).toBe(false);
      });

      it('returns no conflict for different units', () => {
        const result = detectPotentialConflict('File size: 10MB', 'Timeout: 30 seconds');

        expect(result.isConflict).toBe(false);
      });
    });

    describe('edge cases and current limitations', () => {
      it('does not detect currency values without unit pattern', () => {
        // Current implementation requires explicit units (MB, GB, seconds, %, etc.)
        // Currency like "$10" is not detected as a conflict pattern
        const result = detectPotentialConflict('Price is $10 per month', 'Monthly cost: $20');

        // Document: currency detection not implemented
        expect(result.isConflict).toBe(false);
      });

      it('does not detect boolean contradictions', () => {
        // Current implementation only detects numeric/version conflicts
        // Boolean patterns like "enabled/disabled" are not detected
        const result = detectPotentialConflict('Feature is enabled by default', 'Feature is disabled by default');

        // Document: boolean detection not implemented
        expect(result.isConflict).toBe(false);
      });

      it('detects percentage conflicts correctly', () => {
        // Percentages are detected via the % unit pattern
        const result = detectPotentialConflict('Discount is 10% off', 'Apply 20% discount');

        expect(result.isConflict).toBe(true);
        expect(result.reason).toContain('%');
      });
    });
  });
});
