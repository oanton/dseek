/**
 * Configuration module unit tests
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  addSource,
  generateProjectId,
  loadConfig,
  removeSource,
  saveConfig,
  validateConfig,
} from '../../src/core/config.js';
import type { DseekConfig, Source } from '../../src/types/index.js';

const TEST_DIR = join(process.cwd(), '.test-config');
const DSEEK_DIR = join(TEST_DIR, '.dseek');

// Default config for comparison
const DEFAULT_CONFIG: DseekConfig = {
  schema_version: 1,
  project_id: 'auto',
  sources: [],
  chunking: {
    strategy: 'markdown-structure',
    fallback: {
      chunk_size: 900,
      overlap: 150,
    },
  },
  retrieval: {
    mode: 'hybrid',
    fusion: 'rrf',
    semantic_weight: 0.75,
    keyword_weight: 0.25,
    default_limit: 8,
    max_limit: 12,
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

describe('Config', () => {
  beforeEach(() => {
    // Create test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(DSEEK_DIR, { recursive: true });
  });

  afterEach(() => {
    // Cleanup
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  it('loads config with defaults for missing fields', async () => {
    // Create minimal config with only required fields
    const minimalConfig = {
      schema_version: 1,
      project_id: 'test-project',
      sources: [],
    };

    writeFileSync(join(DSEEK_DIR, 'config.json'), JSON.stringify(minimalConfig));

    const config = await loadConfig(TEST_DIR);

    // Should have project_id from file
    expect(config.project_id).toBe('test-project');

    // Should have defaults for missing sections
    expect(config.chunking.strategy).toBe('markdown-structure');
    expect(config.chunking.fallback.chunk_size).toBe(900);
    expect(config.retrieval.mode).toBe('hybrid');
    expect(config.retrieval.semantic_weight).toBe(0.75);
    expect(config.privacy.local_only).toBe(true);
    expect(config.runtime.log_level).toBe('info');
  });

  it('validates correct config returns no errors', () => {
    const errors = validateConfig(DEFAULT_CONFIG);
    expect(errors).toHaveLength(0);
  });

  it('validates semantic + keyword weights must equal 1', () => {
    const config: DseekConfig = {
      ...DEFAULT_CONFIG,
      retrieval: {
        ...DEFAULT_CONFIG.retrieval,
        semantic_weight: 0.5,
        keyword_weight: 0.3, // 0.5 + 0.3 = 0.8, not 1
      },
    };

    const errors = validateConfig(config);
    expect(errors).toContain('semantic_weight + keyword_weight must equal 1');
  });

  it('validates chunk_size minimum', () => {
    const config: DseekConfig = {
      ...DEFAULT_CONFIG,
      chunking: {
        ...DEFAULT_CONFIG.chunking,
        fallback: {
          chunk_size: 50, // Below minimum of 100
          overlap: 10,
        },
      },
    };

    const errors = validateConfig(config);
    expect(errors).toContain('chunk_size must be at least 100');
  });

  it('addSource replaces existing source with same name', async () => {
    // Save initial config
    await saveConfig(DEFAULT_CONFIG, TEST_DIR);

    // Add first source
    const source1: Source = {
      name: 'docs',
      path: './docs',
      include: ['**/*.md'],
      exclude: [],
      watch: true,
    };
    await addSource(source1, TEST_DIR);

    // Add second source with same name but different path
    const source2: Source = {
      name: 'docs',
      path: './documentation', // Different path
      include: ['**/*.md', '**/*.txt'],
      exclude: ['**/drafts/**'],
      watch: false,
    };
    await addSource(source2, TEST_DIR);

    // Load and verify
    const config = await loadConfig(TEST_DIR);

    // Should have only one source named "docs"
    const docsSources = config.sources.filter((s) => s.name === 'docs');
    expect(docsSources).toHaveLength(1);

    // Should have the second source's values
    expect(docsSources[0].path).toBe('./documentation');
    expect(docsSources[0].include).toContain('**/*.txt');
    expect(docsSources[0].watch).toBe(false);
  });

  it('validates overlap must be less than chunk_size', () => {
    const config: DseekConfig = {
      ...DEFAULT_CONFIG,
      chunking: {
        ...DEFAULT_CONFIG.chunking,
        fallback: {
          chunk_size: 500,
          overlap: 500, // Equal to chunk_size - invalid
        },
      },
    };

    const errors = validateConfig(config);
    expect(errors).toContain('overlap must be less than chunk_size');
  });

  it('validates source without name', () => {
    const config: DseekConfig = {
      ...DEFAULT_CONFIG,
      sources: [
        {
          name: '', // Empty name
          path: './docs',
          include: [],
          exclude: [],
          watch: false,
        },
      ],
    };

    const errors = validateConfig(config);
    expect(errors).toContain('Source must have a name');
  });

  it('validates source without path', () => {
    const config: DseekConfig = {
      ...DEFAULT_CONFIG,
      sources: [
        {
          name: 'docs',
          path: '', // Empty path
          include: [],
          exclude: [],
          watch: false,
        },
      ],
    };

    const errors = validateConfig(config);
    expect(errors.some((e) => e.includes('must have a path'))).toBe(true);
  });

  it('removeSource returns false for non-existent source', async () => {
    await saveConfig(DEFAULT_CONFIG, TEST_DIR);

    const removed = await removeSource('non-existent', TEST_DIR);

    expect(removed).toBe(false);
  });

  it('generateProjectId produces unique IDs', () => {
    const id1 = generateProjectId();
    const id2 = generateProjectId();

    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^dseek_[a-z0-9]+_[a-z0-9]+$/);
    expect(id2).toMatch(/^dseek_[a-z0-9]+_[a-z0-9]+$/);
  });

  it('loadConfig handles missing nested objects with defaults', async () => {
    // Config with completely missing sections
    const partialConfig = {
      schema_version: 1,
      project_id: 'partial-test',
      sources: [],
    };

    writeFileSync(join(DSEEK_DIR, 'config.json'), JSON.stringify(partialConfig));

    const config = await loadConfig(TEST_DIR);

    // All nested sections should have defaults
    expect(config.chunking).toBeDefined();
    expect(config.chunking.strategy).toBe('markdown-structure');
    expect(config.retrieval).toBeDefined();
    expect(config.retrieval.mode).toBe('hybrid');
    expect(config.privacy).toBeDefined();
    expect(config.privacy.local_only).toBe(true);
    expect(config.runtime).toBeDefined();
    expect(config.runtime.log_level).toBe('info');
  });
});
