import type { CareerPolicyConfig } from '@career/contracts'
import type { ActionPolicyInput, PolicyDecision } from './model.ts'
import type { ActionPolicyEvaluator } from './ports.ts'

export const DEFAULT_CAREER_POLICY: CareerPolicyConfig = {
  version: '2026-08-24',
  name: '大学生求职执行安全策略',
  principles: [
    '简历、岗位判断与对外沟通只能使用可追溯的真实事实和证据。',
    '薪资、地点、到岗时间等承诺性内容必须由用户逐次确认。',
    '验证码、OTP、扫码、人脸验证和最终高风险提交必须交由用户接管。',
  ],
  rules: [
    {
      id: 'integrity-block',
      description: '禁止造假或规避平台安全机制',
      priority: 100,
      match: { risks: ['black'] },
      outcome: 'forbidden',
      reason: '该操作违反职业诚信策略，系统已禁止执行。',
    },
    {
      id: 'sensitive-confirm',
      description: '敏感信息或对外承诺逐次确认',
      priority: 90,
      match: { risks: ['red'] },
      outcome: 'awaiting_approval',
      reason: '该操作涉及敏感信息或对外承诺，必须经过用户确认。',
    },
    {
      id: 'outside-scope-confirm',
      description: '授权范围外的对外动作需要确认',
      priority: 80,
      match: { risks: ['yellow'], authorization: 'outside_scope' },
      outcome: 'awaiting_approval',
      reason: '该对外操作不在当前授权范围内，需要用户确认。',
    },
    {
      id: 'scoped-external-allow',
      description: '允许授权范围内的低风险对外动作',
      priority: 70,
      match: { risks: ['yellow'], authorization: 'inside_scope' },
      outcome: 'execute',
      reason: '该操作在当前策略与授权范围内，可以执行。',
    },
    {
      id: 'internal-allow',
      description: '允许绿色内部分析与草稿动作',
      priority: 60,
      match: { risks: ['green'] },
      outcome: 'execute',
      reason: '该操作为低风险内部动作，可以执行。',
    },
  ],
  defaultDecision: {
    outcome: 'forbidden',
    reason: '没有匹配到允许规则，系统按失败关闭策略禁止执行。',
  },
}

/** Compiles an ordered, fail-closed policy document into the domain evaluator. */
export function createPolicyEvaluator(config: CareerPolicyConfig): ActionPolicyEvaluator {
  const rules = [...config.rules].sort((left, right) => right.priority - left.priority)
  return (input): PolicyDecision => {
    const insideScope = input.authorizedActionTypes.includes(input.actionType)
    const rule = rules.find((candidate) => {
      const { match } = candidate
      if (match.risks && !match.risks.includes(input.risk)) return false
      if (match.actionTypes && !match.actionTypes.includes(input.actionType)) return false
      if (match.authorization === 'inside_scope' && !insideScope) return false
      if (match.authorization === 'outside_scope' && insideScope) return false
      return true
    })
    if (!rule) return { ...config.defaultDecision }
    return { outcome: rule.outcome, reason: rule.reason, ruleId: rule.id }
  }
}

const defaultEvaluator = createPolicyEvaluator(DEFAULT_CAREER_POLICY)

/** Applies the default fail-closed career action policy before any external effect. */
export function evaluateActionPolicy(input: ActionPolicyInput): PolicyDecision {
  return defaultEvaluator(input)
}
