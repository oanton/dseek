/**
 * Delete command - remove document from index
 *
 * Removes a document and its chunks from the search index.
 *
 * @module cli/commands/delete
 */

import { Command } from 'commander';
import { deleteDocument } from '../../core/indexer.js';

export const deleteCommand = new Command('delete')
  .description('Remove a document from the index')
  .argument('<path>', 'Document path or ID to delete')
  .option('-f, --force', 'Skip confirmation')
  .action(async (path: string, options) => {
    try {
      // Confirmation unless forced
      if (!options.force) {
        console.log(`About to delete: ${path}`);
        console.log('Use --force to skip this confirmation.');

        // Simple confirmation via readline
        const readline = await import('node:readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const answer = await new Promise<string>((resolve) => {
          rl.question('Continue? (y/N) ', resolve);
        });
        rl.close();

        if (answer.toLowerCase() !== 'y') {
          console.log('Cancelled.');
          return;
        }
      }

      const deleted = await deleteDocument(path);

      if (deleted) {
        console.log(`Deleted: ${path}`);
      } else {
        console.log(`Document not found: ${path}`);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
