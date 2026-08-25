import { DeepSeekHarness, type DeepSeekHarnessOptions } from '@deepseek-ai/dsh-sdk-client'
import type { CareerRuntimePort } from '@career/core'

export interface DshCareerRuntimeOptions extends DeepSeekHarnessOptions {}

/** Optional DeepSeek Harness subprocess runtime behind the career-domain port. */
export class DshCareerRuntime implements CareerRuntimePort {
  private readonly harness: DeepSeekHarness

  constructor(options: DshCareerRuntimeOptions) {
    this.harness = new DeepSeekHarness(options)
  }

  async analyzeJob(input: Parameters<CareerRuntimePort['analyzeJob']>[0]): ReturnType<CareerRuntimePort['analyzeJob']> {
    return this.runJson('career-job-execution', [
      '你是求职执行 Agent。只返回 JSON，不要 Markdown。',
      '输出字段：recommendation(string), summary(string), gaps(string[]), evidenceStrength(string)。',
      `岗位：${JSON.stringify(input)}`,
    ].join('\n'))
  }

  async planEvidenceSprint(): ReturnType<CareerRuntimePort['planEvidenceSprint']> {
    return this.runJson('career-interview-growth', [
      '你是面试成长 Agent。设计一个 1 至 3 天可由学生真实完成的岗位证据冲刺。',
      '只返回 JSON，不要 Markdown。输出字段：title(string), objective(string)。',
    ].join('\n'))
  }

  async updateResume(input: Parameters<CareerRuntimePort['updateResume']>[0]): ReturnType<CareerRuntimePort['updateResume']> {
    return this.runJson('career-advantage-resume', [
      '你是优势简历 Agent。只能使用给定证据，不得扩写不存在的结果。',
      '只返回 JSON，不要 Markdown。输出字段：headline(string), summary(string), claims(string[])。',
      `证据：${JSON.stringify(input)}`,
    ].join('\n'))
  }

  async draftHrReply(input: Parameters<CareerRuntimePort['draftHrReply']>[0]): ReturnType<CareerRuntimePort['draftHrReply']> {
    return this.runJson('career-job-execution', [
      '你是求职执行 Agent。起草礼貌回复，但不得替用户承诺薪资、地点或到岗时间。',
      '只返回 JSON，不要 Markdown。输出字段：content(string), risk，risk 必须为 red。',
      `HR 消息：${JSON.stringify(input)}`,
    ].join('\n'))
  }

  async close(): Promise<void> {
    await this.harness.close()
  }

  private async runJson<T>(sessionId: string, prompt: string): Promise<T> {
    const result = await this.harness.run(prompt, { sessionId })
    const normalized = result.finalResponse.trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
    const parsed: unknown = JSON.parse(normalized)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('DeepSeek Harness returned a non-object career response.')
    }
    return parsed as T
  }
}
