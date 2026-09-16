# Unified Career Automation Migration Plan

> Status: Proposal for user confirmation
> Date: 2026-09-06

## Phase 0 — freeze the target contracts

- Add the target architecture and domain boundary documents to the active documentation index.
- Amend ADR-001 so LangGraph remains limited to durable workflow execution and does not become the owner of collection, scoring, or connector state.
- Record the BossHunter reuse permission and preserve its license notices.
- Add contract types for `OpportunitySnapshot`, `ConnectorCapabilities`, `ExecutionRun`, `EffectTrace`, `ConnectorPlan`, and `DeliveryReceipt`.

## Phase 1 — import the execution substrate

- Create `apps/bridge/` as a Python package or a separately runnable bridge workspace.
- Copy the authorized generic BossHunter modules with their notices intact.
- Keep platform-specific selectors behind bridge connector modules.
- Expose health, observation, cancellation, and capability discovery first.
- Add bridge contract tests using a fake CDP runtime.

## Phase 2 — replace the current flat job model

- Introduce `Opportunity` and `OpportunitySourceSnapshot` in `packages/core`.
- Introduce `ExecutionRun` for collection and scoring.
- Add identity-based deduplication using platform, external ID, company, title, and normalized location.
- Import existing `jobs` rows into compatibility records, then create explicit Pursuits for rows that represent user intent.
- Keep the old model readable during migration; do not silently reinterpret old statuses.

## Phase 3 — connect collection and scoring

- Implement `DiscoveryApplicationService`.
- Run platform collectors through the bridge and persist raw observations.
- Apply hard filters before AI scoring.
- Store scoring explanations as versioned artifacts linked to the Opportunity and input snapshot.
- Persist cancellation, pause, failure, and orphan recovery.

## Phase 4 — connect resume and evidence

- Map BossHunter resume generation into `ResumeProposal`.
- Validate every resume bullet against confirmed Evidence references.
- Keep Markdown and PDF as immutable artifacts with source hash and generator metadata.
- Add independent review before creating an application ActionIntent.

## Phase 5 — connect application and conversation execution

- Implement capability-aware `ConnectorPlanner`.
- Map platform safety locks and throttles to policy decisions and domain events.
- Move all sends and uploads behind approved `ActionIntent` execution.
- Add `unknown` and `reconciling` states for browser disconnects and missing receipts.
- Convert monitor observations into `Conversation` messages and takeover tasks.

## Phase 6 — replace the existing UI around the real pipeline

- Add views for Discovery Runs, scored Opportunities, Pursuits, connector status, pending approvals, conversations, and recovery.
- Remove UI claims that are not backed by an Opportunity, Run, Event, Artifact, or Receipt.
- Preserve the existing Mission journey as a user-facing grouping, while showing parallel Pursuits and independent run states.

## Required implementation order

```text
contracts -> bridge health/capability -> opportunity persistence -> collection
-> filtering/scoring -> pursuit mapping -> evidence/resume -> approval
-> application execution -> conversation monitoring -> UI consolidation
```

Each phase must have focused tests and an integration slice before the next phase changes the same state boundary.
