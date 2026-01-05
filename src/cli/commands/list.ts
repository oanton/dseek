/**
 * List command - list indexed documents
 *
 * Displays all indexed documents with size and update time.
 *
 * @module cli/commands/list
 */

import { Command } from 'commander';
import { UI } from '../../core/constants.js';
import { getAllDocuments } from '../../storage/metadata.js';

export const listCommand = new Command('list')
  .description('List indexed documents')
  .option('--json', 'Output as JSON')
  .option('-s, --sort <field>', 'Sort by field (path, size, updated)', 'path')
  .action(async (options) => {
    try {
      const documents = await getAllDocuments();

      // Sort documents
      const sorted = [...documents].sort((a, b) => {
        switch (options.sort) {
          case 'size':
            return b.size_bytes - a.size_bytes;
          case 'updated':
            return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
          default:
            return a.doc_id.localeCompare(b.doc_id);
        }
      });

      if (options.json) {
        console.log(JSON.stringify(sorted, null, 2));
        return;
      }

      // Human-readable output
      if (sorted.length === 0) {
        console.log('No documents indexed.');
        console.log('Run `dseek add <path>` to index documents.');
        return;
      }

      console.log(`Indexed Documents (${sorted.length}):`);
      console.log('─'.repeat(UI.LIST_SEPARATOR_WIDTH));

      for (const doc of sorted) {
        const sizeKB = (doc.size_bytes / 1024).toFixed(1);
        const updated = new Date(doc.updated_at).toLocaleString();
        console.log(`${doc.doc_id}`);
        console.log(`  Format: ${doc.format} | Size: ${sizeKB} KB | Updated: ${updated}`);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
