import { describe, expect, it } from 'vitest'
import * as core from '@career/core'

type TransitionFn = (current: string, next: string) => void

function transition(): TransitionFn {
  const value = (core as Record<string, unknown>).assertMissionTransition
  expect(value, 'assertMissionTransition must be exported').toBeTypeOf('function')
  return value as TransitionFn
}

describe('mission workflow', () => {
  it('accepts the complete golden-path sequence', () => {
    const stages = [
      'profile_ready',
      'job_analyzed',
      'challenge_selected',
      'evidence_sprint',
      'resume_updated',
      'application_awaiting_approval',
      'application_submitted',
      'hr_active',
      'completed',
    ]

    for (let index = 0; index < stages.length - 1; index += 1) {
      expect(() => transition()(stages[index]!, stages[index + 1]!)).not.toThrow()
    }
  })

  it('rejects skipped and reversed stages', () => {
    expect(() => transition()('profile_ready', 'application_submitted')).toThrow(/Illegal mission transition/)
    expect(() => transition()('resume_updated', 'job_analyzed')).toThrow(/Illegal mission transition/)
  })
})
