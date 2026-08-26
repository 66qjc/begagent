import { describe, expect, it } from 'vitest'
import * as core from '@career/core'

type PursuitTransitionFn = (current: string, next: string) => void

function pursuitTransition(): PursuitTransitionFn {
  const value = (core as Record<string, unknown>).assertPursuitTransition
  expect(value, 'assertPursuitTransition must be exported').toBeTypeOf('function')
  return value as PursuitTransitionFn
}

function missionTransition(): PursuitTransitionFn {
  const value = (core as Record<string, unknown>).assertMissionTransition
  expect(value, 'assertMissionTransition must be exported').toBeTypeOf('function')
  return value as PursuitTransitionFn
}

describe('mission workflow', () => {
  it('accepts the complete pursuit golden-path sequence', () => {
    const stages = [
      'discovered',
      'qualified',
      'growth_plan',
      'evidence_sprint',
      'materials_ready',
      'application_awaiting_approval',
      'application_submitted',
      'hr_active',
      'completed',
    ]

    for (let index = 0; index < stages.length - 1; index += 1) {
      expect(() => pursuitTransition()(stages[index]!, stages[index + 1]!)).not.toThrow()
    }
  })

  it('rejects skipped and reversed pursuit stages', () => {
    expect(() => pursuitTransition()('discovered', 'application_submitted')).toThrow(/Illegal mission transition/)
    expect(() => pursuitTransition()('materials_ready', 'qualified')).toThrow(/Illegal mission transition/)
  })

  it('allows active to completed for mission status', () => {
    expect(() => missionTransition()('active', 'completed')).not.toThrow()
  })

  it('rejects reversed mission status', () => {
    expect(() => missionTransition()('completed', 'active')).toThrow(/Illegal mission transition/)
  })
})
