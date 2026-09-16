# beg Unified Career Automation Target Architecture

> Status: Proposal for user confirmation
> Date: 2026-09-06
> Source basis: current beg repository and authorized BossHunter-analysis reuse

## Goal

Unify beg's career mission, evidence, approval, audit, recovery, and HR conversation capabilities with BossHunter's opportunity discovery, filtering, scoring, browser execution, platform safety, monitoring, throttling, and resume rendering capabilities.

The system will remain a modular monolith with a separate Local Execution Bridge. The domain database remains the only business source of truth. LangGraph remains an optional durable workflow adapter and owns scheduling/checkpoints only.

## Product boundary

The product has four runtime surfaces:

1. **Career Control Center** — React web application for missions, opportunities, pursuits, evidence, resumes, approvals, conversations, runs, and traces.
2. **Career API** — Fastify composition root. Routes validate contracts and call application services.
3. **Career Runtime** — domain and application modules for state transitions, policy, artifacts, recovery, and run coordination.
4. **Local Execution Bridge** — Python process using the authorized BossHunter browser runtime and Chrome CDP. It observes and executes only approved connector plans.

## Dependency direction

```text
apps/web -> apps/api -> packages/application -> packages/domain -> packages/contracts
                              |
                              +-> packages/infrastructure
                              +-> bridge protocol

bridge -> BossHunter browser runtime -> user's Chrome session
```

The bridge never becomes the owner of Mission, Pursuit, Application, Conversation, Evidence, or user facts.

## Domain aggregates

| Aggregate | Owns | Does not own |
|---|---|---|
| CandidateProfile | confirmed profile facts, source materials, consent | job state or external actions |
| CareerMission | target, priorities, authorization envelope reference | individual job progress |
| Opportunity | normalized job identity and source snapshots | user decision to pursue |
| OpportunityIntelligence | hard-filter result, score, explanation, freshness | confirmed candidate facts |
| Pursuit | candidate's active relationship with one Opportunity | global Mission stage |
| Evidence | user-submitted proof and verification status | model claims without proof |
| ResumeVersion | immutable generated material and evidence refs | approval or delivery receipt |
| Application | application lifecycle and receipt state | browser page state |
| Conversation | inbound/outbound messages and resolution state | user authorization |
| ExecutionRun | collection, scoring, monitoring, rendering, or delivery run | domain truth |
| EffectTrace | idempotency key, attempts, observations, receipt, uncertainty | permission decision |
| ConnectorSession | platform, tab, login/capability observations | long-term credentials |

## Unified opportunity pipeline

```text
DiscoveryRun
  -> platform collection
  -> raw source snapshot
  -> normalized Opportunity
  -> identity deduplication
  -> hard filter
  -> AI scoring
  -> user creates Pursuit
  -> gap/evidence plan
  -> ResumeProposal + independent review
  -> ActionIntent
  -> approval and capability check
  -> ConnectorPlan
  -> Bridge execution or Deep Link takeover
  -> Receipt / Unknown / Failed
  -> Conversation monitoring
  -> Outcome feedback
```

Collection and scoring are independent resumable runs. A failed scoring run must not corrupt a collected Opportunity. A disconnected browser must stop delivery and leave the EffectTrace uncertain until a fresh observation resolves it.

## Reused BossHunter capabilities

The following authorized modules become infrastructure adapters behind TypeScript contracts:

| BossHunter capability | New home | Integration rule |
|---|---|---|
| `collection/base.py`, `models.py`, `capabilities.py` | bridge collector protocol | map `JobCandidate` to `OpportunitySnapshot` |
| `collection_run_store.py` | execution persistence adapter | map run state to `ExecutionRun` |
| `scoring_run_store.py` | execution persistence adapter | map score run to `ExecutionRun` and artifacts |
| `job_filters.py`, `scoring_selection.py` | scoring adapter | hard rules run before model scoring |
| `platform_safety.py`, `throttle.py` | connector safety policy | reserve/lock decisions become traceable events |
| `browser/client.py`, `browser/runtime/*` | Local Execution Bridge | bridge exposes observation and approved action RPC only |
| `cancellation.py` | run control | cancellation is persisted and cooperative |
| `executor/monitor.py` | conversation connector | detected messages become inbound observations, never automatic facts |
| `ai/resume.py` | resume adapter | generated material must pass evidence and integrity validation |
| `ui/confirm.py` | approval UX reference | final approval remains owned by beg API and domain policy |

Platform-specific collectors and senders are integrated one by one behind capability contracts. They do not write directly to domain tables.

## Connector capability model

Every connector reports capabilities at runtime:

```ts
type ConnectorCapability =
  | 'discover'
  | 'inspect'
  | 'score_context'
  | 'send_message'
  | 'submit_application'
  | 'observe_conversation'
  | 'upload_resume'

interface ConnectorCapabilities {
  connector: string
  observedAt: string
  capabilities: Record<ConnectorCapability, 'supported' | 'manual' | 'unavailable'>
  safetyState: 'ready' | 'locked' | 'login_required' | 'challenge_detected' | 'stale'
}
```

Unknown, stale, locked, or challenge-detected capability means `manual` or `unavailable`; it never means automatic execution.

## Action and recovery rules

All external actions follow this sequence:

```text
proposal -> policy decision -> approval version check -> capability observation
         -> idempotency lookup -> execute once -> observe receipt
```

Application and message states must include `unknown` and `reconciling`. When execution ends after the external platform may have accepted the action but before a receipt is known, recovery queries the same idempotency key or asks the user to reconcile. It does not resend automatically.

## Storage transition

The first implementation can use SQLite for both beg domain state and bridge-side operational state, but they must have separate schemas and ownership: `career.db` for domain truth and `bridge.db` for local runtime observations. The current BossHunter tables are imported through an explicit migration and remain read-only compatibility inputs until mapped.

PostgreSQL is a later deployment option; it is not required for the first integrated slice.

## Acceptance gates

The integrated slice is accepted only when it demonstrates:

1. Multi-platform collection creates deduplicated Opportunities with source and freshness references.
2. Hard filters prevent unsuitable jobs from entering model scoring.
3. Scoring can pause, restart, and resume without duplicating artifacts.
4. A user-created Pursuit keeps job progress independent from other Pursuits.
5. Resume output references confirmed Evidence and rejects unsupported facts.
6. Application and HR actions require policy, approval, capability, and idempotency checks.
7. Browser disconnect, challenge, stale page, and unknown receipt produce safe recovery states.
8. Conversation monitoring stores inbound observations and routes out-of-envelope topics to takeover.
9. `pnpm verify` and bridge contract tests pass.

## Reuse and license record

The user has stated that the BossHunter author granted permission to fork and reuse the relevant code. The fork must retain the BossHunter copyright/license notices and preserve the written permission in the project governance record before distribution.
