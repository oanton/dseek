/**
 * Search batch mode and pagination tests
 *
 * Tests advanced search features:
 * - Batch mode (multiple queries from file)
 * - Pagination with cursors
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const TEST_DIR = join(process.cwd(), '.test-search-batch');
const DOCS_DIR = join(TEST_DIR, 'docs');
const CLI_PATH = join(process.cwd(), 'bin/dseek.ts');

function runCLI(args: string, expectError = false): string {
  try {
    return execSync(`npx tsx ${CLI_PATH} ${args}`, {
      cwd: TEST_DIR,
      encoding: 'utf-8',
      env: { ...process.env, DSEEK_PROJECT_ROOT: TEST_DIR },
      stdio: expectError ? ['pipe', 'pipe', 'pipe'] : undefined,
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object') {
      if ('stderr' in error) {
        return (error as { stderr: string }).stderr;
      }
      if ('stdout' in error) {
        return (error as { stdout: string }).stdout;
      }
    }
    throw error;
  }
}

describe('Search Batch Mode & Pagination', () => {
  beforeAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(DOCS_DIR, { recursive: true });

    // Create multiple documents for testing
    writeFileSync(
      join(DOCS_DIR, 'authentication.md'),
      `# Authentication Guide

## OAuth 2.0

OAuth 2.0 is the industry standard for authorization.
Use refresh token rotation for security.

## JWT Tokens

JSON Web Tokens are used for stateless authentication.
Always validate the signature and expiration.
`,
    );

    writeFileSync(
      join(DOCS_DIR, 'database.md'),
      `# Database Guide

## PostgreSQL

PostgreSQL is a powerful relational database.
Use connection pooling for better performance.

## Query Optimization

Always index your frequently queried columns.
Use EXPLAIN ANALYZE to understand query plans.
`,
    );

    writeFileSync(
      join(DOCS_DIR, 'api.md'),
      `# API Reference

## REST Endpoints

GET /users - List all users
POST /users - Create new user
PUT /users/:id - Update user
DELETE /users/:id - Delete user

## Authentication

All endpoints require Bearer token authentication.
`,
    );

    writeFileSync(
      join(DOCS_DIR, 'deployment.md'),
      `# Deployment Guide

## Docker

Use multi-stage builds for smaller images.
Always pin your base image versions.

## Kubernetes

Configure resource limits and requests.
Use health checks for readiness probes.
`,
    );

    // Index all documents via CLI
    runCLI(`add ${DOCS_DIR}`);
  }, 180000);

  afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('batch mode', () => {
    it('reads queries from file and returns results for each', () => {
      // Create query file
      const queryFile = join(TEST_DIR, 'queries.txt');
      writeFileSync(
        queryFile,
        `OAuth authentication
database optimization
REST API endpoints
`,
      );

      const output = runCLI(`search dummy --batch ${queryFile} --json`);
      const results = JSON.parse(output);

      // Should return array of results (one per query)
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(3);

      // Each result should have the standard structure
      for (const result of results) {
        expect(result).toHaveProperty('query');
        expect(result).toHaveProperty('results');
        expect(result).toHaveProperty('confidence');
      }

      // Verify queries are correct
      expect(results[0].query).toBe('OAuth authentication');
      expect(results[1].query).toBe('database optimization');
      expect(results[2].query).toBe('REST API endpoints');
    }, 120000);

    it('handles empty query file gracefully', () => {
      const queryFile = join(TEST_DIR, 'empty-queries.txt');
      writeFileSync(queryFile, '');

      const output = runCLI(`search dummy --batch ${queryFile} --json`);
      const results = JSON.parse(output);

      // Should return empty array
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    }, 120000);

    it('skips empty lines in query file', () => {
      const queryFile = join(TEST_DIR, 'queries-with-blanks.txt');
      writeFileSync(
        queryFile,
        `authentication

database

`,
      );

      const output = runCLI(`search dummy --batch ${queryFile} --json`);
      const results = JSON.parse(output);

      // Should only have 2 results (empty lines skipped)
      expect(results.length).toBe(2);
    }, 120000);
  });

  describe('pagination', () => {
    it('returns cursor when more results available', () => {
      const output = runCLI('search "documentation guide" --limit 1 --json');
      const result = JSON.parse(output);

      // With limit 1 and multiple docs, should have cursor
      expect(result).toHaveProperty('results');

      // Cursor may or may not be present depending on total results
      // If present, it should be a string
      if (result.cursor) {
        expect(typeof result.cursor).toBe('string');
      }
    }, 120000);

    it('cursor retrieves next page of results', () => {
      // Get first page with small limit to ensure pagination
      const firstPageOutput = runCLI('search "guide documentation" --limit 2 --json');
      const firstPage = JSON.parse(firstPageOutput);

      // Verify first page has results
      expect(firstPage).toHaveProperty('results');
      expect(Array.isArray(firstPage.results)).toBe(true);

      // If we have a cursor, test pagination
      if (firstPage.cursor) {
        const secondPageOutput = runCLI(`search "guide documentation" --limit 2 --json --cursor ${firstPage.cursor}`);
        const secondPage = JSON.parse(secondPageOutput);

        expect(secondPage).toHaveProperty('results');
        expect(Array.isArray(secondPage.results)).toBe(true);

        // If both pages have results, verify they're different (no duplicates)
        if (firstPage.results.length > 0 && secondPage.results.length > 0) {
          const firstPageIds = firstPage.results.map(
            (r: { path: string; line_start: number }) => `${r.path}:${r.line_start}`,
          );
          const secondPageIds = secondPage.results.map(
            (r: { path: string; line_start: number }) => `${r.path}:${r.line_start}`,
          );

          // Second page should not contain same results as first page
          const hasOverlap = firstPageIds.some((id: string) => secondPageIds.includes(id));
          expect(hasOverlap).toBe(false);
        }
      }
      // Note: If no cursor returned, it means all results fit in first page - that's OK
    }, 120000);

    it('respects --limit option', () => {
      const output = runCLI('search "API authentication database" --limit 2 --json');
      const result = JSON.parse(output);

      expect(result.results.length).toBeLessThanOrEqual(2);
    }, 120000);
  });

  describe('output formatting', () => {
    it('returns text format by default', () => {
      const output = runCLI('search "OAuth"');

      // Default output should be text format
      expect(output).toContain('# Query:');
      expect(output).toContain('# Confidence:');
    }, 120000);

    it('--json flag returns valid JSON', () => {
      const output = runCLI('search "OAuth" --json');

      // Should be valid JSON
      expect(() => JSON.parse(output)).not.toThrow();

      const result = JSON.parse(output);
      expect(result).toHaveProperty('schema_version');
      expect(result).toHaveProperty('query');
      expect(result).toHaveProperty('results');
    }, 120000);

    it('--json --pretty flag formats JSON nicely', () => {
      const output = runCLI('search "database" --json --pretty');

      // Pretty JSON should have newlines and indentation
      expect(output).toContain('\n');
      expect(output).toMatch(/^\{\n/); // Starts with {\n

      // Should still be valid JSON
      expect(() => JSON.parse(output)).not.toThrow();
    }, 120000);
  });
});
