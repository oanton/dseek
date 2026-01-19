/**
 * Document indexer - orchestrates the indexing pipeline
 *
 * Handles document parsing, chunking, embedding generation, and storage.
 * Supports incremental updates via content hashing.
 *
 * @module indexer
 */

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { glob } from 'glob';
import { getFormat, isSupported, parseDocument } from '../parsers/index.js';
import { insertChunks, removeDocument as removeFromIndex, saveIndex } from '../storage/index.js';
import {
  loadMetadata,
  needsUpdate,
  recordEvent,
  removeDocument as removeFromMetadata,
  saveMetadata,
  setDocument,
} from '../storage/metadata.js';
import type { Chunk, Document, Source } from '../types/index.js';
import { chunkDocument } from './chunker.js';
import { findProjectRoot, loadConfig, loadIgnorePatterns } from './config.js';
import { LIMITS } from './constants.js';
import { embedBatch } from './embedder.js';

export interface IndexResult {
  indexed: number;
  skipped: number;
  errors: string[];
}

/**
 * Generate document ID from file path
 */
function generateDocId(filePath: string, projectRoot: string): string {
  return relative(projectRoot, resolve(filePath));
}

/**
 * Generate content hash
 */
function generateHash(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Check if path should be ignored
 */
function shouldIgnore(path: string, ignorePatterns: string[], excludePatterns: string[]): boolean {
  const allPatterns = [...ignorePatterns, ...excludePatterns];

  for (const pattern of allPatterns) {
    if (pattern.endsWith('/')) {
      // Directory pattern
      if (path.includes(pattern.slice(0, -1))) return true;
    } else if (path.includes(pattern) || path.match(new RegExp(pattern.replace(/\*/g, '.*')))) {
      return true;
    }
  }

  return false;
}

/**
 * Index a single file into the search index.
 *
 * Parses, chunks, generates embeddings, and stores the document.
 * Skips re-indexing if content hash unchanged.
 *
 * @param filePath - Absolute path to the file
 * @param projectRoot - Optional project root directory
 * @returns Result with success status and chunk count or error
 *
 * @example
 * ```ts
 * const result = await indexFile("/path/to/doc.md");
 * if (result.success) {
 *   console.log(`Indexed ${result.chunks} chunks`);
 * }
 * ```
 */
export async function indexFile(
  filePath: string,
  projectRoot?: string,
): Promise<{ success: boolean; chunks?: number; error?: string }> {
  const root = projectRoot ?? findProjectRoot();
  const docId = generateDocId(filePath, root);
  const config = await loadConfig(root);

  try {
    // Check if file exists
    if (!existsSync(filePath)) {
      return { success: false, error: `File not found: ${filePath}` };
    }

    // Check file size
    const fileStat = await stat(filePath);
    if (fileStat.size > LIMITS.MAX_FILE_SIZE_BYTES) {
      return { success: false, error: `File exceeds ${LIMITS.MAX_FILE_SIZE_BYTES / 1024 / 1024}MB limit` };
    }

    // Check format
    const format = getFormat(filePath);
    if (!format) {
      return { success: false, error: `Unsupported format: ${filePath}` };
    }

    // Read file
    const content = await readFile(filePath);
    const contentHash = generateHash(content);

    // Check if update needed
    if (!(await needsUpdate(docId, contentHash))) {
      return { success: true, chunks: 0 };
    }

    // Remove old chunks if re-indexing
    await removeFromIndex(docId);

    // Parse document
    const parsed = await parseDocument(content, filePath);

    // Chunk document
    const rawChunks = chunkDocument(parsed.content, {
      docId,
      format,
      config: config.chunking,
    });

    // Generate embeddings
    const texts = rawChunks.map((c) => c.text);
    const embeddings = await embedBatch(texts);

    // Combine chunks with embeddings
    const chunks: Chunk[] = rawChunks.map((chunk, i) => ({
      ...chunk,
      embedding: embeddings[i],
    }));

    // Store chunks
    await insertChunks(chunks);

    // Store document metadata
    const doc: Document = {
      doc_id: docId,
      source_name: 'default', // TODO: determine from source config
      format,
      content_hash: contentHash,
      updated_at: new Date().toISOString(),
      size_bytes: fileStat.size,
    };
    await setDocument(doc);

    // Record event
    await recordEvent({
      type: 'add',
      path: docId,
      at: new Date().toISOString(),
    });

    return { success: true, chunks: chunks.length };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Index all files in a source folder or a single file.
 *
 * Recursively finds and indexes all supported files matching source patterns.
 * If source path is a file, indexes that single file directly.
 *
 * @param source - Source configuration with path and include/exclude patterns
 * @param projectRoot - Optional project root directory
 * @returns Index result with counts of indexed, skipped, and errored files
 *
 * @example
 * ```ts
 * const result = await indexSource({
 *   name: "docs",
 *   path: "./docs",
 *   include: ["**\/*.md"],
 *   exclude: ["drafts/"]
 * });
 * console.log(`Indexed ${result.indexed} files`);
 * ```
 */
export async function indexSource(source: Source, projectRoot?: string): Promise<IndexResult> {
  const root = projectRoot ?? findProjectRoot();
  const sourcePath = resolve(root, source.path);
  const ignorePatterns = await loadIgnorePatterns(root);

  const result: IndexResult = {
    indexed: 0,
    skipped: 0,
    errors: [],
  };

  // Check if source is a single file or directory
  const sourceStat = await stat(sourcePath);
  let uniqueFiles: string[] = [];

  if (sourceStat.isFile()) {
    // Single file - check if supported
    if (isSupported(sourcePath)) {
      const relativePath = relative(root, sourcePath);
      if (!shouldIgnore(relativePath, ignorePatterns, source.exclude)) {
        uniqueFiles = [sourcePath];
      }
    }
  } else {
    // Directory - find all matching files
    const patterns = source.include.length > 0 ? source.include : ['**/*'];
    const files: string[] = [];

    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: sourcePath,
        nodir: true,
        absolute: true,
      });
      files.push(...matches);
    }

    // Dedupe and filter
    uniqueFiles = [...new Set(files)].filter((f) => {
      // Check if supported
      if (!isSupported(f)) return false;

      // Check ignore patterns
      const relativePath = relative(root, f);
      if (shouldIgnore(relativePath, ignorePatterns, source.exclude)) return false;

      return true;
    });
  }

  console.log(`Found ${uniqueFiles.length} files to index in ${source.name}`);

  // Index files in parallel batches
  const concurrency = LIMITS.INDEXING_CONCURRENCY;

  for (let i = 0; i < uniqueFiles.length; i += concurrency) {
    const batch = uniqueFiles.slice(i, i + concurrency);

    const batchResults = await Promise.all(batch.map((file) => indexFile(file, root)));

    // Process batch results
    for (let j = 0; j < batchResults.length; j++) {
      const { success, chunks, error } = batchResults[j];
      const file = batch[j];

      if (success) {
        if (chunks && chunks > 0) {
          result.indexed++;
          console.log(`  Indexed: ${relative(root, file)} (${chunks} chunks)`);
        } else {
          result.skipped++;
        }
      } else {
        result.errors.push(`${file}: ${error}`);
        console.error(`  Error: ${relative(root, file)} - ${error}`);
      }
    }
  }

  // Save index and metadata
  await saveIndex();
  await saveMetadata();

  return result;
}

/**
 * Remove a document or directory from the index.
 *
 * Deletes all chunks and metadata associated with the document.
 * If a directory path is provided, removes all documents with matching prefix.
 *
 * @param docIdOrPath - Document ID, directory path, or absolute file path
 * @param projectRoot - Optional project root directory
 * @returns True if any documents were found and removed
 *
 * @example
 * ```ts
 * // Remove single document
 * const removed = await deleteDocument("docs/old-file.md");
 * if (removed) console.log("Document removed from index");
 *
 * // Remove all documents in directory
 * const removed = await deleteDocument("./docs");
 * if (removed) console.log("Directory removed from index");
 * ```
 */
export async function deleteDocument(docIdOrPath: string, projectRoot?: string): Promise<boolean> {
  const root = projectRoot ?? findProjectRoot();

  // Normalize to doc ID
  const docId = docIdOrPath.startsWith('/') ? relative(root, docIdOrPath) : docIdOrPath;

  // Normalize: remove leading ./ if present
  const normalizedId = docId.replace(/^\.\//, '');

  // Get all document IDs from metadata
  const metadata = await loadMetadata();
  const allDocIds = Object.keys(metadata.documents);

  // Find matching documents (exact match OR prefix match for directories)
  const matchingDocs = allDocIds.filter(
    (id) => id === normalizedId || id.startsWith(normalizedId + '/'),
  );

  if (matchingDocs.length === 0) {
    return false;
  }

  let totalChunksRemoved = 0;
  let totalMetaRemoved = 0;

  for (const docToDelete of matchingDocs) {
    const chunksRemoved = await removeFromIndex(docToDelete);
    const metaRemoved = await removeFromMetadata(docToDelete);
    totalChunksRemoved += chunksRemoved;
    if (metaRemoved) totalMetaRemoved++;
  }

  if (totalChunksRemoved > 0 || totalMetaRemoved > 0) {
    // Record event
    await recordEvent({
      type: 'delete',
      path: normalizedId,
      at: new Date().toISOString(),
    });

    // Save changes
    await saveIndex();
    await saveMetadata();

    return true;
  }

  return false;
}

/**
 * Re-index a modified file.
 *
 * Convenience wrapper that indexes the file and saves changes.
 *
 * @param filePath - Absolute path to the file
 * @param projectRoot - Optional project root directory
 * @returns True if re-indexing succeeded
 */
export async function reindexFile(filePath: string, projectRoot?: string): Promise<boolean> {
  const { success } = await indexFile(filePath, projectRoot);

  if (success) {
    await saveIndex();
    await saveMetadata();
    return true;
  }

  return false;
}

// Export pure functions for testing
export { generateDocId, generateHash, shouldIgnore };
