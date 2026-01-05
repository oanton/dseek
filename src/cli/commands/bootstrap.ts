/**
 * Bootstrap command - downloads required models
 *
 * Initializes project and downloads embedding/reranker models.
 *
 * @module cli/commands/bootstrap
 */

import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { Command } from 'commander';
import { getDseekDir, initializeProject, isInitialized } from '../../core/config.js';
import { DIRS } from '../../core/constants.js';
import { getEmbedder, getModelName, getModelsDir } from '../../core/embedder.js';
import { bootstrapReranker, getRerankerModelName } from '../../core/reranker.js';

export const bootstrapCommand = new Command('bootstrap')
  .description('Download required models and initialize DSEEK')
  .option('-f, --force', 'Force re-download even if models exist')
  .option('--reranker', 'Also download reranker model (~80MB)')
  .option('--all', 'Download all models (embedding + reranker)')
  .action(async (options: { force?: boolean; reranker?: boolean; all?: boolean }) => {
    try {
      console.log('DSEEK Bootstrap');
      console.log('===============\n');

      // Initialize project structure if needed
      if (!isInitialized()) {
        console.log('Initializing project structure...');
        await initializeProject();
        console.log(`Created ${DIRS.DSEEK}/ directory\n`);
      }

      // Ensure models directory exists
      const modelsDir = getModelsDir();
      if (!existsSync(modelsDir)) {
        await mkdir(modelsDir, { recursive: true });
      }

      const startTime = Date.now();

      // Download models in parallel if --all, otherwise sequential
      if (options.all) {
        console.log('Downloading all models in parallel:');
        console.log(`  - Embedding: ${getModelName()}`);
        console.log(`  - Reranker: ${getRerankerModelName()}`);
        console.log('This may take a few minutes on first run...\n');

        try {
          await Promise.all([getEmbedder(), bootstrapReranker()]);
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`\nAll models ready! (${elapsed}s)`);
        } catch (error) {
          console.error('\nFailed to download models:', error);
          process.exit(1);
        }
      } else {
        // Download embedding model
        console.log(`Downloading embedding model: ${getModelName()}`);
        console.log('This may take a few minutes on first run...\n');

        try {
          await getEmbedder();
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`\nModel ready! (${elapsed}s)`);
        } catch (error) {
          console.error('\nFailed to download model:', error);
          process.exit(1);
        }

        // Download reranker model if requested
        if (options.reranker) {
          console.log(`\nDownloading reranker model: ${getRerankerModelName()}`);
          console.log('This may take a few minutes...\n');

          const rerankerStart = Date.now();

          try {
            await bootstrapReranker();
            const elapsed = ((Date.now() - rerankerStart) / 1000).toFixed(1);
            console.log(`\nReranker ready! (${elapsed}s)`);
          } catch (error) {
            console.error('\nFailed to download reranker model:', error);
            process.exit(1);
          }
        }
      }

      // Summary
      console.log('\nBootstrap complete!');
      console.log('-------------------');
      console.log(`Models directory: ${modelsDir}`);
      console.log(`Config: ${getDseekDir()}/config.json`);
      console.log('\nNext steps:');
      console.log('  dseek add ./docs    # Add a docs folder to index');
      console.log('  dseek search "..."  # Search your documentation');
      if (!options.reranker && !options.all) {
        console.log('\nTip: Run "dseek bootstrap --reranker" to enable --rerank option');
      }
    } catch (error) {
      console.error('Bootstrap failed:', error);
      process.exit(1);
    }
  });

export default bootstrapCommand;
