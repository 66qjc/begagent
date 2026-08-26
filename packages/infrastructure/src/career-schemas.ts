import { z } from 'zod'

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

type JobAnalysisInput = z.input<typeof JobAnalysisSchema>
type EvidenceSprintInput = z.input<typeof EvidenceSprintSchema>
type ResumeInput = z.input<typeof ResumeSchema>
type HrReplyInput = z.input<typeof HrReplySchema>

function stripJsonFence(value: string): string {
  return value.trim()
    .replace(/^\u0060\u0060\u0060(?:json)?\s*/i, '')
    .replace(/\s*\u0060\u0060\u0060$/, '')
}

/**
 * Parse and validate model output against a Zod schema.
 * Throws errors whose wording matches the existing ConfiguredCareerRuntime
 * so that both runtimes report failures consistently.
 */
function validateArtifact<T>(artifact: string, text: string, schema: z.ZodType<T>): T {
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

export {
  JobAnalysisSchema,
  EvidenceSprintSchema,
  ResumeSchema,
  HrReplySchema,
  stripJsonFence,
  validateArtifact,
}
export type {
  JobAnalysisInput,
  EvidenceSprintInput,
  ResumeInput,
  HrReplyInput,
}
