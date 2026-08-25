import { z } from 'zod'

/** The only business agents allowed to own career tasks. */
export const AgentKindSchema = z.enum([
  'advantage_resume',
  'job_execution',
  'interview_growth',
])

/** Risk vocabulary used by the domain policy gate. */
export const ActionRiskSchema = z.enum(['green', 'yellow', 'red', 'black'])

export const PolicyOutcomeSchema = z.enum(['execute', 'awaiting_approval', 'forbidden'])

export const PolicyRuleSchema = z.object({
  id: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  priority: z.number().int(),
  match: z.object({
    risks: z.array(ActionRiskSchema).min(1).optional(),
    actionTypes: z.array(z.string().trim().min(1)).min(1).optional(),
    authorization: z.enum(['any', 'inside_scope', 'outside_scope']).optional(),
  }),
  outcome: PolicyOutcomeSchema,
  reason: z.string().trim().min(1).max(500),
})

/** Operator-owned, versioned policy document loaded at API process startup. */
export const CareerPolicyConfigSchema = z.object({
  version: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(160),
  principles: z.array(z.string().trim().min(1).max(500)).min(1),
  rules: z.array(PolicyRuleSchema).min(1),
  defaultDecision: z.object({
    outcome: PolicyOutcomeSchema,
    reason: z.string().trim().min(1).max(500),
  }),
})

const RuntimeProviderBaseSchema = z.object({
  id: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(160),
  enabled: z.boolean(),
})

const RemoteRuntimeProviderSchema = RuntimeProviderBaseSchema.extend({
  protocol: z.enum(['chat-completions', 'responses', 'anthropic-messages']),
  baseUrl: z.url(),
  model: z.string().trim().min(1).max(200),
  apiKeyEnv: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
  timeoutMs: z.number().int().min(1_000).max(300_000).default(30_000),
})

export const RuntimeProviderConfigSchema = z.discriminatedUnion('protocol', [
  RuntimeProviderBaseSchema.extend({ protocol: z.literal('deterministic') }),
  RemoteRuntimeProviderSchema,
])

/** Startup-only provider catalog. It references secrets by environment-variable name. */
export const RuntimeProvidersConfigSchema = z.object({
  version: z.string().trim().min(1).max(80),
  activeProviderId: z.string().trim().min(1).max(120),
  providers: z.array(RuntimeProviderConfigSchema).min(1),
}).superRefine((value, context) => {
  const ids = new Set<string>()
  for (const provider of value.providers) {
    if (ids.has(provider.id)) {
      context.addIssue({ code: 'custom', path: ['providers'], message: `Duplicate provider id: ${provider.id}` })
    }
    ids.add(provider.id)
  }
  if (!ids.has(value.activeProviderId)) {
    context.addIssue({ code: 'custom', path: ['activeProviderId'], message: 'Active provider does not exist.' })
  }
})

/** A normalized job description submitted for analysis. */
export const AnalyzeJobRequestSchema = z.object({
  title: z.string().trim().min(2).max(120),
  company: z.string().trim().min(2).max(120),
  location: z.string().trim().min(2).max(120),
  description: z.string().trim().min(80).max(20_000),
})

const ArtifactIdSchema = z.string().trim().min(1).max(160)
const ArtifactTextSchema = z.string().trim().min(1).max(5_000)

export const ResumeClaimSchema = z.object({
  text: ArtifactTextSchema,
  evidenceIds: z.array(ArtifactIdSchema).min(1),
})

/** Evidence-grounded resume proposal. It is not yet an approved resume version. */
export const ResumeDraftSchema = z.object({
  targetJobId: ArtifactIdSchema,
  sourceProfileVersion: z.number().int().positive(),
  headline: z.string().trim().min(1).max(240),
  summary: ArtifactTextSchema,
  claims: z.array(ResumeClaimSchema).min(1),
})

export const ResumeReviewFindingSchema = z.object({
  category: z.enum(['grounding', 'requirement', 'style', 'company_context']),
  severity: z.enum(['blocking', 'warning']),
  message: ArtifactTextSchema,
  claimIndex: z.number().int().nonnegative().optional(),
  evidenceIds: z.array(ArtifactIdSchema).default([]),
})

export const ResumeProposedEditSchema = z.object({
  claimIndex: z.number().int().nonnegative(),
  replacement: ArtifactTextSchema,
  reason: ArtifactTextSchema,
  evidenceIds: z.array(ArtifactIdSchema).min(1),
})

/** Independent review proposal. Approval is valid only after all edits are applied. */
export const ResumeReviewSchema = z.object({
  reviewerRunId: ArtifactIdSchema,
  verdict: z.enum(['approved', 'changes_required']),
  groundingStatus: z.enum(['passed', 'failed']),
  findings: z.array(ResumeReviewFindingSchema),
  proposedEdits: z.array(ResumeProposedEditSchema),
}).superRefine((value, context) => {
  if (value.verdict !== 'approved') return
  if (value.groundingStatus !== 'passed') {
    context.addIssue({
      code: 'custom',
      path: ['groundingStatus'],
      message: 'An approved review must pass grounding.',
    })
  }
  if (value.findings.some((finding) => finding.severity === 'blocking')) {
    context.addIssue({
      code: 'custom',
      path: ['findings'],
      message: 'An approved review cannot contain blocking findings.',
    })
  }
  if (value.proposedEdits.length > 0) {
    context.addIssue({
      code: 'custom',
      path: ['proposedEdits'],
      message: 'An approved review cannot contain unapplied edits.',
    })
  }
})

export const DocumentCheckStatusSchema = z.enum(['passed', 'failed', 'not_run'])

export const KeywordCoverageSchema = z.object({
  keyword: z.string().trim().min(1).max(240),
  priority: z.enum(['required', 'preferred']),
  status: z.enum(['covered', 'synonym_only', 'missing_but_supported', 'missing_real_gap']),
  note: ArtifactTextSchema,
})

/** Mechanical and visual verification results for a rendered resume artifact. */
export const DocumentVerificationSchema = z.object({
  renderStatus: DocumentCheckStatusSchema,
  visualStatus: DocumentCheckStatusSchema,
  textLayerStatus: DocumentCheckStatusSchema,
  requiredFieldsStatus: DocumentCheckStatusSchema,
  keywordCoverage: z.array(KeywordCoverageSchema),
  degradedReasons: z.array(ArtifactTextSchema),
}).superRefine((value, context) => {
  const statuses = [
    value.renderStatus,
    value.visualStatus,
    value.textLayerStatus,
    value.requiredFieldsStatus,
  ]
  if (statuses.includes('not_run') && value.degradedReasons.length === 0) {
    context.addIssue({
      code: 'custom',
      path: ['degradedReasons'],
      message: 'A skipped document check requires an explicit degraded reason.',
    })
  }
})

export type AgentKind = z.infer<typeof AgentKindSchema>
export type ActionRisk = z.infer<typeof ActionRiskSchema>
export type CareerPolicyConfig = z.infer<typeof CareerPolicyConfigSchema>
export type RuntimeProviderConfig = z.infer<typeof RuntimeProviderConfigSchema>
export type RuntimeProvidersConfig = z.infer<typeof RuntimeProvidersConfigSchema>
export type AnalyzeJobRequest = z.infer<typeof AnalyzeJobRequestSchema>
export type ResumeClaim = z.infer<typeof ResumeClaimSchema>
export type ResumeDraft = z.infer<typeof ResumeDraftSchema>
export type ResumeReview = z.infer<typeof ResumeReviewSchema>
export type DocumentVerification = z.infer<typeof DocumentVerificationSchema>
