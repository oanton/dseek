/**
 * Metadata storage unit tests
 *
 * Tests document metadata CRUD operations without touching Orama.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  getAllDocuments,
  getDocument,
  getDocumentCount,
  getLastEvent,
  needsUpdate,
  recordEvent,
  removeDocument,
  resetMetadata,
  setDocument,
} from '../../src/storage/metadata.js';
import type { Document, IndexEvent } from '../../src/types/index.js';

/**
 * Create a test document with defaults
 */
function createDocument(overrides: Partial<Document> & { doc_id: string }): Document {
  return {
    source_name: 'default',
    format: 'md',
    content_hash: 'abc123',
    updated_at: new Date().toISOString(),
    size_bytes: 100,
    ...overrides,
  };
}

describe('Metadata', () => {
  beforeEach(async () => {
    await resetMetadata();
  });

  it('sets and retrieves a document', async () => {
    const doc = createDocument({
      doc_id: 'test.md',
      content_hash: 'hash123',
      size_bytes: 500,
    });

    await setDocument(doc);
    const retrieved = await getDocument('test.md');

    expect(retrieved).toEqual(doc);
  });

  it('removes a document and returns true', async () => {
    await setDocument(createDocument({ doc_id: 'remove.md' }));

    const removed = await removeDocument('remove.md');

    expect(removed).toBe(true);
    expect(await getDocument('remove.md')).toBeNull();
  });

  it('removeDocument returns false for non-existent doc', async () => {
    const removed = await removeDocument('nonexistent.md');
    expect(removed).toBe(false);
  });

  it('needsUpdate returns true for missing document', async () => {
    expect(await needsUpdate('missing.md', 'any-hash')).toBe(true);
  });

  it('needsUpdate returns true for changed hash', async () => {
    await setDocument(createDocument({ doc_id: 'a.md', content_hash: 'old-hash' }));

    expect(await needsUpdate('a.md', 'new-hash')).toBe(true);
  });

  it('needsUpdate returns false for same hash', async () => {
    await setDocument(createDocument({ doc_id: 'a.md', content_hash: 'same-hash' }));

    expect(await needsUpdate('a.md', 'same-hash')).toBe(false);
  });

  it('records and retrieves events', async () => {
    const event: IndexEvent = {
      type: 'add',
      path: 'new-file.md',
      at: new Date().toISOString(),
    };

    await recordEvent(event);
    const retrieved = await getLastEvent();

    expect(retrieved).toEqual(event);
  });

  it('getAllDocuments returns all stored documents', async () => {
    await setDocument(createDocument({ doc_id: 'a.md' }));
    await setDocument(createDocument({ doc_id: 'b.md' }));
    await setDocument(createDocument({ doc_id: 'c.md' }));

    const docs = await getAllDocuments();

    expect(docs).toHaveLength(3);
    expect(docs.map((d) => d.doc_id).sort()).toEqual(['a.md', 'b.md', 'c.md']);
  });

  it('getDocumentCount returns correct count', async () => {
    expect(await getDocumentCount()).toBe(0);

    await setDocument(createDocument({ doc_id: 'a.md' }));
    await setDocument(createDocument({ doc_id: 'b.md' }));

    expect(await getDocumentCount()).toBe(2);
  });
});
