import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MastraHarnessAdapter } from '../src/candidates/mastra-adapter.ts'
import { LangGraphHarnessAdapter } from '../src/candidates/langgraph-adapter.ts'
import type { HarnessAdapter } from '../src/contracts.ts'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtempSync, rmSync } from 'node:fs'

type AdapterFactory = (dbPath: string) => HarnessAdapter

const adapters: { name: string; factory: AdapterFactory }[] = [
  { name: 'mastra', factory: (db) => new MastraHarnessAdapter(db) },
  { name: 'langgraph', factory: (db) => new LangGraphHarnessAdapter(db) },
]

let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'beg-conf-'))
})

afterEach(() => {
  try { rmSync(tempDir, { recursive: true, force: true }) } catch {}
})

describe.each(adapters)('$name conformance', ({ factory }) => {
  it('runs company research and materials review concurrently', async () => {
    const adapter = factory(join(tempDir, 'conf1.db'))
    const result = await adapter.start('conf-run-1')
    await adapter.close()
    const pursuitIds = new Set(result.events.filter(e => e.pursuitId).map(e => e.pursuitId))
    expect(pursuitIds.has('pursuit-direct')).toBe(true)
    expect(pursuitIds.has('pursuit-growth')).toBe(true)
  })

  it('suspends on salary out-of-envelope', async () => {
    const adapter = factory(join(tempDir, 'conf2.db'))
    const result = await adapter.start('conf-run-2')
    await adapter.close()
    expect(result.status).toBe('suspended')
    expect(result.suspendedReason).toBe('salary_out_of_envelope')
  })

  it('recovers after close and rebuild', async () => {
    const dbPath = join(tempDir, 'conf3.db')
    const a1 = factory(dbPath)
    await a1.start('conf-run-3')
    await a1.close()
    const a2 = factory(dbPath)
    const r2 = await a2.recover('conf-run-3')
    await a2.close()
    expect(r2.events.length).toBeGreaterThan(0)
  })

  it('resumes with approval and completes', async () => {
    const dbPath = join(tempDir, 'conf4.db')
    const a1 = factory(dbPath)
    await a1.start('conf-run-4')
    await a1.close()
    const a2 = factory(dbPath)
    const r2 = await a2.resume('conf-run-4', { approved: true })
    await a2.close()
    expect(r2.status).toBe('completed')
  })

  it('ATS submit is exactly-once idempotent', async () => {
    const dbPath = join(tempDir, 'conf5.db')
    const a1 = factory(dbPath)
    await a1.start('conf-run-5')
    await a1.close()
    const a2 = factory(dbPath)
    const r2 = await a2.resume('conf-run-5', { approved: true })
    await a2.close()
    const atsEvents = r2.events.filter(e => e.type === 'effect.requested' && e.payload['idempotencyKey'] === 'application:pursuit-direct:v1')
    const seenSeq = new Set<number>()
    const unique = atsEvents.filter(e => !seenSeq.has(e.sequence) && seenSeq.add(e.sequence))
    expect(unique.length).toBe(1)
    const reconciled = r2.events.filter(e => e.type === 'effect.reconciled')
    expect(reconciled.length).toBeGreaterThan(0)
  })

  it('Bridge offline prevents effect send', async () => {
    const dbPath = join(tempDir, 'conf6.db')
    const a1 = factory(dbPath)
    if ('setBridgeOfflineBeforeResume' in a1) (a1 as unknown as { setBridgeOfflineBeforeResume: (v: boolean) => void }).setBridgeOfflineBeforeResume(true)
    await a1.start('conf-run-6')
    await a1.close()
    const a2 = factory(dbPath)
    if ('setBridgeOfflineBeforeResume' in a2) (a2 as unknown as { setBridgeOfflineBeforeResume: (v: boolean) => void }).setBridgeOfflineBeforeResume(true)
    const r2 = await a2.resume('conf-run-6', { approved: true })
    await a2.close()
    const sentEffects = r2.events.filter(e => e.type === 'effect.requested' && e.payload['sent'] === true)
    expect(sentEffects.length).toBe(0)
  })

  it('events have strictly increasing sequences', async () => {
    const adapter = factory(join(tempDir, 'conf7.db'))
    const result = await adapter.start('conf-run-7')
    await adapter.close()
    for (let i = 1; i < result.events.length; i++) {
      expect(result.events[i]!.sequence).toBeGreaterThan(result.events[i - 1]!.sequence)
    }
  })

  it('cache hit is recorded on resume', async () => {
    const dbPath = join(tempDir, 'conf8.db')
    const a1 = factory(dbPath)
    await a1.start('conf-run-8')
    await a1.close()
    const a2 = factory(dbPath)
    const r2 = await a2.resume('conf-run-8', { approved: true })
    await a2.close()
    const cacheHits = r2.events.filter(e => e.type === 'cache.hit')
    expect(cacheHits.length).toBeGreaterThan(0)
  })
})
