import Database from 'better-sqlite3'
import type { Database as DatabaseType } from 'better-sqlite3'
import { createHash } from 'node:crypto'
import type { HarnessEvent } from './contracts.ts'

interface DomainObjectRow {
  runId: string
  type: string
  objectId: string
  payload: string
}

interface EventRow {
  sequence: number
  runId: string
  candidate: string
  pursuitId: string | null
  taskId: string
  type: string
  occurredAt: string
  payload: string
}

interface ReceiptRow {
  idempotencyKey: string
  requestHash: string
  receiptId: string
  performedAt: string
}

interface CacheRow {
  key: string
  sourceId: string
  version: number
  contentHash: string
  permissionVariant: string
  schemaVersion: number
  value: string
  createdAt: string
}

export class DomainStore {
  private db: DatabaseType

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS domain_objects (
        runId TEXT NOT NULL,
        type TEXT NOT NULL,
        objectId TEXT NOT NULL,
        payload TEXT NOT NULL,
        PRIMARY KEY (runId, objectId)
      );
      CREATE TABLE IF NOT EXISTS harness_events (
        sequence INTEGER NOT NULL,
        runId TEXT NOT NULL,
        candidate TEXT NOT NULL,
        pursuitId TEXT,
        taskId TEXT NOT NULL,
        type TEXT NOT NULL,
        occurredAt TEXT NOT NULL,
        payload TEXT NOT NULL,
        PRIMARY KEY (runId, sequence)
      );
      CREATE TABLE IF NOT EXISTS effect_receipts (
        idempotencyKey TEXT PRIMARY KEY,
        requestHash TEXT NOT NULL,
        receiptId TEXT NOT NULL,
        performedAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS cache_entries (
        key TEXT PRIMARY KEY,
        sourceId TEXT NOT NULL,
        version INTEGER NOT NULL,
        contentHash TEXT NOT NULL,
        permissionVariant TEXT NOT NULL,
        schemaVersion INTEGER NOT NULL,
        value TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
    `)
  }

  saveDomainObject(runId: string, type: string, objectId: string, payload: unknown): void {
    const stmt = this.db.prepare(
      'INSERT OR REPLACE INTO domain_objects (runId, type, objectId, payload) VALUES (?, ?, ?, ?)'
    )
    stmt.run(runId, type, objectId, JSON.stringify(payload))
  }

  getDomainObject(runId: string, objectId: string): { type: string; payload: unknown } | undefined {
    const stmt = this.db.prepare('SELECT * FROM domain_objects WHERE runId = ? AND objectId = ?')
    const row = stmt.get(runId, objectId) as DomainObjectRow | undefined
    if (!row) return undefined
    return { type: row.type, payload: JSON.parse(row.payload) }
  }

  saveEvent(event: HarnessEvent): void {
    const stmt = this.db.prepare(
      'INSERT INTO harness_events (sequence, runId, candidate, pursuitId, taskId, type, occurredAt, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    stmt.run(
      event.sequence,
      event.runId,
      event.candidate,
      event.pursuitId,
      event.taskId,
      event.type,
      event.occurredAt,
      JSON.stringify(event.payload)
    )
  }

  getEvents(runId: string): HarnessEvent[] {
    const stmt = this.db.prepare('SELECT * FROM harness_events WHERE runId = ? ORDER BY sequence ASC')
    const rows = stmt.all(runId) as EventRow[]
    return rows.map((r) => ({
      sequence: r.sequence,
      runId: r.runId,
      candidate: r.candidate as 'langgraph' | 'mastra',
      pursuitId: r.pursuitId,
      taskId: r.taskId,
      type: r.type as HarnessEvent['type'],
      occurredAt: r.occurredAt,
      payload: JSON.parse(r.payload) as Record<string, unknown>,
    }))
  }

  saveReceipt(idempotencyKey: string, requestHash: string, receiptId: string, performedAt: string): void {
    const stmt = this.db.prepare(
      'INSERT OR IGNORE INTO effect_receipts (idempotencyKey, requestHash, receiptId, performedAt) VALUES (?, ?, ?, ?)'
    )
    stmt.run(idempotencyKey, requestHash, receiptId, performedAt)
  }

  getReceipt(idempotencyKey: string): { requestHash: string; receiptId: string } | undefined {
    const stmt = this.db.prepare('SELECT * FROM effect_receipts WHERE idempotencyKey = ?')
    const row = stmt.get(idempotencyKey) as ReceiptRow | undefined
    if (!row) return undefined
    return { requestHash: row.requestHash, receiptId: row.receiptId }
  }

  saveCacheEntry(key: string, sourceId: string, version: number, contentHash: string, permissionVariant: string, schemaVersion: number, value: unknown, createdAt: string): void {
    const stmt = this.db.prepare(
      'INSERT OR REPLACE INTO cache_entries (key, sourceId, version, contentHash, permissionVariant, schemaVersion, value, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    stmt.run(key, sourceId, version, contentHash, permissionVariant, schemaVersion, JSON.stringify(value), createdAt)
  }

  getCacheEntry(key: string): unknown | undefined {
    const stmt = this.db.prepare('SELECT * FROM cache_entries WHERE key = ?')
    const row = stmt.get(key) as CacheRow | undefined
    if (!row) return undefined
    return JSON.parse(row.value)
  }

  deleteCacheEntry(key: string): void {
    const stmt = this.db.prepare('DELETE FROM cache_entries WHERE key = ?')
    stmt.run(key)
  }

  transaction<T>(fn: () => T): ReturnType<DatabaseType['transaction']> {
    return this.db.transaction(fn)
  }

  snapshotHash(): string {
    const allObjects = this.db.prepare('SELECT * FROM domain_objects ORDER BY objectId ASC').all() as DomainObjectRow[]
    const allEvents = this.db.prepare('SELECT * FROM harness_events ORDER BY sequence ASC').all() as EventRow[]
    const allReceipts = this.db.prepare('SELECT * FROM effect_receipts ORDER BY idempotencyKey ASC').all() as ReceiptRow[]
    const combined = JSON.stringify({ objects: allObjects, events: allEvents, receipts: allReceipts })
    return createHash('sha256').update(combined).digest('hex').slice(0, 16)
  }

  close(): void {
    this.db.close()
  }
}
