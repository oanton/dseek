/**
 * SQLite connection management
 *
 * Manages SQLite database connection with sqlite-vec extension for vector search.
 * Uses WAL mode for optimal performance with concurrent reads.
 *
 * @module sqlite
 */

import { existsSync, mkdirSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { getDseekDir } from '../core/config.js';
import { DIRS, EMBEDDING_CONFIG, FILES, SQLITE } from '../core/constants.js';

let db: Database.Database | null = null;

/**
 * SQL schema for chunks, FTS5, and vector tables
 */
const SCHEMA_SQL = `
-- Main chunks table
CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chunk_id TEXT UNIQUE NOT NULL,
  doc_id TEXT NOT NULL,
  text TEXT NOT NULL,
  snippet TEXT NOT NULL,
  line_start INTEGER NOT NULL,
  line_end INTEGER NOT NULL,
  page_start INTEGER,
  page_end INTEGER
);

-- FTS5 for BM25 keyword search (multilingual)
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  text,
  content='chunks',
  content_rowid='id',
  tokenize='unicode61'
);

-- Auto-sync triggers for FTS5
CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts(rowid, text) VALUES (new.id, new.text);
END;

CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, text) VALUES('delete', old.id, old.text);
END;

CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, text) VALUES('delete', old.id, old.text);
  INSERT INTO chunks_fts(rowid, text) VALUES (new.id, new.text);
END;

-- Documents metadata table (replaces metadata.json)
CREATE TABLE IF NOT EXISTS documents (
  doc_id TEXT PRIMARY KEY,
  source_name TEXT NOT NULL,
  format TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  size_bytes INTEGER NOT NULL
);

-- Events log
CREATE TABLE IF NOT EXISTS index_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  path TEXT NOT NULL,
  at TEXT NOT NULL
);

-- Schema version metadata
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chunks_doc_id ON chunks(doc_id);
CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(content_hash);
`;

/**
 * Get index directory path
 */
export function getIndexDir(): string {
  return join(getDseekDir(), DIRS.INDEX);
}

/**
 * Get database file path
 */
export function getDbPath(): string {
  return join(getIndexDir(), FILES.INDEX);
}

/**
 * Initialize the vector table with correct dimensions.
 * Called separately because vec0 virtual table creation has different syntax.
 */
function initVectorTable(database: Database.Database): void {
  const dims = EMBEDDING_CONFIG.DIMENSIONS;

  // Check if vector table exists
  const tableExists = database
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='chunks_vec'")
    .get();

  if (!tableExists) {
    database.exec(`
      CREATE VIRTUAL TABLE chunks_vec USING vec0(
        chunk_rowid INTEGER PRIMARY KEY,
        embedding float[${dims}]
      );
    `);
  }
}

/**
 * Initialize schema version tracking
 */
function initSchemaVersion(database: Database.Database): void {
  const existing = database.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
    | { value: string }
    | undefined;

  if (!existing) {
    database
      .prepare("INSERT INTO meta (key, value) VALUES ('schema_version', ?)")
      .run(String(SQLITE.SCHEMA_VERSION));
  }
}

/**
 * Get or create the SQLite database connection.
 *
 * Uses singleton pattern - connection is created once and reused.
 * Configures WAL mode and loads sqlite-vec extension.
 *
 * @returns Initialized SQLite database instance
 *
 * @example
 * ```ts
 * const db = getDb();
 * const results = db.prepare('SELECT * FROM chunks').all();
 * ```
 */
export function getDb(): Database.Database {
  if (db) return db;

  const indexDir = getIndexDir();
  const dbPath = getDbPath();

  // Ensure directory exists (sync for constructor)
  if (!existsSync(indexDir)) {
    mkdirSync(indexDir, { recursive: true });
  }

  db = new Database(dbPath);

  // Load sqlite-vec extension
  sqliteVec.load(db);

  // Configure for performance
  db.pragma('journal_mode = WAL');
  db.pragma(`busy_timeout = ${SQLITE.BUSY_TIMEOUT_MS}`);
  db.pragma(`cache_size = -${SQLITE.CACHE_SIZE_KB}`); // Negative = KB
  db.pragma('synchronous = NORMAL');

  // Initialize schema
  db.exec(SCHEMA_SQL);
  initVectorTable(db);
  initSchemaVersion(db);

  return db;
}

/**
 * Close the database connection.
 *
 * Should be called when shutting down gracefully.
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Reset database connection (for testing).
 *
 * Closes existing connection and clears singleton.
 */
export function resetDb(): void {
  closeDb();
}

/**
 * Run VACUUM to optimize database size.
 *
 * Should be called periodically after large deletions.
 */
export function vacuumDb(): void {
  const database = getDb();
  database.exec('VACUUM');
}

/**
 * Get schema version from database.
 *
 * @returns Current schema version number
 */
export function getSchemaVersion(): number {
  const database = getDb();
  const result = database.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
    | { value: string }
    | undefined;

  return result ? Number.parseInt(result.value, 10) : 0;
}
