/**
 * Add command - add source folder and trigger indexing
 *
 * Registers a folder as a source and indexes its contents.
 *
 * @module cli/commands/add
 */

import { existsSync } from 'node:fs';
import { basename, isAbsolute, relative, resolve } from 'node:path';
import { Command } from 'commander';
import { addSource, findProjectRoot, initializeProject } from '../../core/config.js';
import { indexSource } from '../../core/indexer.js';
import type { Source } from '../../types/index.js';

export const addCommand = new Command('add')
  .description('Add a file or folder to the index')
  .argument('<path>', 'Path to the file or folder to index')
  .option('-n, --name <name>', 'Source name (defaults to folder name)')
  .option('-i, --include <patterns...>', 'Include patterns (e.g., "**/*.md")')
  .option('-e, --exclude <patterns...>', 'Exclude patterns')
  .option('--no-index', 'Add source without indexing')
  .action(async (path: string, options) => {
    try {
      const absolutePath = resolve(path);

      // Validate path exists
      if (!existsSync(absolutePath)) {
        console.error(`Error: Path not found: ${absolutePath}`);
        process.exit(1);
      }

      // Find or initialize project
      let projectRoot: string;
      try {
        projectRoot = findProjectRoot();
      } catch {
        console.log('No dseek project found. Initializing...');
        projectRoot = process.cwd();
        await initializeProject(projectRoot);
        console.log('Initialized dseek project in', projectRoot);
      }

      // Use relative path if source is within project root, otherwise absolute
      const relativePath = relative(projectRoot, absolutePath);
      const isWithinProject = !relativePath.startsWith('..') && !isAbsolute(relativePath);
      const sourcePath = isWithinProject ? relativePath : absolutePath;

      // Create source config
      const source: Source = {
        name: options.name ?? basename(absolutePath),
        path: sourcePath,
        include: options.include ?? ['**/*.md', '**/*.txt', '**/*.html', '**/*.pdf', '**/*.docx'],
        exclude: options.exclude ?? [],
        watch: true,
      };

      // Add source to config
      await addSource(source, projectRoot);
      console.log(`Added source: ${source.name} (${source.path})`);

      // Index if requested
      if (options.index !== false) {
        console.log('\nIndexing...');
        const result = await indexSource(source, projectRoot);

        console.log('\nIndexing complete:');
        console.log(`  Indexed: ${result.indexed} files`);
        console.log(`  Skipped: ${result.skipped} files (unchanged)`);
        if (result.errors.length > 0) {
          console.log(`  Errors: ${result.errors.length}`);
          for (const e of result.errors) {
            console.log(`    - ${e}`);
          }
        }
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
