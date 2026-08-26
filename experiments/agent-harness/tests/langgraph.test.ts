import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { LangGraphHarnessAdapter } from '../src/candidates/langgraph-adapter.ts'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtempSync, rmSync } from 'node:fs'

let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'beg-lg-'))
})

afterEach(() => {
  try {
    rmSync(tempDir, { recursive: true, force: true })
  } catch {
    // Windows may hold SQLite WAL files briefly after close; ignore cleanup errors
  }
})

describe('LangGraphHarnessAdapter', () => {
  it('produces concurrent events for both pursuits', async () => {
    const adapter = new LangGraphHarnessAdapter(join(tempDir, 'lg.db'))
    const result = await adapter.start('run-concurrent-1')
    await adapter.close()

    const pursuitIds = new Set(result.events.filter(e => e.pursuitId).map(e => e.pursuitId))
    expect(pursuitIds.has('pursuit-direct')).toBe(true)
    expect(pursuitIds.has('pursuit-growth')).toBe(true)
  })

  it('suspends at salary escalation node with out-of-envelope reason', async () => {
    const adapter = new LangGraphHarnessAdapter(join(tempDir, 'lg-suspend.db'))
    const result = await adapter.start('run-suspend-1')
    await adapter.close()

    expect(result.status).toBe('suspended')
    expect(result.suspendedReason).toBe('salary_out_of_envelope')
    const salaryEvents = result.events.filter(e => e.taskId === 'salary-escalation')
    expect(salaryEvents.length).toBeGreaterThan(0)
  })

  it('recovers after adapter close and rebuild with same run ID', async () => {
    const dbPath = join(tempDir, 'lg-recover.db')
    const adapter1 = new LangGraphHarnessAdapter(dbPath)
    const r1 = await adapter1.start('run-recover-1')
    expect(r1.status).toBe('suspended')
    await adapter1.close()

    const adapter2 = new LangGraphHarnessAdapter(dbPath)
    const r2 = await adapter2.recover('run-recover-1')
    expect(r2.status).toBe('suspended')
    expect(r2.events.length).toBeGreaterThan(0)
    await adapter2.close()
  })

  it('resumes with approval and completes', async () => {
    const dbPath = join(tempDir, 'lg-resume.db')
    const adapter1 = new LangGraphHarnessAdapter(dbPath)
    const r1 = await adapter1.start('run-resume-1')
    expect(r1.status).toBe('suspended')
    await adapter1.close()

    const adapter2 = new LangGraphHarnessAdapter(dbPath)
    const r2 = await adapter2.resume('run-resume-1', { approved: true })
    expect(r2.status).toBe('completed')
    await adapter2.close()
  })

  it('produces exactly one ATS receipt for duplicate submits', async () => {
    const dbPath = join(tempDir, 'lg-idempotent.db')
    const adapter1 = new LangGraphHarnessAdapter(dbPath)
    await adapter1.start('run-idemp-1')
    await adapter1.close()

    const adapter2 = new LangGraphHarnessAdapter(dbPath)
    const r2 = await adapter2.resume('run-idemp-1', { approved: true })
    await adapter2.close()

    const effectEvents = r2.events.filter(e => e.type === 'effect.requested')
    const atsEvents = effectEvents.filter(e => e.payload['idempotencyKey'] === 'application:pursuit-direct:v1')
    expect(atsEvents.length).toBe(1)
    const reconciled = r2.events.filter(e => e.type === 'effect.reconciled')
    expect(reconciled.length).toBeGreaterThan(0)
  })

  it('does not execute effect when Bridge is offline', async () => {
    const dbPath = join(tempDir, 'lg-bridge.db')
    const adapter1 = new LangGraphHarnessAdapter(dbPath)
    adapter1.setBridgeOfflineBeforeResume(true)
    const r1 = await adapter1.start('run-bridge-1')
    await adapter1.close()

    const adapter2 = new LangGraphHarnessAdapter(dbPath)
    adapter2.setBridgeOfflineBeforeResume(true)
    const r2 = await adapter2.resume('run-bridge-1', { approved: true })
    await adapter2.close()

    const bridgeEvents = r2.events.filter(e => e.type === 'bridge.disconnected')
    expect(bridgeEvents.length).toBeGreaterThan(0)
    const sentEffects = r2.events.filter(e => e.type === 'effect.requested' && e.payload['sent'] === true)
    expect(sentEffects.length).toBe(0)
  })

  it('emits events with strictly increasing sequence numbers', async () => {
    const adapter = new LangGraphHarnessAdapter(join(tempDir, 'lg-seq.db'))
    const result = await adapter.start('run-seq-1')
    await adapter.close()

    for (let i = 1; i < result.events.length; i++) {
      expect(result.events[i]!.sequence).toBeGreaterThan(result.events[i - 1]!.sequence)
    }
  })

  it('deduplicates effect requests on interrupt re-entry', async () => {
    const dbPath = join(tempDir, 'lg-reentry.db')
    const adapter1 = new LangGraphHarnessAdapter(dbPath)
    await adapter1.start('run-reentry-1')
    await adapter1.close()

    // First resume triggers the ATS submit
    const adapter2 = new LangGraphHarnessAdapter(dbPath)
    const r2 = await adapter2.resume('run-reentry-1', { approved: true })
    await adapter2.close()

    // Second resume with same run should not produce a second effect
    const adapter3 = new LangGraphHarnessAdapter(dbPath)
    const r3 = await adapter3.resume('run-reentry-1', { approved: true })
    await adapter3.close()

    const allEffectEvents = [...r2.events, ...r3.events].filter(
      e => e.type === 'effect.requested' && e.payload['idempotencyKey'] === 'application:pursuit-direct:v1'
    )
    // Even with interrupt re-entry, the ledger ensures exactly-once.
    // r2.events and r3.events both contain the full persisted history, so
    // we deduplicate by sequence number before counting performed=true.
    const seenSeq = new Set<number>()
    const uniqueEffectEvents = allEffectEvents.filter(e => {
      if (seenSeq.has(e.sequence)) return false
      seenSeq.add(e.sequence)
      return true
    })
    const performed = uniqueEffectEvents.filter(e => e.payload['performed'] === true)
    expect(performed.length).toBe(1)
  })
})
