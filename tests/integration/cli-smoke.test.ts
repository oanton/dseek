/**
 * CLI Smoke Tests
 *
 * Basic tests to ensure CLI commands don't crash and produce expected output.
 */

import { type ExecSyncOptionsWithStringEncoding, execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const CLI = 'npx tsx bin/dseek.ts';
const execOptions: ExecSyncOptionsWithStringEncoding = {
  encoding: 'utf-8',
  timeout: 10000,
};

/**
 * Execute CLI command and return stdout
 */
function runCli(args: string): string {
  return execSync(`${CLI} ${args}`, execOptions);
}

/**
 * Execute CLI command and return exit code (0 on success)
 */
function runCliWithCode(args: string): { stdout: string; exitCode: number } {
  try {
    const stdout = execSync(`${CLI} ${args}`, execOptions);
    return { stdout, exitCode: 0 };
  } catch (error: unknown) {
    const err = error as { stdout?: string; status?: number };
    return {
      stdout: err.stdout ?? '',
      exitCode: err.status ?? 1,
    };
  }
}

describe('CLI Smoke Tests', () => {
  it('--version shows version number', () => {
    const output = runCli('--version');

    // Should contain a version-like string (e.g., "0.1.0" or "1.0.0")
    expect(output).toMatch(/\d+\.\d+\.\d+/);
  });

  it('--help shows available commands', () => {
    const output = runCli('--help');

    // Should list main commands
    expect(output).toContain('bootstrap');
    expect(output).toContain('add');
    expect(output).toContain('search');
    expect(output).toContain('chat');
    expect(output).toContain('status');
  });

  it('help for specific command shows usage', () => {
    const output = runCli('add --help');

    // Should show add command usage
    expect(output.toLowerCase()).toContain('add');
    expect(output.toLowerCase()).toMatch(/path|source|directory/);
  });

  it('unknown command exits with non-zero code', () => {
    const { exitCode, stdout } = runCliWithCode('unknown-command-xyz');

    // Should fail with non-zero exit code
    expect(exitCode).not.toBe(0);
  });

  it('search without query shows error', () => {
    const { exitCode } = runCliWithCode('search');

    // Should fail - missing required argument
    expect(exitCode).not.toBe(0);
  });

  it('chat without query shows error', () => {
    const { exitCode } = runCliWithCode('chat');

    // Should fail - missing required argument
    expect(exitCode).not.toBe(0);
  });
});
