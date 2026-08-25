import { describe, expect, it } from 'vitest'
import {
  CareerDomainError,
  IllegalTransitionError,
  NotFoundError,
  StaleActionError,
} from '@career/core'

describe('Career domain errors', () => {
  it('IllegalTransitionError carries STATE_CONFLICT code and transition context', () => {
    const error = new IllegalTransitionError('profile_ready', 'completed')
    expect(error).toBeInstanceOf(CareerDomainError)
    expect(error.code).toBe('STATE_CONFLICT')
    expect(error.message).toBe('Illegal mission transition: profile_ready -> completed')
    expect(error.name).toBe('IllegalTransitionError')
  })

  it('StaleActionError carries STATE_CONFLICT code', () => {
    const error = new StaleActionError('Stale action intent version.')
    expect(error).toBeInstanceOf(CareerDomainError)
    expect(error.code).toBe('STATE_CONFLICT')
    expect(error.message).toBe('Stale action intent version.')
    expect(error.name).toBe('StaleActionError')
  })

  it('NotFoundError carries NOT_FOUND code', () => {
    const error = new NotFoundError('No active career mission.')
    expect(error).toBeInstanceOf(CareerDomainError)
    expect(error.code).toBe('NOT_FOUND')
    expect(error.message).toBe('No active career mission.')
    expect(error.name).toBe('NotFoundError')
  })

  it('assertMissionTransition throws IllegalTransitionError for illegal jumps', async () => {
    const { assertMissionTransition } = await import('@career/core')
    expect(() => assertMissionTransition('profile_ready', 'completed')).toThrow(IllegalTransitionError)
    expect(() => assertMissionTransition('profile_ready', 'completed')).toThrow(CareerDomainError)
  })

  it('assertMissionTransition does not throw for legal sequential transitions', async () => {
    const { assertMissionTransition } = await import('@career/core')
    expect(() => assertMissionTransition('profile_ready', 'job_analyzed')).not.toThrow()
  })
})
