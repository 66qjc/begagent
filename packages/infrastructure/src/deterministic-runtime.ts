import type { CareerRuntimePort } from '@career/core'

/** Keyless, repeatable runtime used by the competition golden path. */
export class DeterministicCareerRuntime implements CareerRuntimePort {
  async analyzeJob(): ReturnType<CareerRuntimePort['analyzeJob']> {
    return {
      recommendation: 'growth_application',
      summary: '硬性条件基本满足，但现有经历尚未直接证明 Agent 产品设计能力，建议完成短期证据冲刺后投递。',
      gaps: ['缺少可演示的 AI Agent 产品成果', '缺少对审批与失败恢复的系统说明'],
      evidenceStrength: 'medium',
    }
  }

  async planEvidenceSprint(): ReturnType<CareerRuntimePort['planEvidenceSprint']> {
    return {
      title: '完成大学生求职 Agent 产品证据冲刺',
      objective: '产出包含用户问题、状态流、证据约束、审批节点和恢复路径的可演示产品方案。',
    }
  }

  async updateResume(input: { evidenceTitle: string; evidenceSummary: string }): ReturnType<CareerRuntimePort['updateResume']> {
    return {
      headline: 'AI 产品实习生｜Agent 工作流与用户研究',
      summary: '面向大学生求职场景，设计多 Agent 协作、证据约束和审批恢复闭环。',
      claims: [
        `完成「${input.evidenceTitle}」，${input.evidenceSummary}`,
        '将外部投递与 HR 沟通抽象为可审计、可恢复的动作意图。',
      ],
    }
  }

  async draftHrReply(): ReturnType<CareerRuntimePort['draftHrReply']> {
    return {
      content: '您好，感谢沟通。薪资和具体到岗时间会影响我的求职承诺，我想确认岗位职责与实习安排后再给您准确答复。',
      risk: 'red',
    }
  }
}
