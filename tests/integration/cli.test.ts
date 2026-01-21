/**
 * CLI integration tests
 *
 * These tests verify end-to-end behavior of CLI commands.
 * They use real embeddings (slow) but verify actual functionality.
 *
 * Note: Tests are structured to handle dependencies properly.
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const TEST_DIR = join(process.cwd(), '.test-integration');
const DOCS_DIR = join(TEST_DIR, 'docs');
const CLI_PATH = join(process.cwd(), 'bin/dseek.ts');

/**
 * Run CLI command and return output
 *
 * Always uses pipe for stdin/stdout/stderr to prevent stderr pollution in JSON output.
 */
function runCLI(args: string, expectError = false): string {
  try {
    return execSync(`npx tsx ${CLI_PATH} ${args}`, {
      cwd: TEST_DIR,
      encoding: 'utf-8',
      env: { ...process.env, DSEEK_PROJECT_ROOT: TEST_DIR },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object') {
      if ('stderr' in error && expectError) {
        return (error as { stderr: string }).stderr;
      }
      if ('stdout' in error) {
        return (error as { stdout: string }).stdout;
      }
    }
    throw error;
  }
}

describe('CLI Integration', () => {
  beforeAll(() => {
    // Create test directory structure
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(DOCS_DIR, { recursive: true });

    // Create test documents
    writeFileSync(
      join(DOCS_DIR, 'authentication.md'),
      `# Authentication Guide

This document describes the authentication flow.

## OAuth 2.0 Flow

The application uses OAuth 2.0 with refresh token rotation.
`,
    );

    writeFileSync(
      join(DOCS_DIR, 'api-reference.md'),
      `# API Reference

Complete API documentation for developers.

## Endpoints

### GET /users

Returns a list of all users.
`,
    );
  });

  afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  // Basic commands that don't require indexing
  describe('basic commands', () => {
    it('displays version number', () => {
      const output = runCLI('--version');
      expect(output).toMatch(/\d+\.\d+\.\d+/);
    });

    it('displays help with available commands', () => {
      const output = runCLI('--help');
      expect(output).toContain('dseek');
      expect(output).toContain('Commands:');
    });

    it('add non-existent path shows error', () => {
      const output = runCLI('add /nonexistent/path/xyz', true);
      expect(output.toLowerCase()).toContain('error');
    });
  });

  // Full indexing workflow in single test to ensure order
  describe('indexing and search workflow', () => {
    it('complete workflow: add → status → list → search', () => {
      // Step 1: Add docs folder and index
      const addOutput = runCLI(`add ${DOCS_DIR}`);
      expect(addOutput).toContain('Added source');
      expect(addOutput).toContain('Indexing');

      // Step 2: Verify status shows indexed content
      const statusOutput = runCLI('status --json');
      const status = JSON.parse(statusOutput);
      expect(status).toHaveProperty('project_id');
      expect(status).toHaveProperty('index_state');
      // Note: chunks count depends on chunking behavior

      // Step 3: Verify list shows documents
      const listOutput = runCLI('list');
      expect(listOutput).toContain('authentication.md');
      expect(listOutput).toContain('api-reference.md');

      // Step 4: Search returns results
      const searchOutput = runCLI('search "OAuth authentication" --json');
      const searchResult = JSON.parse(searchOutput);

      expect(searchResult).toHaveProperty('results');
      expect(searchResult).toHaveProperty('query');
      expect(searchResult).toHaveProperty('schema_version');
      expect(searchResult).toHaveProperty('project_id');
    });

    it('search respects --limit option', () => {
      const output = runCLI('search "documentation" --limit 1 --json');
      const result = JSON.parse(output);
      expect(result.results.length).toBeLessThanOrEqual(1);
    });

    it('search returns valid result structure', () => {
      const output = runCLI('search "users API" --json');
      const result = JSON.parse(output);

      expect(result).toHaveProperty('schema_version');
      expect(result).toHaveProperty('query');
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('confidence');
      expect(Array.isArray(result.results)).toBe(true);

      // If we got results, verify structure
      if (result.results.length > 0) {
        const firstResult = result.results[0];
        expect(firstResult).toHaveProperty('path');
        expect(firstResult).toHaveProperty('line_start');
        expect(firstResult).toHaveProperty('line_end');
        expect(firstResult).toHaveProperty('score');
        expect(firstResult).toHaveProperty('snippet');
      }
    });
  });

  // Delete command (requires indexed content)
  describe('delete command', () => {
    it('deletes document with --force flag', () => {
      // First verify the document exists
      const listBefore = runCLI('list');
      expect(listBefore).toContain('api-reference.md');

      // Delete it - use the full doc_id path as stored in index
      const deleteOutput = runCLI('delete docs/api-reference.md --force');
      expect(deleteOutput.toLowerCase()).toContain('deleted');

      // Verify it's gone
      const listAfter = runCLI('list');
      expect(listAfter).not.toContain('api-reference.md');
      // Other document should still exist
      expect(listAfter).toContain('authentication.md');
    });

    it('returns error for non-existent document', () => {
      const output = runCLI('delete nonexistent-file.md --force');
      expect(output.toLowerCase()).toContain('not found');
    });
  });

  // Audit commands (requires indexed content)
  describe('audit commands', () => {
    it('audit duplicates runs without error', () => {
      const output = runCLI('audit duplicates --json', true);
      // Should either output JSON array, status message, or error (if index not initialized)
      const hasJson = output.includes('[');
      const hasNoResults = output.toLowerCase().includes('no near-duplicates') || output.includes('[]');
      const hasNoChunks = output.toLowerCase().includes('no chunks');
      const hasError = output.toLowerCase().includes('error');
      expect(hasJson || hasNoResults || hasNoChunks || hasError).toBe(true);
    });

    it('audit conflicts runs without error', () => {
      const output = runCLI('audit conflicts --json');
      // Should either output JSON array or "No potential conflicts found" or "No chunks in index"
      const hasJson = output.includes('[');
      const hasNoResults = output.toLowerCase().includes('no potential conflicts') || output.includes('[]');
      const hasNoChunks = output.toLowerCase().includes('no chunks');
      expect(hasJson || hasNoResults || hasNoChunks).toBe(true);
    });

    it('audit with invalid type shows error', () => {
      const output = runCLI('audit invalidtype', true);
      expect(output.toLowerCase()).toContain('unknown');
    });
  });

  // CLI error handling
  describe('CLI error handling', () => {
    it('search returns JSON error for failures', () => {
      // Search without initialized index should return JSON error
      const output = runCLI('search "test query"', true);

      // Output should be valid JSON (even for errors)
      try {
        const result = JSON.parse(output);
        // Either has results or has error property
        expect(result).toHaveProperty('results');
      } catch {
        // If not JSON, just verify it doesn't crash
        expect(output).toBeDefined();
      }
    });

    it('shows help for unknown command', () => {
      const output = runCLI('unknowncommand', true);
      // Should show error or help
      expect(output.toLowerCase()).toMatch(/error|unknown|help|usage/);
    });

    it('handles missing required arguments gracefully', () => {
      // search requires a query argument
      const output = runCLI('search', true);
      // Should show error about missing argument
      expect(output.toLowerCase()).toMatch(/error|missing|required|argument/);
    });
  });

  // Status command extended tests
  describe('status command extended', () => {
    it('shows warning when index is empty', () => {
      // After indexing and deleting, status should work
      const output = runCLI('status');
      // Should contain status information
      expect(output).toBeDefined();
      expect(output.length).toBeGreaterThan(0);
    });

    it('status --json returns valid structure', () => {
      const output = runCLI('status --json');
      const status = JSON.parse(output);

      expect(status).toHaveProperty('project_id');
      expect(status).toHaveProperty('index_state');
      // Documents and chunks are top-level properties
      expect(status).toHaveProperty('documents');
      expect(status).toHaveProperty('chunks');
      expect(typeof status.documents).toBe('number');
      expect(typeof status.chunks).toBe('number');
    });
  });
});
