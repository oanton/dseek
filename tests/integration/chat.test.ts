/**
 * Chat command integration tests
 *
 * These tests require Ollama to be running locally.
 * Tests will be skipped if Ollama is not available.
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isOllamaAvailable, listModels } from '../../src/core/llm.js';

const TEST_DIR = join(process.cwd(), '.test-chat');
const DOCS_DIR = join(TEST_DIR, 'docs');
const CLI_PATH = join(process.cwd(), 'bin/dseek.ts');

let ollamaRunning = false;

/**
 * Run CLI command and return output
 */
function runCLI(args: string, expectError = false): string {
  try {
    return execSync(`npx tsx ${CLI_PATH} ${args}`, {
      cwd: TEST_DIR,
      encoding: 'utf-8',
      env: { ...process.env, DSEEK_PROJECT_ROOT: TEST_DIR },
      timeout: 60000, // 60 seconds for LLM responses
      stdio: expectError ? ['pipe', 'pipe', 'pipe'] : undefined,
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object') {
      const err = error as { stderr?: string; stdout?: string; message?: string };
      // Return stderr, stdout, or message - whatever is available
      if (expectError && err.stderr) {
        return err.stderr;
      }
      if (err.stdout) {
        return err.stdout;
      }
      if (err.message) {
        return err.message;
      }
    }
    throw error;
  }
}

describe('Chat Command (Integration)', () => {
  beforeAll(async () => {
    // Check if Ollama is running
    ollamaRunning = await isOllamaAvailable();

    if (!ollamaRunning) {
      console.log('⚠️  Ollama not running - chat tests will be skipped');
    }

    // Always create test directory and documents for all tests
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(DOCS_DIR, { recursive: true });

    writeFileSync(
      join(DOCS_DIR, 'authentication.md'),
      `# Authentication Guide

This document describes the authentication flow for our application.

## OAuth 2.0 Flow

The application uses OAuth 2.0 with refresh token rotation.
When a user logs in, they receive an access token (valid for 1 hour) and a refresh token.

## API Keys

For server-to-server communication, API keys are used.
API keys should be stored securely and never exposed in client-side code.
`,
    );

    // Index the documents
    try {
      runCLI(`add ${DOCS_DIR}`);
    } catch (e) {
      console.log('Failed to index docs:', e);
    }
  });

  afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('isOllamaAvailable', () => {
    it('returns boolean indicating Ollama status', async () => {
      const available = await isOllamaAvailable();
      expect(typeof available).toBe('boolean');
    });
  });

  describe('listModels', () => {
    it('returns array of model names', async () => {
      const models = await listModels();
      expect(Array.isArray(models)).toBe(true);

      if (ollamaRunning) {
        // If Ollama is running, should have at least one model
        // (or empty if no models installed)
        expect(models.every((m) => typeof m === 'string')).toBe(true);
      }
    });
  });

  describe('chat command', () => {
    it.skipIf(!ollamaRunning)(
      'returns answer with context from indexed docs',
      async () => {
        const output = runCLI('chat "What is OAuth?" --json');
        const result = JSON.parse(output);

        expect(result).toHaveProperty('answer');
        expect(result).toHaveProperty('context');
        expect(result.answer.length).toBeGreaterThan(0);
      },
      120000,
    ); // 2 minute timeout for LLM

    it.skipIf(!ollamaRunning)(
      'chat with --show-context includes retrieved chunks',
      async () => {
        const output = runCLI('chat "authentication" --show-context 2>&1');

        // Should show context sections
        expect(output.toLowerCase()).toMatch(/context|retrieved|generating/i);
      },
      120000,
    );

    it.skipIf(!ollamaRunning)('chat with invalid model shows error', async () => {
      const output = runCLI('chat "test" --model nonexistent-model-xyz-12345', true);
      expect(output.toLowerCase()).toContain('not found');
    });

    it('chat shows error when Ollama not running', async () => {
      if (ollamaRunning) {
        // Can't test "not running" error when Ollama is actually running
        // The isOllamaAvailable() function is tested separately
        expect(true).toBe(true);
        return;
      }

      // When Ollama is not running, chat should show an error
      const output = runCLI('chat "test question"', true);
      // Error message could vary, but should indicate connection issue
      expect(output.toLowerCase()).toMatch(/ollama|connection|refused|error|econnrefused/i);
    });
  });
});
