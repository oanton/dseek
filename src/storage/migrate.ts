/**
 * Migration utility from Orama JSON to SQLite
 *
 * Automatically migrates existing Orama index and metadata to SQLite format.
 * Should be called on startup to ensure backward compatibility.
 *
 * @module migrate
 */

import { existsSync, readFileSync, renameSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getDseekDir } from '../core/config.js';
import { DIRS, FILES } from '../core/constants.js';
import type { Chunk, Document, IndexEvent } from '../types/index.js';
import { insertChunks } from './index.js';
import { recordEvent, setDocument } from './metadata.js';
import { getDb } from './sqlite.js';

/**
 * Get path to legacy Orama index file
 */
function getLegacyIndexPath(): string {
  return join(getDseekDir(), DIRS.INDEX, FILES.LEGACY_INDEX);
}

/**
 * Get path to legacy metadata file
 */
function getLegacyMetadataPath(): string {
  return join(getDseekDir(), DIRS.INDEX, FILES.LEGACY_METADATA);
}

/**
 * Check if legacy Orama index exists
 */
export function hasLegacyIndex(): boolean {
  return existsSync(getLegacyIndexPath());
}

/**
 * Check if migration is needed
 */
export function needsMigration(): boolean {
  const legacyIndexPath = getLegacyIndexPath();
  const legacyMetadataPath = getLegacyMetadataPath();

  // Migration needed if either legacy file exists
  return existsSync(legacyIndexPath) || existsSync(legacyMetadataPath);
}

/**
 * Parse Orama JSON format to extract chunks.
 *
 * Orama persists data in a specific format that we need to parse.
 *
 * @param data - Raw Orama JSON data
 * @returns Array of chunks extracted from Orama index
 */
function parseOramaData(data: string): Chunk[] {
  try {
    const parsed = JSON.parse(data);
    const chunks: Chunk[] = [];

    // Orama stores documents in a specific structure
    // The exact path depends on Orama version, but typically:
    // - parsed.data.docs or parsed.docs for document storage
    // - Each document has the schema fields

    // Try different Orama data structures
    let docs: Record<string, unknown> | null = null;

    if (parsed.data?.docs) {
      docs = parsed.data.docs;
    } else if (parsed.docs) {
      docs = parsed.docs;
    } else if (parsed.data?.index?.docs) {
      docs = parsed.data.index.docs;
    }

    if (!docs) {
      console.warn('Could not find documents in Orama data structure');
      return [];
    }

    // Extract documents
    for (const [_id, doc] of Object.entries(docs)) {
      const d = doc as Record<string, unknown>;
      if (d.chunk_id && d.doc_id && d.text) {
        chunks.push({
          chunk_id: String(d.chunk_id),
          doc_id: String(d.doc_id),
          text: String(d.text),
          snippet: String(d.snippet || ''),
          line_start: Number(d.line_start || 0),
          line_end: Number(d.line_end || 0),
          page_start: d.page_start ? Number(d.page_start) : undefined,
          page_end: d.page_end ? Number(d.page_end) : undefined,
          embedding: Array.isArray(d.embedding) ? (d.embedding as number[]) : undefined,
        });
      }
    }

    return chunks;
  } catch (error) {
    console.error('Failed to parse Orama data:', error);
    return [];
  }
}

/**
 * Parse legacy metadata JSON format.
 *
 * @param data - Raw metadata JSON data
 * @returns Parsed metadata with documents and events
 */
function parseLegacyMetadata(data: string): {
  documents: Document[];
  lastEvent: IndexEvent | null;
} {
  try {
    const parsed = JSON.parse(data);
    const documents: Document[] = [];
    let lastEvent: IndexEvent | null = null;

    // Extract documents
    if (parsed.documents) {
      for (const doc of Object.values(parsed.documents)) {
        const d = doc as Record<string, unknown>;
        if (d.doc_id) {
          documents.push({
            doc_id: String(d.doc_id),
            source_name: String(d.source_name || 'default'),
            format: (d.format as Document['format']) || 'md',
            content_hash: String(d.content_hash || ''),
            updated_at: String(d.updated_at || new Date().toISOString()),
            size_bytes: Number(d.size_bytes || 0),
          });
        }
      }
    }

    // Extract last event
    if (parsed.last_event) {
      const e = parsed.last_event;
      lastEvent = {
        type: e.type as IndexEvent['type'],
        path: String(e.path),
        at: String(e.at),
      };
    }

    return { documents, lastEvent };
  } catch (error) {
    console.error('Failed to parse legacy metadata:', error);
    return { documents: [], lastEvent: null };
  }
}

/**
 * Migrate from Orama JSON to SQLite.
 *
 * Reads existing orama.json and metadata.json, inserts data into SQLite,
 * and renames legacy files with .backup extension.
 *
 * @returns True if migration was performed, false if no migration needed
 *
 * @example
 * ```ts
 * const migrated = await migrateFromOrama();
 * if (migrated) {
 *   console.log('Migration complete');
 * }
 * ```
 */
export async function migrateFromOrama(): Promise<boolean> {
  const legacyIndexPath = getLegacyIndexPath();
  const legacyMetadataPath = getLegacyMetadataPath();

  // Check if migration is needed
  if (!existsSync(legacyIndexPath) && !existsSync(legacyMetadataPath)) {
    return false;
  }

  console.log('Migrating from Orama JSON to SQLite...');

  // Ensure SQLite database is initialized
  const db = getDb();

  let totalChunks = 0;
  let totalDocs = 0;

  // Migrate index data (chunks)
  if (existsSync(legacyIndexPath)) {
    try {
      const data = await readFile(legacyIndexPath, 'utf-8');
      const chunks = parseOramaData(data);

      if (chunks.length > 0) {
        // Insert in batches
        const batchSize = 100;
        for (let i = 0; i < chunks.length; i += batchSize) {
          const batch = chunks.slice(i, i + batchSize);
          await insertChunks(batch);
          totalChunks += batch.length;
        }

        console.log(`Migrated ${totalChunks} chunks from Orama index`);
      }

      // Backup legacy file
      renameSync(legacyIndexPath, legacyIndexPath + '.backup');
      console.log(`Backed up ${FILES.LEGACY_INDEX} to ${FILES.LEGACY_INDEX}.backup`);
    } catch (error) {
      console.error('Failed to migrate Orama index:', error);
    }
  }

  // Migrate metadata
  if (existsSync(legacyMetadataPath)) {
    try {
      const data = await readFile(legacyMetadataPath, 'utf-8');
      const { documents, lastEvent } = parseLegacyMetadata(data);

      // Insert documents
      for (const doc of documents) {
        await setDocument(doc);
        totalDocs++;
      }

      // Record last event
      if (lastEvent) {
        await recordEvent(lastEvent);
      }

      console.log(`Migrated ${totalDocs} document metadata entries`);

      // Backup legacy file
      renameSync(legacyMetadataPath, legacyMetadataPath + '.backup');
      console.log(`Backed up ${FILES.LEGACY_METADATA} to ${FILES.LEGACY_METADATA}.backup`);
    } catch (error) {
      console.error('Failed to migrate metadata:', error);
    }
  }

  console.log(`Migration complete: ${totalChunks} chunks, ${totalDocs} documents`);
  return true;
}

/**
 * Check and perform migration on startup.
 *
 * Should be called early in application startup.
 */
export async function checkAndMigrate(): Promise<void> {
  if (needsMigration()) {
    await migrateFromOrama();
  }
}
