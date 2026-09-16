import type { CareerRuntimePort } from '@career/core'
import type { ResumeSection, ResumeSkillGroup } from '@career/core'

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

  async updateResume(input: Parameters<CareerRuntimePort['updateResume']>[0]): ReturnType<CareerRuntimePort['updateResume']> {
    const sections: ResumeSection[] = [
      {
        title: `${input.jobTitle} · 证据冲刺成果`,
        role: '产品负责人',
        startDate: '2025-08',
        endDate: '2025-08',
        bullets: [
          {
            text: `**产品设计：**主导设计大学生求职多 Agent 协作平台，定义岗位判断、证据冲刺、投递审批三阶段黄金闭环，覆盖从岗位发现到 HR 沟通的完整流程。`,
            verbTier: '主导',
            evidenceIds: [],
            metrics: [
              { value: '3', dimension: '协作 Agent 数量' },
              { value: '9', dimension: '状态机阶段' },
            ],
          },
          {
            text: `**状态机设计：**负责设计 Pursuit 独立状态机，支持并行求职路径独立推进，通过单步前进校验防止状态跳跃与回退。`,
            verbTier: '负责',
            evidenceIds: [],
            metrics: [
              { value: '100%', dimension: '状态变更校验覆盖率' },
            ],
          },
          {
            text: `**证据约束：**推动建立证据可追溯机制，简历每条经历必须引用已确认证据，外部投递先形成动作意图经用户审批后执行。`,
            verbTier: '推动',
            evidenceIds: [],
            metrics: [
              { value: '4', qualifier: '约', dimension: '审批门控节点' },
            ],
          },
        ],
      },
      {
        title: '校园服务产品调研与交互原型',
        role: '产品设计',
        startDate: '2024-09',
        endDate: '2025-03',
        bullets: [
          {
            text: `**用户研究：**参与校园服务痛点调研，完成 20+ 用户访谈与问卷分析，识别服务预约效率低、信息分散等核心问题。`,
            verbTier: '参与',
            evidenceIds: [],
            metrics: [
              { value: '20+', dimension: '访谈样本数' },
            ],
          },
          {
            text: `**原型设计：**负责校园服务小程序交互原型设计，覆盖服务浏览、预约、评价三个核心流程，产出可点击高保真原型。`,
            verbTier: '负责',
            evidenceIds: [],
            metrics: [
              { value: '3', dimension: '核心流程数' },
              { value: '1', dimension: '高保真原型' },
            ],
          },
        ],
      },
    ]

    const skills: ResumeSkillGroup[] = [
      {
        name: 'AI/LLM 能力',
        keywords: ['多 Agent 编排', 'Prompt 工程', 'Function Calling', 'LangGraph.js', 'DeepSeek API'],
      },
      {
        name: '产品方法论',
        keywords: ['用户研究', '竞品分析', '交互原型设计', '需求文档撰写', '产品流程设计'],
      },
      {
        name: '数据与工程',
        keywords: ['TypeScript', 'Fastify', 'SQLite', 'Zod 契约', '状态机设计'],
      },
    ]

    return {
      headline: `${input.jobTitle}｜Agent 工作流设计与用户研究`,
      summary: `面向大学生求职场景，设计多 Agent 协作、证据约束和审批恢复闭环。完成岗位判断、证据冲刺、投递审批全流程，具备可审计的状态机和可恢复的持久化方案。`,
      sections,
      skills,
    }
  }

  async draftHrReply(): ReturnType<CareerRuntimePort['draftHrReply']> {
    return {
      content: '您好，感谢沟通。薪资和具体到岗时间会影响我的求职承诺，我想确认岗位职责与实习安排后再给您准确答复。',
      risk: 'red',
    }
  }
}
