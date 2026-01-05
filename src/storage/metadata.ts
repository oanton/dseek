/**
 * Document metadata storage
 *
 * Stores document metadata separately from the search index.
 * Tracks content hashes for incremental updates and index events.
 *
 * @module metadata
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getDseekDir } from '../core/config.js';
import { DIRS, FILES } from '../core/constants.js';
import type { Document, IndexEvent } from '../types/index.js';

interface MetadataStore {
  version: 1;
  documents: Record<string, Document>;
  last_event: IndexEvent | null;
  index_version: string;
  updated_at: string;
}

let store: MetadataStore | null = null;

/**
 * Get metadata file path
 */
function getMetadataPath(): string {
  return join(getDseekDir(), DIRS.INDEX, FILES.METADATA);
}

/**
 * Create empty store
 */
function createEmptyStore(): MetadataStore {
  return {
    version: 1,
    documents: {},
    last_event: null,
    index_version: generateIndexVersion(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Generate index version
 */
function generateIndexVersion(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
}

/**
 * Load metadata store from disk.
 *
 * Uses singleton pattern - creates empty store if file doesn't exist.
 *
 * @returns Metadata store with documents and events
 */
export async function loadMetadata(): Promise<MetadataStore> {
  if (store) return store;

  const metadataPath = getMetadataPath();

  if (existsSync(metadataPath)) {
    try {
      const data = await readFile(metadataPath, 'utf-8');
      store = JSON.parse(data) as MetadataStore;
      return store;
    } catch (error) {
      console.warn('Failed to load metadata, creating new store:', error);
    }
  }

  store = createEmptyStore();
  return store;
}

/**
 * Save metadata store to disk.
 *
 * Persists to `.dseek/index/metadata.json`.
 */
export async function saveMetadata(): Promise<void> {
  if (!store) return;

  const metadataPath = getMetadataPath();
  const indexDir = join(getDseekDir(), DIRS.INDEX);

  if (!existsSync(indexDir)) {
    await mkdir(indexDir, { recursive: true });
  }

  store.updated_at = new Date().toISOString();
  await writeFile(metadataPath, JSON.stringify(store, null, 2));
}

/**
 * Get document metadata by ID.
 *
 * @param docId - Document identifier (relative path)
 * @returns Document metadata or null if not found
 */
export async function getDocument(docId: string): Promise<Document | null> {
  const metadata = await loadMetadata();
  return metadata.documents[docId] ?? null;
}

/**
 * Set or update document metadata.
 *
 * @param doc - Document metadata to store
 */
export async function setDocument(doc: Document): Promise<void> {
  const metadata = await loadMetadata();
  metadata.documents[doc.doc_id] = doc;
  metadata.index_version = generateIndexVersion();
}

/**
 * Remove document metadata.
 *
 * @param docId - Document identifier to remove
 * @returns True if document was found and removed
 */
export async function removeDocument(docId: string): Promise<boolean> {
  const metadata = await loadMetadata();

  if (metadata.documents[docId]) {
    delete metadata.documents[docId];
    metadata.index_version = generateIndexVersion();
    return true;
  }

  return false;
}

/**
 * Get all indexed documents.
 *
 * @returns Array of all document metadata
 */
export async function getAllDocuments(): Promise<Document[]> {
  const metadata = await loadMetadata();
  return Object.values(metadata.documents);
}

/**
 * Get total document count.
 *
 * @returns Number of indexed documents
 */
export async function getDocumentCount(): Promise<number> {
  const metadata = await loadMetadata();
  return Object.keys(metadata.documents).length;
}

/**
 * Record an event
 */
export async function recordEvent(event: IndexEvent): Promise<void> {
  const metadata = await loadMetadata();
  metadata.last_event = event;
}

/**
 * Get last event
 */
export async function getLastEvent(): Promise<IndexEvent | null> {
  const metadata = await loadMetadata();
  return metadata.last_event;
}

/**
 * Get index version
 */
export async function getIndexVersion(): Promise<string> {
  const metadata = await loadMetadata();
  return metadata.index_version;
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
 * Reset metadata (for testing)
 */
export async function resetMetadata(): Promise<void> {
  store = createEmptyStore();
}
