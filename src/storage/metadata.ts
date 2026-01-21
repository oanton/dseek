/**
 * Document metadata storage
 *
 * Stores document metadata in SQLite database.
 * Tracks content hashes for incremental updates and index events.
 *
 * @module metadata
 */

import type { Document, IndexEvent } from '../types/index.js';
import { getDb } from './sqlite.js';

/**
 * Generate index version string.
 *
 * @returns Unique version identifier
 */
function generateIndexVersion(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
}

/**
 * Get document metadata by ID.
 *
 * @param docId - Document identifier (relative path)
 * @returns Document metadata or null if not found
 */
export async function getDocument(docId: string): Promise<Document | null> {
  const db = getDb();
  const result = db
    .prepare(
      `
    SELECT doc_id, source_name, format, content_hash, updated_at, size_bytes
    FROM documents WHERE doc_id = ?
  `,
    )
    .get(docId) as
    | {
        doc_id: string;
        source_name: string;
        format: string;
        content_hash: string;
        updated_at: string;
        size_bytes: number;
      }
    | undefined;

  if (!result) return null;

  return {
    doc_id: result.doc_id,
    source_name: result.source_name,
    format: result.format as Document['format'],
    content_hash: result.content_hash,
    updated_at: result.updated_at,
    size_bytes: result.size_bytes,
  };
}

/**
 * Set or update document metadata.
 *
 * @param doc - Document metadata to store
 */
export async function setDocument(doc: Document): Promise<void> {
  const db = getDb();

  db.prepare(
    `
    INSERT OR REPLACE INTO documents (doc_id, source_name, format, content_hash, updated_at, size_bytes)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
  ).run(doc.doc_id, doc.source_name, doc.format, doc.content_hash, doc.updated_at, doc.size_bytes);
}

/**
 * Remove document metadata.
 *
 * @param docId - Document identifier to remove
 * @returns True if document was found and removed
 */
export async function removeDocument(docId: string): Promise<boolean> {
  const db = getDb();
  const result = db.prepare('DELETE FROM documents WHERE doc_id = ?').run(docId);
  return result.changes > 0;
}

/**
 * Get all indexed documents.
 *
 * @returns Array of all document metadata
 */
export async function getAllDocuments(): Promise<Document[]> {
  const db = getDb();
  const results = db
    .prepare(
      `
    SELECT doc_id, source_name, format, content_hash, updated_at, size_bytes
    FROM documents
  `,
    )
    .all() as Array<{
    doc_id: string;
    source_name: string;
    format: string;
    content_hash: string;
    updated_at: string;
    size_bytes: number;
  }>;

  return results.map((r) => ({
    doc_id: r.doc_id,
    source_name: r.source_name,
    format: r.format as Document['format'],
    content_hash: r.content_hash,
    updated_at: r.updated_at,
    size_bytes: r.size_bytes,
  }));
}

/**
 * Get total document count.
 *
 * @returns Number of indexed documents
 */
export async function getDocumentCount(): Promise<number> {
  const db = getDb();
  const result = db.prepare('SELECT COUNT(*) as count FROM documents').get() as { count: number };
  return result.count;
}

/**
 * Record an index event.
 *
 * @param event - Event to record
 */
export async function recordEvent(event: IndexEvent): Promise<void> {
  const db = getDb();
  db.prepare(
    `
    INSERT INTO index_events (type, path, at) VALUES (?, ?, ?)
  `,
  ).run(event.type, event.path, event.at);
}

/**
 * Get last recorded event.
 *
 * @returns Most recent index event or null
 */
export async function getLastEvent(): Promise<IndexEvent | null> {
  const db = getDb();
  const result = db
    .prepare(
      `
    SELECT type, path, at FROM index_events
    ORDER BY id DESC LIMIT 1
  `,
    )
    .get() as { type: string; path: string; at: string } | undefined;

  if (!result) return null;

  return {
    type: result.type as IndexEvent['type'],
    path: result.path,
    at: result.at,
  };
}

/**
 * Get index version.
 *
 * @returns Current index version string
 */
export async function getIndexVersion(): Promise<string> {
  const db = getDb();
  const result = db.prepare("SELECT value FROM meta WHERE key = 'index_version'").get() as
    | { value: string }
    | undefined;

  if (!result) {
    // Initialize index version
    const version = generateIndexVersion();
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('index_version', ?)").run(version);
    return version;
  }

  return result.value;
}

/**
 * Update index version (called after modifications).
 */
async function updateIndexVersion(): Promise<void> {
  const db = getDb();
  const version = generateIndexVersion();
  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('index_version', ?)").run(version);
}

/**
 * Check if document needs re-indexing.
 *
 * Compares content hash to detect changes.
 *
 * @param docId - Document identifier
 * @param contentHash - Current content hash
 * @returns True if document is new or content changed
 */
export async function needsUpdate(docId: string, contentHash: string): Promise<boolean> {
  const doc = await getDocument(docId);
  if (!doc) return true;
  return doc.content_hash !== contentHash;
}

/**
 * Reset metadata (for testing).
 *
 * Clears all documents and events from database.
 */
export async function resetMetadata(): Promise<void> {
  const db = getDb();
  db.exec(`
    DELETE FROM documents;
    DELETE FROM index_events;
    DELETE FROM meta WHERE key = 'index_version';
  `);
}

/**
 * Load metadata store (for compatibility).
 *
 * With SQLite, this is a no-op since data is stored in DB.
 *
 * @returns Empty metadata store object
 */
export async function loadMetadata(): Promise<{
  version: 1;
  documents: Record<string, Document>;
  last_event: IndexEvent | null;
  index_version: string;
  updated_at: string;
}> {
  const docs = await getAllDocuments();
  const lastEvent = await getLastEvent();
  const indexVersion = await getIndexVersion();

  return {
    version: 1,
    documents: Object.fromEntries(docs.map((d) => [d.doc_id, d])),
    last_event: lastEvent,
    index_version: indexVersion,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Save metadata store (for compatibility).
 *
 * With SQLite, this is a no-op since data is persisted automatically.
 */
export async function saveMetadata(): Promise<void> {
  // No-op - SQLite auto-persists
  // Just update the index version to signal changes
  await updateIndexVersion();
}
