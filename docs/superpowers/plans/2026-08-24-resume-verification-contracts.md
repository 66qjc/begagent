# Resume Verification Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add executable schemas for evidence-grounded resume drafts, independent reviews and document verification, plus a pure domain gate that decides whether a resume is ready for application.

**Architecture:** `@career/contracts` owns the Zod wire contracts and inferred types. `@career/core` owns a pure `evaluateResumeReadiness` rule with no runtime, database or UI dependency. This increment does not change Mission stages, persistence or external channels; orchestration wiring is a later checkpoint.

**Tech Stack:** Node.js 22, TypeScript 5.9, Zod 4, Vitest 3, pnpm 10.

## Global Constraints

- Follow red-green-refactor: every production behavior starts with a failing test.
- Every resume claim and proposed replacement carries at least one Evidence ID.
- An approved review must have passed grounding, no blocking findings and no unapplied edits.
- All four mandatory document checks must pass before application readiness.
- `missing_but_supported` blocks readiness; `missing_real_gap` remains visible but does not block.
- `not_run` verification requires a non-empty degraded reason and never counts as passed.
- Do not change Mission stages, SQLite schema, API routes, UI, model prompts or external-channel behavior in this increment.
- Do not add dependencies.
- The current workspace has no Git metadata, so this plan does not create commits.

---

### Task 1: Resume artifact wire contracts

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Modify: `tests/core/contracts.test.ts`

**Interfaces:**
- Produces: `ResumeDraftSchema`, `ResumeReviewSchema`, `DocumentVerificationSchema` and their inferred TypeScript types.
- Consumers: Task 2 imports the inferred types through `@career/contracts`.

- [x] **Step 1: Write failing schema tests**

Add tests proving that a claim without Evidence IDs is rejected, an internally inconsistent approved review is rejected, a `not_run` check without a degraded reason is rejected, and valid examples parse.

- [x] **Step 2: Verify the RED state**

Run: `pnpm vitest run tests/core/contracts.test.ts`

Expected: FAIL because the three new schemas are not exported.

- [x] **Step 3: Implement the minimal schemas**

Add:

```ts
export const ResumeDraftSchema = z.object({
  targetJobId: IdSchema,
  sourceProfileVersion: z.number().int().positive(),
  headline: ShortTextSchema,
  summary: LongTextSchema,
  claims: z.array(z.object({ text: LongTextSchema, evidenceIds: z.array(IdSchema).min(1) })).min(1),
})
```

Define `ResumeReviewSchema` with `reviewerRunId`, `verdict`, `groundingStatus`, structured findings and evidence-backed proposed edits. Define `DocumentVerificationSchema` with the four mandatory statuses, keyword coverage and degraded reasons. Use `superRefine` for cross-field invariants.

- [x] **Step 4: Verify the GREEN state**

Run: `pnpm vitest run tests/core/contracts.test.ts`

Expected: all contract tests pass.

### Task 2: Pure application-readiness gate

**Files:**
- Create: `packages/core/src/resume-readiness.ts`
- Modify: `packages/core/src/index.ts`
- Create: `tests/core/resume-readiness.test.ts`

**Interfaces:**
- Consumes: `ResumeDraft`, `ResumeReview`, `DocumentVerification` from `@career/contracts`.
- Produces: `evaluateResumeReadiness(input): { ready: boolean; blockers: string[] }`.

- [x] **Step 1: Write failing readiness tests**

Cover these independent behaviors:

```ts
expect(evaluateResumeReadiness(validInput)).toEqual({ ready: true, blockers: [] })
expect(evaluateResumeReadiness(inputWithFailedGrounding).ready).toBe(false)
expect(evaluateResumeReadiness(inputWithFailedTextLayer).ready).toBe(false)
expect(evaluateResumeReadiness(inputWithMissingSupportedKeyword).ready).toBe(false)
expect(evaluateResumeReadiness(inputWithRealGap).ready).toBe(true)
```

- [x] **Step 2: Verify the RED state**

Run: `pnpm vitest run tests/core/resume-readiness.test.ts`

Expected: FAIL because `evaluateResumeReadiness` is not exported.

- [x] **Step 3: Implement the minimal pure evaluator**

Return stable blocker codes for review verdict, grounding, each mandatory check, unapplied edits, missing-supported keywords and degraded verification. Do not read files or mutate input.

- [x] **Step 4: Verify the GREEN state**

Run: `pnpm vitest run tests/core/resume-readiness.test.ts tests/core/contracts.test.ts`

Expected: all focused tests pass.

### Task 3: Document the implemented boundary and run full verification

**Files:**
- Modify: `docs/reference-adoption-ai-job-search.md`
- Modify: `docs/architecture.md`

**Interfaces:**
- Consumes: the schemas and evaluator from Tasks 1 and 2.
- Produces: documentation that distinguishes implemented contracts from later orchestration/PDF work.

- [x] **Step 1: Update implementation status**

Record that the structured contracts and pure readiness evaluator exist, while Reviewer runtime calls, persistence, rendering, visual inspection and Poppler integration remain future work.

- [x] **Step 2: Run focused verification**

Run: `pnpm vitest run tests/core/contracts.test.ts tests/core/resume-readiness.test.ts`

Expected: all focused tests pass.

- [x] **Step 3: Run full verification**

Run: `pnpm verify`

Expected: TypeScript check, every Vitest test and both production builds pass.

## Self-Review

- Spec coverage: schemas cover Draft, Review and Verification; the evaluator covers the application gate; runtime and persistence wiring are explicitly excluded.
- Placeholder scan: no TBD/TODO or unspecified implementation step remains.
- Type consistency: Task 2 imports exactly the inferred types created by Task 1 and exports the name used by its tests.
