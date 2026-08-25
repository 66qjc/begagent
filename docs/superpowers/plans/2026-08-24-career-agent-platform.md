# Career Agent Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable university job-search execution platform with three bounded business agents, deterministic orchestration, durable career memory and evidence, approval-gated external actions, controlled ATS/HR adapters, restart recovery, and an independent interactive Web UI.

**Architecture:** A pnpm TypeScript workspace separates the pure career domain from infrastructure and delivery. `CareerOrchestrator` owns mission/task transitions and emits durable domain events; business agents can propose structured work but cannot directly mutate memory or perform external actions. SQLite stores career-domain state, while `HarnessRuntimePort` keeps DeepSeek Harness behind an optional SDK-managed subprocess adapter and the default demo uses a deterministic local runtime.

**Tech Stack:** Node.js 22+, TypeScript, pnpm workspaces, Fastify, SQLite through `better-sqlite3`, Zod, React, Vite, Vitest, Playwright.

## Global Constraints

- The UI is owned by this project and must not reuse the DeepSeek Harness Web UI.
- The three business agents are Advantage Resume, Job Execution, and Interview Growth; memory is shared infrastructure, not a fourth agent.
- Every task has one owner; supporting agents only receive structured assistance or handoff packets.
- Core orchestration, state transitions, memory writes, evidence links, approval records, event trace, and restart recovery are real runtime behavior.
- ATS and HR integrations are controlled adapters and may be deterministic Mock implementations.
- Red and yellow external actions never execute directly from model output; they become durable `ActionIntent` records first.
- The default runtime is deterministic and keyless. DeepSeek Harness integration is optional and must remain behind `HarnessRuntimePort`.
- The demo must run without a DeepSeek API key.
- No implementation depends on DeepSeek Harness Agent Team.
- No external recruiting platform is automated.

---

## Target File Structure

```text
beg agent/
├─ apps/
│  ├─ api/src/
│  │  ├─ app.ts                 Fastify composition and error handling
│  │  ├─ server.ts              process entrypoint
│  │  └─ routes.ts              HTTP route registration
│  └─ web/src/
│     ├─ app/App.tsx            application shell and mission workspace
│     ├─ app/api.ts             typed HTTP client
│     ├─ components/            reusable product components
│     ├─ features/mission/      timeline, agents, approvals, evidence, actions
│     ├─ styles/tokens.css      locked product tokens
│     └─ styles/global.css      responsive shell and interaction states
├─ packages/
│  ├─ contracts/src/index.ts    Zod schemas and API/domain DTOs
│  ├─ core/src/
│  │  ├─ model.ts               domain entities and state vocabulary
│  │  ├─ ports.ts               repository/runtime/channel interfaces
│  │  ├─ policy.ts              risk classification and approval decisions
│  │  ├─ workflow.ts            legal transition rules
│  │  └─ orchestrator.ts        transactional use cases and event emission
│  └─ infrastructure/src/
│     ├─ sqlite.ts              schema, transaction and repository adapter
│     ├─ deterministic-runtime.ts keyless business-agent proposals
│     ├─ mock-channels.ts       controlled ATS and HR adapters
│     ├─ dsh-runtime.ts         optional SDK subprocess adapter
│     └─ demo.ts                idempotent golden-path seed
├─ tests/
│  ├─ core/                     pure state and policy tests
│  ├─ integration/              SQLite/API/recovery tests
│  └─ e2e/                      browser golden-path test
└─ docs/architecture.md         implemented boundaries and runtime topology
```

## Task 1: Workspace and Executable Contracts

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`
- Create: `packages/contracts/package.json`, `packages/contracts/src/index.ts`
- Create: `packages/core/package.json`, `packages/core/src/model.ts`, `packages/core/src/ports.ts`
- Test: `tests/core/contracts.test.ts`

**Interfaces:**
- Produces branded identifiers `MissionId`, `TaskId`, `ActionIntentId`, `EvidenceId`.
- Produces enums/unions for `AgentKind`, `MissionStage`, `TaskStatus`, `ActionRisk`, `ActionStatus`, `EventType`.
- Produces request/response schemas for mission creation, JD import, challenge selection, evidence completion, approval decision, HR simulation, and workspace snapshot.

- [ ] Write a failing contracts test proving invalid agent ownership, invalid action risk, and incomplete JD requests are rejected.
- [ ] Run `pnpm vitest run tests/core/contracts.test.ts` and confirm failure because contracts do not exist.
- [ ] Add workspace configuration and the minimum schemas/types required by the test.
- [ ] Re-run the focused test and confirm it passes.
- [ ] Run `pnpm typecheck` and fix package-boundary type errors.

## Task 2: Deterministic Workflow and Policy

**Files:**
- Create: `packages/core/src/workflow.ts`
- Create: `packages/core/src/policy.ts`
- Test: `tests/core/workflow.test.ts`, `tests/core/policy.test.ts`

**Interfaces:**
- Produces `assertTransition(current, command): TransitionResult`.
- Produces `evaluateAction(action, authorization): PolicyDecision`.
- Legal golden path: `profile_ready -> job_analyzed -> challenge_selected -> evidence_sprint -> resume_updated -> application_awaiting_approval -> application_submitted -> hr_active -> completed`.
- Policy decisions are `execute`, `awaiting_approval`, or `forbidden` and always include a reason.

- [ ] Write failing transition tests for the full legal path and for rejected skips/repeated submissions.
- [ ] Run the focused workflow test and confirm the transition API is missing.
- [ ] Implement the smallest explicit transition table that passes.
- [ ] Write failing policy tests for green internal work, yellow submission, red salary/location replies, and black fabrication.
- [ ] Run the focused policy test and confirm failure.
- [ ] Implement risk evaluation with plan-scoped authorization and fail-closed defaults.
- [ ] Run both focused suites and confirm they pass.

## Task 3: Transactional Career Orchestrator

**Files:**
- Create: `packages/core/src/orchestrator.ts`, `packages/core/src/index.ts`
- Test: `tests/core/orchestrator.test.ts`

**Interfaces:**
- Consumes `CareerRepository`, `HarnessRuntimePort`, `ExternalChannelPort`, and `Clock` from `ports.ts`.
- Produces use cases `createMission`, `analyzeJob`, `chooseChallenge`, `completeEvidenceSprint`, `requestApplication`, `decideAction`, `receiveHrMessage`, and `getWorkspace`.
- Every mutation appends at least one ordered domain event inside the same repository transaction.
- Handoffs contain mission, job, owner, memory references, permissions, requested work, and expected artifact fields.

- [ ] Write a failing test that executes the golden path through in-memory ports and asserts single-owner tasks, structured handoff, evidence provenance, and approval gating.
- [ ] Run the focused test and confirm failure because the orchestrator is absent.
- [ ] Implement use cases with no SQL, HTTP, or framework imports.
- [ ] Add failing tests for duplicate approval, stale action version, and forbidden fabrication.
- [ ] Implement optimistic version checks and idempotency keys.
- [ ] Run the orchestrator tests and all core tests.

## Task 4: SQLite Persistence and Restart Recovery

**Files:**
- Create: `packages/infrastructure/package.json`
- Create: `packages/infrastructure/src/sqlite.ts`, `packages/infrastructure/src/index.ts`
- Test: `tests/integration/sqlite-recovery.test.ts`

**Interfaces:**
- Implements `CareerRepository` with SQLite transactions.
- Tables: missions, tasks, jobs, memory_items, evidence_items, resume_versions, action_intents, applications, hr_messages, domain_events, idempotency_keys.
- Uses a separate database file selected by `CAREER_DB_PATH`; it never shares the Harness runtime database.

- [ ] Write a failing integration test that persists a mission, closes the database, reopens it, and resumes the same pending approval without duplicate events.
- [ ] Run the test and confirm failure because the SQLite adapter is absent.
- [ ] Implement schema migration version 1 and repository transactions.
- [ ] Re-run the recovery test.
- [ ] Add and pass tests for foreign-key enforcement, event ordering, and idempotency uniqueness.

## Task 5: Deterministic Runtime and Controlled Channels

**Files:**
- Create: `packages/infrastructure/src/deterministic-runtime.ts`
- Create: `packages/infrastructure/src/mock-channels.ts`
- Create: `packages/infrastructure/src/demo.ts`
- Create: `packages/infrastructure/src/dsh-runtime.ts`
- Test: `tests/integration/golden-loop.test.ts`, `tests/core/dsh-boundary.test.ts`

**Interfaces:**
- `DeterministicCareerRuntime` returns structured, evidence-aware outputs for the three agent roles without a model key.
- `MockAtsChannel` supports draft/final submission with idempotency.
- `MockHrChannel` appends inbound/outbound messages and never auto-sends red-risk content.
- `DshRuntimeAdapter` is selected only when `HARNESS_MODE=dsh` and owns SDK startup/shutdown; no other package imports DSH packages.

- [ ] Write a failing integration test for JD analysis through sensitive HR reply and assert every required demo artifact exists.
- [ ] Run it and confirm missing adapters.
- [ ] Implement deterministic runtime and controlled channels.
- [ ] Re-run and pass the golden-loop test.
- [ ] Write a static boundary test that rejects imports of DSH packages outside `dsh-runtime.ts`.
- [ ] Implement the optional adapter and pass the boundary test without requiring it to start.

## Task 6: Fastify API

**Files:**
- Create: `apps/api/package.json`, `apps/api/src/app.ts`, `apps/api/src/routes.ts`, `apps/api/src/server.ts`
- Test: `tests/integration/api.test.ts`

**Interfaces:**
- `GET /api/health`
- `POST /api/demo/reset`
- `GET /api/workspace`
- `POST /api/jobs/analyze`
- `POST /api/missions/challenge`
- `POST /api/evidence/complete`
- `POST /api/applications/request`
- `POST /api/actions/:id/decision`
- `POST /api/hr/simulate`

- [ ] Write failing Fastify injection tests for health, empty workspace, reset, every golden-loop command, validation errors, and stale approvals.
- [ ] Run the API test and confirm routes are missing.
- [ ] Compose repositories/adapters/orchestrator and implement schema-validated routes.
- [ ] Re-run API and integration suites.
- [ ] Verify a process restart against a temporary database retains the pending action.

## Task 7: Independent Career Command Center UI

**Files:**
- Create: `apps/web/package.json`, `apps/web/index.html`, `apps/web/vite.config.ts`
- Create: `apps/web/src/main.tsx`, `apps/web/src/app/App.tsx`, `apps/web/src/app/api.ts`
- Create: `apps/web/src/components/*.tsx`, `apps/web/src/features/mission/*.tsx`
- Create: `apps/web/src/styles/tokens.css`, `apps/web/src/styles/global.css`
- Test: `apps/web/src/app/App.test.tsx`

**Interfaces:**
- The first viewport shows current mission stage, owner Agent, next action, pending approvals, and execution health.
- The UI offers direct actions to reset the demo, analyze the seeded JD, choose growth challenge, complete evidence, request submission, approve/reject, simulate HR, and handle sensitive reply.
- Timeline, handoff, evidence provenance, memory scope, application, and HR context render from API data rather than hardcoded presentation state.

- [ ] Write a failing component test for loading, empty, active mission, pending approval, and API error states.
- [ ] Run the test and confirm the UI components are missing.
- [ ] Implement the app shell and typed API client.
- [ ] Implement mission rail, agent ownership strip, stage timeline, task panel, evidence panel, approval drawer, and HR thread.
- [ ] Add keyboard focus, 44px touch targets, reduced-motion rules, responsive mobile drawer, skeletons, empty/error/success states.
- [ ] Re-run component tests and `pnpm --filter @career/web build`.

## Task 8: Browser Golden-Path Verification and Documentation

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/golden-path.spec.ts`
- Create: `docs/architecture.md`, `README.md`
- Modify: root scripts and package scripts as needed for one-command development and verification.

**Interfaces:**
- `pnpm dev` runs API and Web UI.
- `pnpm verify` runs typecheck, unit/integration tests, production builds, and browser E2E.

- [ ] Write the browser test before final UI wiring and confirm it fails at the first missing user-visible state.
- [ ] Implement only the wiring required to make the browser flow pass.
- [ ] Run the full browser flow at desktop and 375px mobile widths.
- [ ] Capture a screenshot of the active command center and inspect it for clipping, empty regions, broken hierarchy, and console errors.
- [ ] Run the Finesse product pre-flight: color lock, no AI-purple glow, no fake data labels, interaction states, contrast, focus, touch targets, and reduced motion.
- [ ] Document the runtime boundary, module ownership, database separation, golden path, commands, and DSH fallback behavior.
- [ ] Run `pnpm verify` from a fresh process and record the exact results.

## Task 9: Optional DSH Plugin Decision

**Files:**
- Create only if Tasks 1–8 are verified: `packages/dsh-plugin-career-bridge/`
- Otherwise document the deferred plugin seam in `docs/architecture.md`.

**Interfaces:**
- A plugin may expose structured Career Domain Gateway tools, but it cannot own CareerOrchestrator state or bypass Policy/Approval.

- [ ] Measure remaining scope after the complete verified product path.
- [ ] If implemented, start with a failing contract test proving the plugin can only create action intents and cannot execute external actions.
- [ ] If not implemented, document the exact plugin inputs, outputs, and security invariant without adding placeholder code.

## Self-Review

- Product requirements are covered by Tasks 2–8: three agents, deterministic ownership, handoff, memory, evidence, approval, recovery, controlled channels, and independent UI.
- DeepSeek Harness is constrained to one adapter file and is not required by the keyless demo.
- The plan contains no fake frontend-only state transitions; UI commands call the API and read persisted state back.
- Every production behavior begins with a failing unit, integration, component, or browser test.
- Completion requires fresh typecheck, tests, builds, browser flow, restart recovery, and visual inspection.
