# Third-party Provider and Policy Configuration Implementation Plan

> **For Codex:** Execute inline with the executing-plans workflow. This workspace is not a Git repository, so do not create a worktree or commits.

**Goal:** Add operator-configured multi-protocol model APIs and versioned career policies without allowing providers to bypass CareerOrchestrator, evidence boundaries, or user approval.

**Architecture:** Keep CareerRuntimePort as the only model boundary. A runtime catalog selects deterministic, Chat Completions, OpenAI Responses, or Anthropic Messages at process startup; secrets are resolved only from environment variables. Protocol transports normalize text before the career runtime validates structured output. A versioned policy document is parsed into a fail-closed evaluator injected into CareerOrchestrator.

**Tech Stack:** Node.js 22, TypeScript 5.9, Fastify 5, Zod 4, native fetch, Vitest, JSON configuration.

## Global Constraints

- The deterministic provider remains the default and requires no network or secret.
- No endpoint may accept an arbitrary provider URL or API key from an ordinary Web request.
- API keys are referenced by environment-variable name and never returned by the API.
- Providers can propose structured artifacts only; Mission state, evidence confirmation, approval, and external effects remain owned by CareerOrchestrator.
- Black actions are forbidden, red actions always require confirmation, and unscoped yellow actions require confirmation.
- Existing 22 tests and golden-loop behavior must remain passing.

---

### Task 1: Versioned Policy Contract and Engine

**Files:**
- Modify: packages/contracts/src/index.ts
- Modify: packages/core/src/model.ts
- Modify: packages/core/src/ports.ts
- Modify: packages/core/src/policy.ts
- Modify: packages/core/src/orchestrator.ts
- Create: config/career-policy.json
- Test: tests/core/policy-config.test.ts

**Interfaces:**
- Produces: CareerPolicyConfigSchema, CareerPolicyConfig, createPolicyEvaluator(config), and ActionPolicyEvaluator.
- Consumes: existing ActionRisk, ActionPolicyInput, and PolicyDecision.

- [ ] Write tests that load a custom ordered policy, verify black/red/unscoped-yellow behavior, and verify no-match defaults fail closed.
- [ ] Run pnpm vitest run tests/core/policy-config.test.ts and confirm failure because configuration APIs do not exist.
- [ ] Add Zod contracts, default policy, ordered rule matching, and evaluator injection into the orchestrator.
- [ ] Add config/career-policy.json containing the current integrity, commitment, authorization, evidence, and user-takeover principles.
- [ ] Re-run the focused policy tests and existing policy/orchestrator tests.

### Task 2: Multi-protocol Runtime Provider

**Files:**
- Create: packages/infrastructure/src/model-protocols.ts
- Create: packages/infrastructure/src/configured-career-runtime.ts
- Modify: packages/infrastructure/src/index.ts
- Modify: packages/infrastructure/package.json
- Test: tests/core/model-protocols.test.ts

**Interfaces:**
- Produces: OpenAiChatProtocol, OpenAiResponsesProtocol, AnthropicMessagesProtocol, and ConfiguredCareerRuntime implementing every CareerRuntimePort method.
- Consumes: protocol, baseUrl, apiKey, model, timeoutMs, and an injectable fetch implementation.

- [ ] Write failing tests proving each protocol uses its official endpoint, authentication header, request body, and response text shape.
- [ ] Write a failing test proving non-2xx and malformed structured outputs fail explicitly.
- [ ] Implement protocol-specific transports plus one shared career prompt/validation runtime.
- [ ] Run the focused tests until green.

### Task 3: Runtime Catalog and Secure Startup Selection

**Files:**
- Modify: packages/contracts/src/index.ts
- Create: packages/infrastructure/src/runtime-config.ts
- Modify: packages/infrastructure/src/index.ts
- Create: config/runtime.providers.json
- Modify: .env.example
- Test: tests/core/runtime-config.test.ts

**Interfaces:**
- Produces: RuntimeProvidersConfigSchema, loadRuntimeProvidersConfig(path), and createConfiguredRuntime(config, env, fetch).
- Returns: { runtime, view }, where view contains provider IDs, kinds, models, enabled state, and active provider but no secret.

- [ ] Write failing tests for deterministic selection, environment-secret resolution, missing-secret rejection, and redacted system view.
- [ ] Implement the runtime catalog and checked JSON loader.
- [ ] Add one deterministic active provider and disabled examples for Chat Completions, Responses, and Anthropic Messages.
- [ ] Document CAREER_RUNTIME_PROVIDER, CAREER_PROVIDER_API_KEY, and configuration paths in .env.example.
- [ ] Run focused tests until green.

### Task 4: API Composition and Read-only System Configuration

**Files:**
- Modify: apps/api/src/app.ts
- Modify: apps/api/src/routes.ts
- Modify: apps/api/src/server.ts
- Modify: tests/integration/api.test.ts

**Interfaces:**
- Produces: GET /api/system/config and provider-aware GET /api/health.
- Consumes: runtime bundle and parsed policy from the composition root.

- [ ] Add failing integration assertions for active provider, policy version, and absence of API key fields.
- [ ] Inject runtime and policy into buildApp; load JSON configuration only in server.ts.
- [ ] Close a configured runtime during Fastify shutdown when it exposes close().
- [ ] Run API and golden-loop integration tests.

### Task 5: Documentation and Full Verification

**Files:**
- Modify: README.md
- Modify: docs/architecture.md

**Interfaces:**
- Documents exact configuration, fallback, security boundary, and provider activation commands.

- [ ] Document how to add any of the three supported protocols without committing secrets.
- [ ] Explain that third-party APIs cannot advance Mission state or bypass policy.
- [ ] Run pnpm verify.
- [ ] Start production artifacts with the deterministic provider and verify health plus /api/system/config.

## Self-review

- Spec coverage: provider configuration, third-party API call path, policy-as-configuration, redacted observability, fallback, and security boundaries are all assigned.
- Placeholder scan: no deferred implementation markers are used.
- Type consistency: runtime selection returns a CareerRuntimePort; policy injection returns a PolicyDecision; API receives only redacted runtime metadata.
