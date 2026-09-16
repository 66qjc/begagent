import { DeepSeekHarness, type DeepSeekHarnessOptions } from '@deepseek-ai/dsh-sdk-client'
import type { CareerRuntimePort } from '@career/core'
import {
  buildAnalyzeJobPrompt,
  buildEvidenceSprintPrompt,
  buildResumePrompt,
  buildHrReplyPrompt,
} from './career-prompts.ts'
import {
  JobAnalysisSchema,
  EvidenceSprintSchema,
  ResumeSchema,
  HrReplySchema,
  validateArtifact,
} from './career-schemas.ts'

export interface DshCareerRuntimeOptions extends DeepSeekHarnessOptions {}

/** Optional DeepSeek Harness subprocess runtime behind the career-domain port. */
export class DshCareerRuntime implements CareerRuntimePort {
  private readonly harness: DeepSeekHarness

  constructor(options: DshCareerRuntimeOptions) {
    this.harness = new DeepSeekHarness(options)
  }

  async analyzeJob(input: Parameters<CareerRuntimePort['analyzeJob']>[0]): ReturnType<CareerRuntimePort['analyzeJob']> {
    const { system, prompt } = buildAnalyzeJobPrompt(input)
    const text = await this.runPrompt('career-job-execution', system, prompt)
    return validateArtifact('job analysis', text, JobAnalysisSchema)
  }

  async planEvidenceSprint(): ReturnType<CareerRuntimePort['planEvidenceSprint']> {
    const { system, prompt } = buildEvidenceSprintPrompt()
    const text = await this.runPrompt('career-interview-growth', system, prompt)
    return validateArtifact('evidence sprint', text, EvidenceSprintSchema)
  }

  async updateResume(input: Parameters<CareerRuntimePort['updateResume']>[0]): ReturnType<CareerRuntimePort['updateResume']> {
    const { system, prompt } = buildResumePrompt(input)
    const text = await this.runPrompt('career-advantage-resume', system, prompt)
    const result = validateArtifact('resume update', text, ResumeSchema)
    return {
      headline: result.headline,
      summary: result.summary,
      sections: result.sections.map((s) => ({
        title: s.title,
        ...(s.role !== undefined ? { role: s.role } : {}),
        ...(s.startDate !== undefined ? { startDate: s.startDate } : {}),
        ...(s.endDate !== undefined ? { endDate: s.endDate } : {}),
        ...(s.url !== undefined ? { url: s.url } : {}),
        bullets: s.bullets.map((b) => ({
          text: b.text,
          verbTier: b.verbTier,
          ...(b.evidenceIds !== undefined ? { evidenceIds: b.evidenceIds } : {}),
          ...(b.metrics !== undefined ? { metrics: b.metrics.map((m) => ({
            value: m.value,
            dimension: m.dimension,
            ...(m.qualifier !== undefined ? { qualifier: m.qualifier } : {}),
          })) } : {}),
        })),
      })),
      skills: result.skills,
    }
  }

  async draftHrReply(input: Parameters<CareerRuntimePort['draftHrReply']>[0]): ReturnType<CareerRuntimePort['draftHrReply']> {
    const { system, prompt } = buildHrReplyPrompt(input)
    const text = await this.runPrompt('career-job-execution', system, prompt)
    return validateArtifact('HR reply', text, HrReplySchema)
  }

  async close(): Promise<void> {
    await this.harness.close()
  }

  private async runPrompt(sessionId: string, system: string, prompt: string): Promise<string> {
    const result = await this.harness.run(`${system}\n\n${prompt}`, { sessionId })
    return result.finalResponse
  }
}
