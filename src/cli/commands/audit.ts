/**
 * Audit command - find duplicates and conflicts
 *
 * Analyzes index for near-duplicate content and conflicting information.
 *
 * @module cli/commands/audit
 */

import { search as oramaSearch } from '@orama/orama';
import { Command } from 'commander';
import { DEFAULTS, LIMITS, SEARCH } from '../../core/constants.js';
import { getDb } from '../../storage/index.js';

interface DuplicateGroup {
  chunks: Array<{
    chunk_id: string;
    path: string;
    line_start: number;
    line_end: number;
    snippet: string;
  }>;
  similarity: number;
}

export const auditCommand = new Command('audit')
  .description('Audit the index for issues')
  .argument('<type>', 'Audit type: duplicates | conflicts')
  .option('-t, --threshold <number>', 'Similarity threshold (0-1)', String(DEFAULTS.SIMILARITY_THRESHOLD))
  .option('-l, --limit <number>', 'Maximum results', String(DEFAULTS.AUDIT_LIMIT))
  .option('--json', 'Output as JSON')
  .action(async (type: string, options) => {
    try {
      switch (type) {
        case 'duplicates':
          await auditDuplicates(options);
          break;
        case 'conflicts':
          await auditConflicts(options);
          break;
        default:
          console.error(`Unknown audit type: ${type}`);
          console.error('Available types: duplicates, conflicts');
          process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

async function auditDuplicates(options: { threshold: string; limit: string; json?: boolean }): Promise<void> {
  const threshold = parseFloat(options.threshold);
  const limit = parseInt(options.limit, 10);

  console.log(`Searching for near-duplicate content (threshold: ${threshold})...\n`);

  const db = await getDb();

  // Get all chunks
  const allResults = await oramaSearch(db, {
    term: '',
    limit: LIMITS.MAX_DOCS_STATS_SCAN,
  });

  if (allResults.hits.length === 0) {
    console.log('No chunks in index.');
    return;
  }

  const chunks = allResults.hits.map((hit) => ({
    chunk_id: (hit.document as { chunk_id: string }).chunk_id,
    doc_id: (hit.document as { doc_id: string }).doc_id,
    text: (hit.document as { text: string }).text,
    snippet: (hit.document as { snippet: string }).snippet,
    line_start: (hit.document as { line_start: number }).line_start,
    line_end: (hit.document as { line_end: number }).line_end,
    embedding: (hit.document as { embedding: number[] }).embedding,
  }));

  // Find duplicates using pairwise similarity
  const duplicates: DuplicateGroup[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < chunks.length && duplicates.length < limit; i++) {
    if (seen.has(chunks[i].chunk_id)) continue;

    const group: DuplicateGroup = {
      chunks: [
        {
          chunk_id: chunks[i].chunk_id,
          path: chunks[i].doc_id,
          line_start: chunks[i].line_start,
          line_end: chunks[i].line_end,
          snippet: chunks[i].snippet,
        },
      ],
      similarity: 1,
    };

    // Compare with other chunks
    for (let j = i + 1; j < chunks.length; j++) {
      if (seen.has(chunks[j].chunk_id)) continue;

      const similarity = cosineSimilarity(chunks[i].embedding, chunks[j].embedding);

      if (similarity >= threshold) {
        group.chunks.push({
          chunk_id: chunks[j].chunk_id,
          path: chunks[j].doc_id,
          line_start: chunks[j].line_start,
          line_end: chunks[j].line_end,
          snippet: chunks[j].snippet,
        });
        group.similarity = Math.min(group.similarity, similarity);
        seen.add(chunks[j].chunk_id);
      }
    }

    if (group.chunks.length > 1) {
      duplicates.push(group);
      seen.add(chunks[i].chunk_id);
    }
  }

  if (options.json) {
    console.log(JSON.stringify(duplicates, null, 2));
    return;
  }

  if (duplicates.length === 0) {
    console.log('No near-duplicates found.');
    return;
  }

  console.log(`Found ${duplicates.length} duplicate groups:\n`);

  for (let i = 0; i < duplicates.length; i++) {
    const group = duplicates[i];
    console.log(`Group ${i + 1} (similarity: ${(group.similarity * 100).toFixed(1)}%):`);
    for (const chunk of group.chunks) {
      console.log(`  - ${chunk.path}:${chunk.line_start}-${chunk.line_end}`);
      console.log(`    "${chunk.snippet.substring(0, DEFAULTS.SNIPPET_PREVIEW_LENGTH)}..."`);
    }
    console.log();
  }
}

async function auditConflicts(options: { threshold: string; limit: string; json?: boolean }): Promise<void> {
  console.log('Searching for potentially conflicting information...\n');

  // Conflict detection heuristics:
  // 1. Similar topics (high semantic similarity)
  // 2. Different values/statements (lexical differences)

  const db = await getDb();

  // Get all chunks
  const allResults = await oramaSearch(db, {
    term: '',
    limit: LIMITS.MAX_DOCS_STATS_SCAN,
  });

  if (allResults.hits.length === 0) {
    console.log('No chunks in index.');
    return;
  }

  const chunks = allResults.hits.map((hit) => ({
    chunk_id: (hit.document as { chunk_id: string }).chunk_id,
    doc_id: (hit.document as { doc_id: string }).doc_id,
    text: (hit.document as { text: string }).text,
    snippet: (hit.document as { snippet: string }).snippet,
    line_start: (hit.document as { line_start: number }).line_start,
    line_end: (hit.document as { line_end: number }).line_end,
    embedding: (hit.document as { embedding: number[] }).embedding,
  }));

  // Look for conflict patterns
  const conflicts: Array<{
    chunk1: { path: string; line_start: number; snippet: string };
    chunk2: { path: string; line_start: number; snippet: string };
    reason: string;
    similarity: number;
  }> = [];

  const limit = parseInt(options.limit, 10);
  const threshold = parseFloat(options.threshold);

  // Find chunks that are semantically similar but from different documents
  for (let i = 0; i < chunks.length && conflicts.length < limit; i++) {
    for (let j = i + 1; j < chunks.length && conflicts.length < limit; j++) {
      // Skip chunks from same document
      if (chunks[i].doc_id === chunks[j].doc_id) continue;

      const similarity = cosineSimilarity(chunks[i].embedding, chunks[j].embedding);

      // Look for high similarity (same topic) but different content
      if (similarity >= threshold * SEARCH.CONFLICT_THRESHOLD_MODIFIER && similarity < 1.0) {
        // Check for potential conflict patterns (numbers, dates, versions)
        const hasConflict = detectPotentialConflict(chunks[i].text, chunks[j].text);

        if (hasConflict.isConflict) {
          conflicts.push({
            chunk1: {
              path: chunks[i].doc_id,
              line_start: chunks[i].line_start,
              snippet: chunks[i].snippet,
            },
            chunk2: {
              path: chunks[j].doc_id,
              line_start: chunks[j].line_start,
              snippet: chunks[j].snippet,
            },
            reason: hasConflict.reason,
            similarity,
          });
        }
      }
    }
  }

  if (options.json) {
    console.log(JSON.stringify(conflicts, null, 2));
    return;
  }

  if (conflicts.length === 0) {
    console.log('No potential conflicts found.');
    return;
  }

  console.log(`Found ${conflicts.length} potential conflicts:\n`);

  for (let i = 0; i < conflicts.length; i++) {
    const conflict = conflicts[i];
    console.log(`Conflict ${i + 1}: ${conflict.reason}`);
    console.log(`  File 1: ${conflict.chunk1.path}:${conflict.chunk1.line_start}`);
    console.log(`    "${conflict.chunk1.snippet.substring(0, DEFAULTS.SNIPPET_PREVIEW_LENGTH)}..."`);
    console.log(`  File 2: ${conflict.chunk2.path}:${conflict.chunk2.line_start}`);
    console.log(`    "${conflict.chunk2.snippet.substring(0, DEFAULTS.SNIPPET_PREVIEW_LENGTH)}..."`);
    console.log();
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function detectPotentialConflict(text1: string, text2: string): { isConflict: boolean; reason: string } {
  // Pattern 1: Different numbers for same metric
  const numberPattern = /(\d+(?:\.\d+)?)\s*(MB|GB|KB|ms|seconds?|minutes?|hours?|days?|%)/gi;
  const nums1 = [...text1.matchAll(numberPattern)];
  const nums2 = [...text2.matchAll(numberPattern)];

  for (const n1 of nums1) {
    for (const n2 of nums2) {
      if (n1[2].toLowerCase() === n2[2].toLowerCase() && n1[1] !== n2[1]) {
        return { isConflict: true, reason: `Different values: ${n1[0]} vs ${n2[0]}` };
      }
    }
  }

  // Pattern 2: Different version numbers
  const versionPattern = /v?(\d+\.\d+(?:\.\d+)?)/gi;
  const vers1 = [...text1.matchAll(versionPattern)];
  const vers2 = [...text2.matchAll(versionPattern)];

  if (vers1.length > 0 && vers2.length > 0) {
    const v1 = vers1[0][1];
    const v2 = vers2[0][1];
    if (v1 !== v2) {
      return { isConflict: true, reason: `Different versions: ${v1} vs ${v2}` };
    }
  }

  return { isConflict: false, reason: '' };
}

// Export for testing
export { detectPotentialConflict };
