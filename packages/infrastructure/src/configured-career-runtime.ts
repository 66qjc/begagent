import { z } from 'zod'
import type { CareerRuntimePort } from '@career/core'
import type { ModelProtocol } from './model-protocols.ts'

const JobAnalysisSchema = z.object({
  recommendation: z.string().min(1),
  summary: z.string().min(1),
  gaps: z.array(z.string().min(1)),
  evidenceStrength: z.string().min(1),
})
const EvidenceSprintSchema = z.object({
  title: z.string().min(1),
  objective: z.string().min(1),
})
const ResumeSchema = z.object({
  headline: z.string().min(1),
  summary: z.string().min(1),
  claims: z.array(z.string().min(1)),
})
const HrReplySchema = z.object({
  content: z.string().min(1),
  risk: z.literal('red'),
})

interface ConfiguredCareerRuntimeOptions {
  protocol: ModelProtocol
}

/** Maps any supported model wire protocol into validated career-domain artifacts. */
export class ConfiguredCareerRuntime implements CareerRuntimePort {
  private readonly protocol: ModelProtocol

  constructor(options: ConfiguredCareerRuntimeOptions) {
    this.protocol = options.protocol
  }

  async analyzeJob(input: Parameters<CareerRuntimePort['analyzeJob']>[0]): ReturnType<CareerRuntimePort['analyzeJob']> {
    return this.run(
      'job analysis',
      [
        '你是求职执行 Agent。只基于用户输入分析，不得虚构岗位或候选人事实。',
        '只返回 JSON：recommendation(string), summary(string), gaps(string[]), evidenceStrength(string)。',
      ].join('\n'),
      `岗位：${JSON.stringify(input)}`,
      JobAnalysisSchema,
    )
  }

  async planEvidenceSprint(): ReturnType<CareerRuntimePort['planEvidenceSprint']> {
    return this.run(
      'evidence sprint',
      [
        '你是面试成长 Agent。设计一个 1 至 3 天、学生可真实完成且可验证的证据冲刺。',
        '只返回 JSON：title(string), objective(string)。',
      ].join('\n'),
      '为当前岗位证据缺口生成最小成长任务。',
      EvidenceSprintSchema,
    )
  }

  async updateResume(input: Parameters<CareerRuntimePort['updateResume']>[0]): ReturnType<CareerRuntimePort['updateResume']> {
    return this.run(
      'resume update',
      [
        '你是优势简历 Agent。只能使用给定证据，不得添加不存在的成果、数字或职责。',
        '只返回 JSON：headline(string), summary(string), claims(string[])。',
      ].join('\n'),
      `已确认证据：${JSON.stringify(input)}`,
      ResumeSchema,
    )
  }

  async draftHrReply(input: Parameters<CareerRuntimePort['draftHrReply']>[0]): ReturnType<CareerRuntimePort['draftHrReply']> {
    return this.run(
      'HR reply',
      [
        '你是求职执行 Agent。起草礼貌回复，不得替用户承诺薪资、地点或到岗时间。',
        '只返回 JSON：content(string), risk，且 risk 必须为 red，交由用户确认。',
      ].join('\n'),
      `HR 消息：${JSON.stringify(input)}`,
      HrReplySchema,
    )
  }

  private async run<T>(
    artifact: string,
    system: string,
    prompt: string,
    schema: z.ZodType<T>,
  ): Promise<T> {
    const text = await this.protocol.generateText({ system, prompt })
    let value: unknown
    try {
      value = JSON.parse(stripJsonFence(text))
    } catch {
      throw new Error(`${artifact} output was not valid JSON.`)
    }
    const parsed = schema.safeParse(value)
    if (!parsed.success) {
      throw new Error(`${artifact} output failed validation: ${parsed.error.issues[0]?.message ?? 'unknown issue'}.`)
    }
    return parsed.data
  }
}

function stripJsonFence(value: string): string {
  return value.trim()
    .replace(/^\u0060\u0060\u0060(?:json)?\s*/i, '')
    .replace(/\s*\u0060\u0060\u0060$/, '')
}
