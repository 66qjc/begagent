import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MastraHarnessAdapter } from '../src/candidates/mastra-adapter.ts'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtempSync, rmSync } from 'node:fs'

let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'beg-mastra-'))
})

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

describe('MastraHarnessAdapter', () => {
  it('produces concurrent events for both pursuits', async () => {
    const adapter = new MastraHarnessAdapter(join(tempDir, 'mastra.db'))
    const result = await adapter.start('run-concurrent-1')
    await adapter.close()

    const pursuitIds = new Set(result.events.filter(e => e.pursuitId).map(e => e.pursuitId))
    expect(pursuitIds.has('pursuit-direct')).toBe(true)
    expect(pursuitIds.has('pursuit-growth')).toBe(true)
  })

  it('suspends at salary escalation node with out-of-envelope reason', async () => {
    const adapter = new MastraHarnessAdapter(join(tempDir, 'mastra-suspend.db'))
    const result = await adapter.start('run-suspend-1')
    await adapter.close()

    expect(result.status).toBe('suspended')
    expect(result.suspendedReason).toBe('salary_out_of_envelope')
    const salaryEvents = result.events.filter(e => e.taskId === 'salary-escalation')
    expect(salaryEvents.length).toBeGreaterThan(0)
  })

  it('recovers after adapter close and rebuild with same run ID', async () => {
    const dbPath = join(tempDir, 'mastra-recover.db')
    const adapter1 = new MastraHarnessAdapter(dbPath)
    const r1 = await adapter1.start('run-recover-1')
    expect(r1.status).toBe('suspended')
    await adapter1.close()

    const adapter2 = new MastraHarnessAdapter(dbPath)
    const r2 = await adapter2.recover('run-recover-1')
    expect(r2.status).toBe('suspended')
    // Events from the first run must persist
    expect(r2.events.length).toBeGreaterThan(0)
    await adapter2.close()
  })

  it('resumes with approval and completes', async () => {
    const dbPath = join(tempDir, 'mastra-resume.db')
    const adapter1 = new MastraHarnessAdapter(dbPath)
    const r1 = await adapter1.start('run-resume-1')
    expect(r1.status).toBe('suspended')
    await adapter1.close()

    const adapter2 = new MastraHarnessAdapter(dbPath)
    const r2 = await adapter2.resume('run-resume-1', { approved: true })
    expect(r2.status).toBe('completed')
    await adapter2.close()
  })

  it('produces exactly one ATS receipt for duplicate submits', async () => {
    const dbPath = join(tempDir, 'mastra-idempotent.db')
    const adapter1 = new MastraHarnessAdapter(dbPath)
    await adapter1.start('run-idemp-1')
    await adapter1.close()

    const adapter2 = new MastraHarnessAdapter(dbPath)
    // Resume with approval triggers the ATS submit
    const r2 = await adapter2.resume('run-idemp-1', { approved: true })
    await adapter2.close()

    const effectEvents = r2.events.filter(e => e.type === 'effect.requested')
    const atsEvents = effectEvents.filter(e => e.payload['idempotencyKey'] === 'application:pursuit-direct:v1')
    expect(atsEvents.length).toBe(1)
    const reconciled = r2.events.filter(e => e.type === 'effect.reconciled')
    expect(reconciled.length).toBeGreaterThan(0)
  })

  it('does not execute effect when Bridge is offline', async () => {
    const dbPath = join(tempDir, 'mastra-bridge.db')
    const adapter1 = new MastraHarnessAdapter(dbPath)
    adapter1.setBridgeOfflineBeforeResume(true)
    const r1 = await adapter1.start('run-bridge-1')
    await adapter1.close()

    const adapter2 = new MastraHarnessAdapter(dbPath)
    adapter2.setBridgeOfflineBeforeResume(true)
    const r2 = await adapter2.resume('run-bridge-1', { approved: true })
    await adapter2.close()

    const bridgeEvents = r2.events.filter(e => e.type === 'bridge.disconnected')
    expect(bridgeEvents.length).toBeGreaterThan(0)
    // Effect should NOT be sent while offline
    const sentEffects = r2.events.filter(e => e.type === 'effect.requested' && e.payload['sent'] === true)
    expect(sentEffects.length).toBe(0)
  })

  it('emits events with strictly increasing sequence numbers', async () => {
    const adapter = new MastraHarnessAdapter(join(tempDir, 'mastra-seq.db'))
    const result = await adapter.start('run-seq-1')
    await adapter.close()

    for (let i = 1; i < result.events.length; i++) {
      expect(result.events[i]!.sequence).toBeGreaterThan(result.events[i - 1]!.sequence)
    }
  })
})
