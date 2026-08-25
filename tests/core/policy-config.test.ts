import { describe, expect, it } from 'vitest'
import * as contracts from '@career/contracts'
import * as core from '@career/core'

const policyDocument = {
  version: '2026-08-24',
  name: '求职执行安全策略',
  principles: ['事实必须有证据', '承诺性动作必须由用户确认'],
  rules: [
    {
      id: 'integrity-block',
      description: '禁止造假',
      priority: 100,
      match: { risks: ['black'] },
      outcome: 'forbidden',
      reason: '命中诚信禁止策略。',
    },
    {
      id: 'commitment-confirm',
      description: '敏感承诺确认',
      priority: 90,
      match: { risks: ['red'] },
      outcome: 'awaiting_approval',
      reason: '敏感承诺必须由用户确认。',
    },
    {
      id: 'outside-scope-confirm',
      description: '授权范围外确认',
      priority: 80,
      match: { risks: ['yellow'], authorization: 'outside_scope' },
      outcome: 'awaiting_approval',
      reason: '动作不在授权范围内。',
    },
  ],
  defaultDecision: {
    outcome: 'forbidden',
    reason: '没有匹配到允许规则，按失败关闭处理。',
  },
} as const

describe('versioned career policy configuration', () => {
  it('parses a policy document and evaluates ordered risk rules', () => {
    const schema = (contracts as Record<string, unknown>).CareerPolicyConfigSchema as {
      parse(value: unknown): unknown
    }
    expect(schema, 'CareerPolicyConfigSchema must be exported').toBeDefined()

    const create = (core as Record<string, unknown>).createPolicyEvaluator as
      | ((config: unknown) => (input: unknown) => { outcome: string; reason: string; ruleId?: string })
      | undefined
    expect(create, 'createPolicyEvaluator must be exported').toBeTypeOf('function')

    const evaluate = create!(schema.parse(policyDocument))
    expect(evaluate({
      risk: 'red',
      actionType: 'send_hr_reply',
      authorizedActionTypes: ['send_hr_reply'],
    })).toMatchObject({
      outcome: 'awaiting_approval',
      ruleId: 'commitment-confirm',
    })
    expect(evaluate({
      risk: 'yellow',
      actionType: 'submit_application',
      authorizedActionTypes: [],
    })).toMatchObject({
      outcome: 'awaiting_approval',
      ruleId: 'outside-scope-confirm',
    })
  })

  it('uses the fail-closed default when no rule matches', () => {
    const schema = (contracts as Record<string, unknown>).CareerPolicyConfigSchema as {
      parse(value: unknown): unknown
    }
    const create = (core as Record<string, unknown>).createPolicyEvaluator as
      (config: unknown) => (input: unknown) => { outcome: string; reason: string }
    const evaluate = create(schema.parse(policyDocument))

    expect(evaluate({
      risk: 'green',
      actionType: 'unknown_internal_action',
      authorizedActionTypes: [],
    })).toEqual({
      outcome: 'forbidden',
      reason: '没有匹配到允许规则，按失败关闭处理。',
    })
  })
})
