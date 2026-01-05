/**
 * Configuration management for DSEEK
 *
 * Handles project initialization, configuration loading/saving,
 * source management, and ignore patterns.
 *
 * @module config
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { DseekConfig, Source } from '../types/index.js';
import { DIRS, FILES, LIMITS, RETRIEVAL_WEIGHTS } from './constants.js';

const DEFAULT_CONFIG: DseekConfig = {
  schema_version: 1,
  project_id: 'auto',
  sources: [],
  chunking: {
    strategy: 'markdown-structure',
    fallback: {
      chunk_size: LIMITS.DEFAULT_CHUNK_SIZE,
      overlap: LIMITS.DEFAULT_CHUNK_OVERLAP,
    },
  },
  retrieval: {
    mode: 'hybrid',
    fusion: 'rrf',
    semantic_weight: RETRIEVAL_WEIGHTS.SEMANTIC,
    keyword_weight: RETRIEVAL_WEIGHTS.KEYWORD,
    default_limit: LIMITS.DEFAULT_RESULTS,
    max_limit: LIMITS.MAX_RESULTS,
    pagination: {
      enabled: true,
    },
  },
  privacy: {
    local_only: true,
    allow_remote: false,
    require_boundary_key: true,
    boundary_key_env: 'DSEEK_DATA_BOUNDARY_KEY',
    redact_before_remote: true,
    pii_detectors: ['regex_rules'],
  },
  runtime: {
    auto_bootstrap: true,
    log_level: 'info',
  },
};

const DEFAULT_IGNORE = `# DSEEK ignore patterns
.git/
.dseek/
node_modules/
build/
dist/
.dart_tool/
Pods/
DerivedData/
`;

/**
 * Find the project root directory.
 *
 * Searches upward for `.dseek/` or `.git/` directory.
 * Respects `DSEEK_PROJECT_ROOT` env var for testing.
 *
 * @param startPath - Starting directory (default: cwd)
 * @returns Project root path
 */
export function findProjectRoot(startPath: string = process.cwd()): string {
  // Allow override via environment variable (for testing)
  const envRoot = process.env.DSEEK_PROJECT_ROOT;
  if (envRoot) {
    return envRoot;
  }

  let current = startPath;

  while (current !== '/') {
    if (existsSync(join(current, DIRS.DSEEK)) || existsSync(join(current, '.git'))) {
      return current;
    }
    current = dirname(current);
  }

  return startPath;
}

/**
 * Get the path to the .dseek directory
 */
export function getDseekDir(projectRoot?: string): string {
  const root = projectRoot ?? findProjectRoot();
  return join(root, DIRS.DSEEK);
}

/**
 * Get the path to the config file
 */
export function getConfigPath(projectRoot?: string): string {
  const root = projectRoot ?? findProjectRoot();
  return join(root, FILES.CONFIG);
}

/**
 * Check if DSEEK is initialized in the project
 */
export function isInitialized(projectRoot?: string): boolean {
  return existsSync(getConfigPath(projectRoot));
}

/**
 * Load the configuration file.
 *
 * Merges user config with defaults for missing values.
 *
 * @param projectRoot - Optional project root override
 * @returns Complete configuration object
 */
export async function loadConfig(projectRoot?: string): Promise<DseekConfig> {
  const configPath = getConfigPath(projectRoot);

  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }

  const content = await readFile(configPath, 'utf-8');
  const config = JSON.parse(content) as Partial<DseekConfig>;

  // Merge with defaults
  return {
    ...DEFAULT_CONFIG,
    ...config,
    chunking: { ...DEFAULT_CONFIG.chunking, ...config.chunking },
    retrieval: { ...DEFAULT_CONFIG.retrieval, ...config.retrieval },
    privacy: { ...DEFAULT_CONFIG.privacy, ...config.privacy },
    runtime: { ...DEFAULT_CONFIG.runtime, ...config.runtime },
  };
}

/**
 * Save configuration to disk.
 *
 * @param config - Configuration to save
 * @param projectRoot - Optional project root override
 */
export async function saveConfig(config: DseekConfig, projectRoot?: string): Promise<void> {
  const configPath = getConfigPath(projectRoot);
  const dseekDir = getDseekDir(projectRoot);

  // Ensure .dseek directory exists
  if (!existsSync(dseekDir)) {
    await mkdir(dseekDir, { recursive: true });
  }

  await writeFile(configPath, JSON.stringify(config, null, 2));
}

/**
 * Initialize DSEEK in the project.
 *
 * Creates `.dseek/` directory structure, default config, and ignore file.
 *
 * @param projectRoot - Optional project root override
 */
export async function initializeProject(projectRoot?: string): Promise<void> {
  const root = projectRoot ?? findProjectRoot();
  const dseekDir = join(root, DIRS.DSEEK);

  // Create directories
  await mkdir(join(dseekDir, DIRS.INDEX), { recursive: true });
  await mkdir(join(dseekDir, DIRS.MODELS), { recursive: true });
  await mkdir(join(dseekDir, DIRS.RUN), { recursive: true });
  await mkdir(join(dseekDir, DIRS.LOGS), { recursive: true });
  await mkdir(join(dseekDir, DIRS.CACHE), { recursive: true });

  // Create config if not exists
  const configPath = getConfigPath(root);
  if (!existsSync(configPath)) {
    await saveConfig(DEFAULT_CONFIG, root);
  }

  // Create ignore file if not exists
  const ignorePath = join(root, FILES.IGNORE);
  if (!existsSync(ignorePath)) {
    await writeFile(ignorePath, DEFAULT_IGNORE);
  }
}

/**
 * Add or update a source in the configuration.
 *
 * Replaces existing source with same name.
 *
 * @param source - Source configuration to add
 * @param projectRoot - Optional project root override
 */
export async function addSource(source: Source, projectRoot?: string): Promise<void> {
  const config = await loadConfig(projectRoot);

  // Remove existing source with same name
  config.sources = config.sources.filter((s) => s.name !== source.name);

  // Add new source
  config.sources.push(source);

  await saveConfig(config, projectRoot);
}

/**
 * Remove a source from the configuration.
 *
 * @param name - Source name to remove
 * @param projectRoot - Optional project root override
 * @returns True if source was found and removed
 */
export async function removeSource(name: string, projectRoot?: string): Promise<boolean> {
  const config = await loadConfig(projectRoot);
  const initialLength = config.sources.length;

  config.sources = config.sources.filter((s) => s.name !== name);

  if (config.sources.length < initialLength) {
    await saveConfig(config, projectRoot);
    return true;
  }

  return false;
}

/**
 * Load ignore patterns from `.dseek/ignore`.
 *
 * @param projectRoot - Optional project root override
 * @returns Array of ignore patterns
 */
export async function loadIgnorePatterns(projectRoot?: string): Promise<string[]> {
  const root = projectRoot ?? findProjectRoot();
  const ignorePath = join(root, FILES.IGNORE);

  if (!existsSync(ignorePath)) {
    return DEFAULT_IGNORE.split('\n').filter((line) => line && !line.startsWith('#'));
  }

  const content = await readFile(ignorePath, 'utf-8');
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

/**
 * Generate a project ID
 */
export function generateProjectId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `dseek_${timestamp}_${random}`;
}

/**
 * Validate configuration for errors.
 *
 * @param config - Configuration to validate
 * @returns Array of validation error messages (empty if valid)
 */
export function validateConfig(config: DseekConfig): string[] {
  const errors: string[] = [];

  if (config.schema_version !== 1) {
    errors.push(`Unsupported schema version: ${config.schema_version}`);
  }

  if (config.retrieval.semantic_weight + config.retrieval.keyword_weight !== 1) {
    errors.push('semantic_weight + keyword_weight must equal 1');
  }

  if (config.chunking.fallback.chunk_size < LIMITS.MIN_CHUNK_SIZE) {
    errors.push(`chunk_size must be at least ${LIMITS.MIN_CHUNK_SIZE}`);
  }

  if (config.chunking.fallback.overlap >= config.chunking.fallback.chunk_size) {
    errors.push('overlap must be less than chunk_size');
  }

  for (const source of config.sources) {
    if (!source.name) {
      errors.push('Source must have a name');
    }
    if (!source.path) {
      errors.push(`Source "${source.name}" must have a path`);
    }
  }

  return errors;
}
