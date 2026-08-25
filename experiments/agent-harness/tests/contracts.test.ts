import { describe, it, expect } from 'vitest'
import { createHarnessFixture } from '../src/fixture.ts'
import type { HarnessAdapter, HarnessEvent, HarnessRunResult } from '../src/contracts.ts'

describe('harness fixture shape', () => {
  const fixture = createHarnessFixture('run-test-001')

  it('contains exactly two JobPursuits', () => {
    expect(fixture.pursuits).toHaveLength(2)
  })

  it('has pursuit-direct doing company research', () => {
    const direct = fixture.pursuits.find((p) => p.id === 'pursuit-direct')
    expect(direct).toBeDefined()
    const researchTask = direct!.tasks.find((t) => t.id === 'company-research')
    expect(researchTask).toBeDefined()
    expect(researchTask!.kind).toBe('company_research')
  })

  it('has pursuit-growth doing materials review', () => {
    const growth = fixture.pursuits.find((p) => p.id === 'pursuit-growth')
    expect(growth).toBeDefined()
    const reviewTask = growth!.tasks.find((t) => t.id === 'materials-review')
    expect(reviewTask).toBeDefined()
    expect(reviewTask!.kind).toBe('materials_review')
  })

  it('has salary escalation as an out-of-envelope message', () => {
    const salaryTask = fixture.pursuits
      .flatMap((p) => p.tasks)
      .find((t) => t.id === 'salary-escalation')
    expect(salaryTask).toBeDefined()
    expect(salaryTask!.kind).toBe('salary_escalation')
    expect(salaryTask!.inEnvelope).toBe(false)
  })

  it('fixes the ATS application idempotency key', () => {
    expect(fixture.atsAction.idempotencyKey).toBe('application:pursuit-direct:v1')
  })

  it('includes one Bridge disconnect and reconnect sequence', () => {
    expect(fixture.bridgeEvents).toHaveLength(2)
    expect(fixture.bridgeEvents[0]!.type).toBe('bridge.disconnected')
    expect(fixture.bridgeEvents[1]!.type).toBe('bridge.reconnected')
  })

  it('changes contentHash when evidence is updated', () => {
    const originalHash = fixture.evidence.contentHash
    const updated = createHarnessFixture('run-test-002')
    expect(updated.evidence.contentHash).not.toBe(originalHash)
  })

  it('does not allow a third pursuit', () => {
    expect(fixture.pursuits.filter((p) => p.id !== 'pursuit-direct' && p.id !== 'pursuit-growth')).toHaveLength(0)
  })
})

describe('HarnessAdapter contract types', () => {
  it('defines candidate ids as langgraph or mastra', () => {
    const c: 'langgraph' | 'mastra' = 'mastra'
    expect(['langgraph', 'mastra']).toContain(c)
  })

  it('HarnessRunResult requires status and events', () => {
    const result: HarnessRunResult = {
      runId: 'r1',
      status: 'completed',
      events: [],
      domainSnapshotHash: 'abc',
    }
    expect(result.status).toBe('completed')
  })

  it('HarnessEvent has strictly increasing sequence', () => {
    const events: HarnessEvent[] = [
      { sequence: 1, runId: 'r1', candidate: 'mastra', pursuitId: 'p1', taskId: 't1', type: 'node.started', occurredAt: '2026-01-01T00:00:00Z', payload: {} },
      { sequence: 2, runId: 'r1', candidate: 'mastra', pursuitId: 'p1', taskId: 't1', type: 'node.completed', occurredAt: '2026-01-01T00:00:01Z', payload: {} },
    ]
    expect(events[1]!.sequence).toBeGreaterThan(events[0]!.sequence)
  })

  it('HarnessAdapter has start, resume, recover and close', () => {
    const adapter: HarnessAdapter = {
      candidate: 'mastra',
      start: async () => ({ runId: 'r1', status: 'completed', events: [], domainSnapshotHash: 'h' }),
      resume: async () => ({ runId: 'r1', status: 'completed', events: [], domainSnapshotHash: 'h' }),
      recover: async () => ({ runId: 'r1', status: 'completed', events: [], domainSnapshotHash: 'h' }),
      close: async () => {},
    }
    expect(typeof adapter.start).toBe('function')
    expect(typeof adapter.resume).toBe('function')
    expect(typeof adapter.recover).toBe('function')
    expect(typeof adapter.close).toBe('function')
  })
})
