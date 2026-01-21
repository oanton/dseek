/**
 * Search command - hybrid search with text/JSON output
 *
 * Performs semantic + keyword search with optional reranking.
 * Default output is LLM-friendly text format; use --json for machine parsing.
 *
 * @module cli/commands/search
 */

import { readFileSync } from 'node:fs';
import { Command } from 'commander';
import { LIMITS, TEXT_FORMAT } from '../../core/constants.js';
import { search } from '../../core/retrieval.js';
import type { SearchQuery, SearchResponse } from '../../types/index.js';

export const searchCommand = new Command('search')
  .description('Search indexed documents')
  .argument('<query>', 'Search query')
  .option('-l, --limit <number>', 'Maximum results', String(LIMITS.DEFAULT_RESULTS))
  .option('-c, --cursor <cursor>', 'Pagination cursor')
  .option('--batch <file>', 'Batch search from file (one query per line)')
  .option('--rerank', 'Enable cross-encoder reranking (slower, more accurate)')
  .option('--rerank-top-k <number>', 'Number of candidates to rerank', String(LIMITS.DEFAULT_RERANK_TOP_K))
  .option('--json', 'Output as JSON (default: text)')
  .option('--llm', 'Output as text for LLM (default)')
  .option('--pretty', 'Pretty print JSON output (only with --json)')
  .action(async (query: string, options) => {
    try {
      const useJson = options.json && !options.llm;

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

        if (useJson) {
          outputJSON(results, options.pretty);
        } else {
          // Text format for batch: separate each response
          const textOutputs = results.map((r) => formatTextOutput(r));
          console.log(textOutputs.join('\n\n'));
        }
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

      if (useJson) {
        outputJSON(result, options.pretty);
      } else {
        console.log(formatTextOutput(result));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (options.json && !options.llm) {
        outputJSON({ error: errorMessage }, options.pretty);
      } else {
        console.log(`# Error: ${errorMessage}`);
      }
      process.exit(1);
    }
  });

/**
 * Format search response as LLM-friendly text.
 *
 * @param response - Search response to format
 * @returns Formatted text output
 *
 * @example
 * ```
 * # Query: "authentication flow"
 * # Confidence: 0.85 | Results: 3 | Index: ready
 *
 * ---
 * [docs/auth.md:45-67] score:0.92
 *
 * The authentication flow begins with...
 * ```
 */
function formatTextOutput(response: SearchResponse): string {
  const lines: string[] = [];
  const precision = TEXT_FORMAT.SCORE_PRECISION;

  lines.push(`# Query: "${response.query}"`);
  lines.push(
    `# Confidence: ${response.confidence.toFixed(precision)} | Results: ${response.results.length} | Index: ${response.index_state}`
  );
  lines.push('');

  for (const result of response.results) {
    lines.push(TEXT_FORMAT.RESULT_SEPARATOR);
    lines.push(`[${result.path}:${result.line_start}-${result.line_end}] score:${result.score.toFixed(precision)}`);
    lines.push('');
    lines.push(result.snippet);
    lines.push('');
  }

  if (response.next_cursor) {
    lines.push(`# Next: --cursor "${response.next_cursor}"`);
  }

  return lines.join('\n');
}

/**
 * Output data as JSON.
 *
 * @param data - Data to output
 * @param pretty - Whether to pretty print
 */
function outputJSON(data: unknown, pretty: boolean): void {
  if (pretty) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(JSON.stringify(data));
  }
}
