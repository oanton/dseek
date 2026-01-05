/**
 * Status command - show index state
 *
 * Displays index statistics, document count, and last event.
 *
 * @module cli/commands/status
 */

import { Command } from 'commander';
import { getStatus } from '../../core/retrieval.js';

export const statusCommand = new Command('status')
  .description('Show index status')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      const status = await getStatus();

      if (options.json) {
        console.log(JSON.stringify(status, null, 2));
        return;
      }

      // Human-readable output
      console.log('DSEEK Index Status');
      console.log('==================');
      console.log(`Project ID: ${status.project_id}`);
      console.log(`State: ${status.index_state}`);
      console.log(`Documents: ${status.documents}`);
      console.log(`Chunks: ${status.chunks}`);
      console.log(`Queued files: ${status.queued_files}`);

      if (status.last_event) {
        console.log(`\nLast event:`);
        console.log(`  Type: ${status.last_event.type}`);
        console.log(`  Path: ${status.last_event.path}`);
        console.log(`  At: ${status.last_event.at}`);
      }

      if (status.warnings.length > 0) {
        console.log(`\nWarnings:`);
        for (const w of status.warnings) {
          console.log(`  - ${w}`);
        }
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
