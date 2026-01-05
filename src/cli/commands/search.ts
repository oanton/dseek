/**
 * Search command - hybrid search with JSON output
 *
 * Performs semantic + keyword search with optional reranking.
 *
 * @module cli/commands/search
 */

import { readFileSync } from 'node:fs';
import { Command } from 'commander';
import { LIMITS } from '../../core/constants.js';
import { search } from '../../core/retrieval.js';
import type { SearchQuery } from '../../types/index.js';

export const searchCommand = new Command('search')
  .description('Search indexed documents')
  .argument('<query>', 'Search query')
  .option('-l, --limit <number>', 'Maximum results', String(LIMITS.DEFAULT_RESULTS))
  .option('-c, --cursor <cursor>', 'Pagination cursor')
  .option('--batch <file>', 'Batch search from file (one query per line)')
  .option('--rerank', 'Enable cross-encoder reranking (slower, more accurate)')
  .option('--rerank-top-k <number>', 'Number of candidates to rerank', String(LIMITS.DEFAULT_RERANK_TOP_K))
  .option('--pretty', 'Pretty print JSON output')
  .action(async (query: string, options) => {
    try {
      // Handle batch mode
      if (options.batch) {
        const queries = readFileSync(options.batch, 'utf-8')
          .split('\n')
          .filter((line) => line.trim().length > 0);

        const results = [];
        for (const q of queries) {
          const searchQuery: SearchQuery = {
            query: q,
            limit: parseInt(options.limit, 10),
            rerank: options.rerank ?? false,
            rerank_top_k: options.rerank ? parseInt(options.rerankTopK, 10) : undefined,
          };
          const result = await search(searchQuery);
          results.push(result);
        }

        outputJSON(results, options.pretty);
        return;
      }

      // Single query search
      const searchQuery: SearchQuery = {
        query,
        limit: parseInt(options.limit, 10),
        cursor: options.cursor,
        rerank: options.rerank ?? false,
        rerank_top_k: options.rerank ? parseInt(options.rerankTopK, 10) : undefined,
      };

      const result = await search(searchQuery);
      outputJSON(result, options.pretty);
    } catch (error) {
      const errorResponse = {
        error: error instanceof Error ? error.message : String(error),
      };
      outputJSON(errorResponse, options.pretty);
      process.exit(1);
    }
  });

function outputJSON(data: unknown, pretty: boolean): void {
  if (pretty) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(JSON.stringify(data));
  }
}
