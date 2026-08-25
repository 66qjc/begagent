import type { DocumentVerification, ResumeDraft, ResumeReview } from '@career/contracts'

export interface ResumeReadinessInput {
  draft: ResumeDraft
  review: ResumeReview
  verification: DocumentVerification
}

export interface ResumeReadinessDecision {
  ready: boolean
  blockers: string[]
}

/** Pure domain gate used before a verified resume may enter application approval. */
export function evaluateResumeReadiness(input: ResumeReadinessInput): ResumeReadinessDecision {
  const blockers = new Set<string>()
  const { draft, review, verification } = input

  if (review.verdict !== 'approved') blockers.add('review_changes_required')
  if (review.groundingStatus !== 'passed') blockers.add('grounding_failed')
  if (review.findings.some((finding) => finding.severity === 'blocking')) {
    blockers.add('review_has_blocking_findings')
  }
  if (review.proposedEdits.length > 0) blockers.add('review_has_unapplied_edits')

  const referencedClaimIndexes = [
    ...review.findings.flatMap((finding) => finding.claimIndex === undefined ? [] : [finding.claimIndex]),
    ...review.proposedEdits.map((edit) => edit.claimIndex),
  ]
  for (const claimIndex of referencedClaimIndexes) {
    if (claimIndex >= draft.claims.length) blockers.add(`review_claim_out_of_range:${claimIndex}`)
  }

  const mandatoryChecks = [
    ['render', verification.renderStatus],
    ['visual', verification.visualStatus],
    ['text_layer', verification.textLayerStatus],
    ['required_fields', verification.requiredFieldsStatus],
  ] as const
  for (const [name, status] of mandatoryChecks) {
    if (status !== 'passed') blockers.add(`${name}_not_passed`)
  }

  if (verification.degradedReasons.length > 0) blockers.add('verification_degraded')
  for (const item of verification.keywordCoverage) {
    if (item.status === 'missing_but_supported') {
      blockers.add(`keyword_missing_but_supported:${item.keyword}`)
    }
  }

  return { ready: blockers.size === 0, blockers: [...blockers] }
}
