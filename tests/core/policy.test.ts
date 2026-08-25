import { describe, expect, it } from 'vitest'
import * as core from '@career/core'

type Decision = { outcome: 'execute' | 'awaiting_approval' | 'forbidden'; reason: string }
type Evaluate = (input: {
  risk: 'green' | 'yellow' | 'red' | 'black'
  actionType: string
  authorizedActionTypes: string[]
}) => Decision

function evaluate(): Evaluate {
  const value = (core as Record<string, unknown>).evaluateActionPolicy
  expect(value, 'evaluateActionPolicy must be exported').toBeTypeOf('function')
  return value as Evaluate
}

describe('external action policy', () => {
  it('executes green internal work', () => {
    expect(evaluate()({ risk: 'green', actionType: 'analyze_job', authorizedActionTypes: [] }).outcome).toBe('execute')
  })

  it('requires approval for unscoped yellow work', () => {
    const decision = evaluate()({ risk: 'yellow', actionType: 'submit_application', authorizedActionTypes: [] })
    expect(decision.outcome).toBe('awaiting_approval')
    expect(decision.reason).toContain('授权范围')
  })

  it('allows explicitly scoped yellow work', () => {
    expect(evaluate()({
      risk: 'yellow',
      actionType: 'send_low_risk_hr_reply',
      authorizedActionTypes: ['send_low_risk_hr_reply'],
    }).outcome).toBe('execute')
  })

  it('always pauses red work and forbids black work', () => {
    const sensitive = evaluate()({
      risk: 'red',
      actionType: 'send_salary_reply',
      authorizedActionTypes: ['send_salary_reply'],
    })
    expect(sensitive.outcome).toBe('awaiting_approval')
    expect(sensitive.reason).toContain('用户确认')

    const forbidden = evaluate()({
      risk: 'black',
      actionType: 'fabricate_experience',
      authorizedActionTypes: ['fabricate_experience'],
    })
    expect(forbidden.outcome).toBe('forbidden')
    expect(forbidden.reason).toContain('诚信策略')
  })
})
