import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DomainStore } from '../src/domain-store.ts'
import { SideEffectLedgerStub } from '../src/effect-ledger.ts'
import { BridgeSimulator } from '../src/bridge-simulator.ts'
import { ContextCache } from '../src/context-cache.ts'
import { createHarnessFixture } from '../src/fixture.ts'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtempSync, rmSync } from 'node:fs'

let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'beg-spike-'))
})

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

describe('DomainStore (SQLite fixture repository)', () => {
  it('persists and reads the same run after close and reopen', () => {
    const dbPath = join(tempDir, 'test.db')
    const store1 = new DomainStore(dbPath)
    store1.saveDomainObject('run-1', 'JobPursuit', 'pursuit-direct', { title: 'Backend Engineer' })
    store1.saveEvent({ sequence: 1, runId: 'run-1', candidate: 'mastra', pursuitId: 'pursuit-direct', taskId: 'company-research', type: 'node.started', occurredAt: '2026-01-01T00:00:00Z', payload: {} })
    const hash1 = store1.snapshotHash()
    store1.close()

    const store2 = new DomainStore(dbPath)
    const obj = store2.getDomainObject('run-1', 'pursuit-direct')
    const events = store2.getEvents('run-1')
    const hash2 = store2.snapshotHash()

    expect(obj).toBeDefined()
    expect(obj!.type).toBe('JobPursuit')
    expect(events).toHaveLength(1)
    expect(events[0]!.type).toBe('node.started')
    expect(hash2).toBe(hash1)
    store2.close()
  })

  it('does not allow framework checkpoints into domain tables', () => {
    const store = new DomainStore(join(tempDir, 'test2.db'))
    // DomainStore only exposes domain object / event / receipt / cache tables.
    // Framework checkpoint saving is not a DomainStore method.
    expect(typeof store.saveDomainObject).toBe('function')
    expect(typeof store.saveEvent).toBe('function')
    expect(typeof (store as unknown as Record<string, unknown>).saveCheckpoint).toBe('undefined')
    store.close()
  })
})

describe('SideEffectLedgerStub (idempotent effects)', () => {
  it('returns performed=true on first call and performed=false on second with same key', () => {
    const store = new DomainStore(join(tempDir, 'ledger.db'))
    const ledger = new SideEffectLedgerStub(store)

    const r1 = ledger.execute('application:pursuit-direct:v1', 'hash-abc')
    const r2 = ledger.execute('application:pursuit-direct:v1', 'hash-abc')

    expect(r1.performed).toBe(true)
    expect(r1.receipt).toBeDefined()
    expect(r2.performed).toBe(false)
    expect(r2.receipt).toBe(r1.receipt)
    store.close()
  })

  it('fails closed on request hash mismatch with same key', () => {
    const store = new DomainStore(join(tempDir, 'ledger2.db'))
    const ledger = new SideEffectLedgerStub(store)

    const r1 = ledger.execute('key-1', 'hash-aaa')
    const r2 = ledger.execute('key-1', 'hash-bbb') // different request hash

    expect(r1.performed).toBe(true)
    expect(r2.performed).toBe(false)
    expect(r2.error).toBe('request_hash_conflict')
    store.close()
  })

  it('survives close and reopen with same receipts', () => {
    const dbPath = join(tempDir, 'ledger3.db')
    const store1 = new DomainStore(dbPath)
    const ledger1 = new SideEffectLedgerStub(store1)
    const r1 = ledger1.execute('persist-key', 'hash-xyz')
    store1.close()

    const store2 = new DomainStore(dbPath)
    const ledger2 = new SideEffectLedgerStub(store2)
    const r2 = ledger2.execute('persist-key', 'hash-xyz')

    expect(r2.performed).toBe(false)
    expect(r2.receipt).toBe(r1.receipt)
    store2.close()
  })
})

describe('BridgeSimulator', () => {
  it('returns unknown and does not send when disconnected', () => {
    const bridge = new BridgeSimulator()
    expect(bridge.isOnline()).toBe(true)

    bridge.disconnect()
    expect(bridge.isOnline()).toBe(false)

    const result = bridge.attemptEffect('ats-submit', { job: 'Backend Engineer' })
    expect(result.status).toBe('unknown')
    expect(result.sent).toBe(false)

    bridge.reconnect()
    expect(bridge.isOnline()).toBe(true)
    // Reconnect does not auto-resend
    expect(bridge.pendingEffects).toHaveLength(0)
  })
})

describe('ContextCache', () => {
  it('returns cached entry on hit with matching key fields', () => {
    const cache = new ContextCache()
    const key = { sourceId: 'evidence-001', version: 1, contentHash: 'abc', permissionVariant: 'default', schemaVersion: 1 }
    cache.set(key, { summary: 'Company research notes' })

    const hit = cache.get(key) as { summary: string } | undefined
    expect(hit).toBeDefined()
    expect(hit!.summary).toBe('Company research notes')
  })

  it('invalidates old entry when contentHash changes', () => {
    const cache = new ContextCache()
    const key1 = { sourceId: 'evidence-001', version: 1, contentHash: 'abc', permissionVariant: 'default', schemaVersion: 1 }
    cache.set(key1, { summary: 'v1 notes' })

    const key2 = { sourceId: 'evidence-001', version: 1, contentHash: 'xyz', permissionVariant: 'default', schemaVersion: 1 }
    const invalidated = cache.get(key2)

    expect(invalidated).toBeUndefined()
    // The old entry still exists under its own key, but the cache should have
    // emitted an invalidation event for the changed contentHash.
    const events = cache.getInvalidationEvents()
    expect(events.length).toBeGreaterThan(0)
    expect(events[events.length - 1]!.type).toBe('cache.invalidated')
  })
})
