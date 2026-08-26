import type { CareerRuntimePort } from '@career/core'
import type { ModelProtocol, ToolCallRequest, ToolSchema } from './model-protocols.ts'
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
import {
  CAREER_TOOLS,
  executeToolCalls,
  type ToolCall,
  type ToolContext,
  type ToolResult,
} from './career-tools.ts'

interface ConfiguredCareerRuntimeOptions {
  protocol: ModelProtocol
  toolContext?: ToolContext
}

/** Converts protocol-neutral tool definitions to the JSON-schema format used on the wire. */
function toolsToSchema(tools: typeof CAREER_TOOLS): ToolSchema[] {
  return tools.map((t) => {
    const properties: Record<string, unknown> = {}
    const required: string[] = []
    for (const param of t.parameters) {
      const prop: Record<string, unknown> = { type: param.type, description: param.description }
      if (param.enum) prop['enum'] = param.enum
      properties[param.name] = prop
      if (param.required) required.push(param.name)
    }
    return {
      name: t.name,
      description: t.description,
      parameters: { type: 'object', properties, required },
    }
  })
}

/**
 * Maps any supported model wire protocol into validated career-domain artifacts.
 * When the protocol supports tool calling, analyzeJob lets the model actively
 * query job details before producing its analysis — demonstrating autonomous
 * task understanding and environment interaction.
 */
export class ConfiguredCareerRuntime implements CareerRuntimePort {
  private readonly protocol: ModelProtocol
  private readonly toolContext: ToolContext

  constructor(options: ConfiguredCareerRuntimeOptions) {
    this.protocol = options.protocol
    this.toolContext = options.toolContext ?? { jobs: [], applications: [] }
  }

  async analyzeJob(input: Parameters<CareerRuntimePort['analyzeJob']>[0]): ReturnType<CareerRuntimePort['analyzeJob']> {
    // If the protocol supports tools, let the model decide whether to call
    // lookup_job_posting before producing its analysis.
    if (this.protocol.generateTextWithTools) {
      return this.analyzeJobWithTools(input)
    }
    const { system, prompt } = buildAnalyzeJobPrompt(input)
    const text = await this.protocol.generateText({ system, prompt })
    return validateArtifact('job analysis', text, JobAnalysisSchema)
  }

  private async analyzeJobWithTools(input: Parameters<CareerRuntimePort['analyzeJob']>[0]): ReturnType<CareerRuntimePort['analyzeJob']> {
    const { system, prompt } = buildAnalyzeJobPrompt(input)
    const toolSchemas = toolsToSchema(CAREER_TOOLS)
    const firstResponse = await this.protocol.generateTextWithTools!({ system, prompt, tools: toolSchemas })

    // If the model made no tool calls, fall back to direct text validation.
    if (firstResponse.toolCalls.length === 0) {
      if (firstResponse.text.trim()) {
        return validateArtifact('job analysis', firstResponse.text, JobAnalysisSchema)
      }
      // No text and no tool calls — fall back to plain generateText.
      const text = await this.protocol.generateText({ system, prompt })
      return validateArtifact('job analysis', text, JobAnalysisSchema)
    }

    // Execute the tool calls (read-only, no side-effects).
    const calls: ToolCall[] = firstResponse.toolCalls.map((tc: ToolCallRequest) => ({
      name: tc.name,
      arguments: tc.arguments,
    }))
    const toolResults: ToolResult[] = await executeToolCalls(calls, this.toolContext)

    // Feed the tool results back into a second prompt and ask for final analysis.
    const toolContextText = toolResults
      .map((r) => `[工具 ${r.name} 结果]\n${JSON.stringify(r.data, null, 2)}\n来源: ${r.source}`)
      .join('\n\n')
    const followUpPrompt = [
      prompt,
      '',
      '以下是你在分析中主动调用的工具返回的结果，请基于这些结果完成最终岗位判断：',
      '',
      toolContextText,
    ].join('\n')
    const secondResponse = await this.protocol.generateTextWithTools!({ system, prompt: followUpPrompt })
    const finalText = secondResponse.text.trim() || firstResponse.text.trim()
    if (!finalText) {
      throw new Error('job analysis output was empty after tool calls.')
    }
    return validateArtifact('job analysis', finalText, JobAnalysisSchema)
  }

  async planEvidenceSprint(): ReturnType<CareerRuntimePort['planEvidenceSprint']> {
    const { system, prompt } = buildEvidenceSprintPrompt()
    const text = await this.protocol.generateText({ system, prompt })
    return validateArtifact('evidence sprint', text, EvidenceSprintSchema)
  }

  async updateResume(input: Parameters<CareerRuntimePort['updateResume']>[0]): ReturnType<CareerRuntimePort['updateResume']> {
    const { system, prompt } = buildResumePrompt(input)
    const text = await this.protocol.generateText({ system, prompt })
    return validateArtifact('resume update', text, ResumeSchema)
  }

  async draftHrReply(input: Parameters<CareerRuntimePort['draftHrReply']>[0]): ReturnType<CareerRuntimePort['draftHrReply']> {
    const { system, prompt } = buildHrReplyPrompt(input)
    const text = await this.protocol.generateText({ system, prompt })
    return validateArtifact('HR reply', text, HrReplySchema)
  }
}
