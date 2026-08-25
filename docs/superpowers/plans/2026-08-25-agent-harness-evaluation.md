# Agent Harness Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在最多 16 个工程小时内，以同一份 `beg` 业务 fixture 验证并选出一个成熟的 TypeScript Agent Harness／durable workflow 主框架，不继续自研通用 Agent 编排器。

**Architecture:** 在 `experiments/agent-harness/` 建立与现有原型隔离的 Spike。Mastra 与 LangGraph.js 只能通过同一个 `HarnessAdapter` 消费同一 fixture、领域仓库、模型 stub、外部效果 ledger 和 Bridge simulator；框架 checkpoint 只保存执行游标和派生运行状态，`beg` 领域对象仍由 SQLite fixture repository 掌握。通过 hard gates 后才比较时间、可用性、类型体验、依赖和可观测性，并将结论写入 ADR。

**Tech Stack:** Node.js 22.19+、TypeScript 5.9 strict、pnpm 10.28.1、Vitest 3.2.4、Zod 4、SQLite；本计划在 2026-08-25 已查询并固定 `@langchain/langgraph@1.4.12` 与 `@mastra/core@1.61.0`，执行时仍须复核 registry metadata，禁止静默改用 `latest` 或版本范围。

## Global Constraints

- Business Baseline 01–08 已 Confirmed 且总索引 Frozen；不得在 Spike 中修改这些业务定义。
- 主候选仅为 Mastra 与 LangGraph.js；OpenAI Agents SDK JS 和 Vercel AI SDK 不得作为第二套 durable orchestration framework 混入候选实现。
- 一个候选只能使用自身工作流能力和共享 adapters 完成场景，不得手写另一套 graph runner、pause engine 或 checkpoint engine 补洞。
- `CandidateProfile`、`CareerMission`、`JobPursuit`、`Task`、`DelegatedAction`、`Application`、`Conversation` 与 `Outcome` 必须保存在共享领域仓库中，不得隐藏在 chat history 或框架私有 state 中。
- 外部 effect 只能经过共享 `SideEffectLedgerStub`；同一 `idempotencyKey` 在重试、重启和双击情况下最多产生一次 effect。
- 所有模型步骤使用确定性 `CareerRuntimePort` stub，不调用网络、不使用 API key，避免模型质量干扰框架比较。
- Spike 总时间上限为 16 个工程小时：环境与契约 2 小时、每个候选最多 5 小时、故障与结果归档 4 小时。候选触发 hard gate 时立即停止该候选。
- 当前目录没有 `.git`；执行期间不得声称存在隔离分支、commit 或 Git 可恢复性。所有新增内容限定在 `experiments/agent-harness/` 与 `docs/framework/`。

---

### Task 1: 固定环境、版本和时间预算

**Files:**
- Create: `experiments/agent-harness/package.json`
- Create: `experiments/agent-harness/tsconfig.json`
- Create: `experiments/agent-harness/results/environment.json`

**Interfaces:**
- Consumes: 根目录 Node、pnpm、TypeScript 与 Vitest 版本。
- Produces: 可重现的候选精确版本、开始时间和 16 小时预算记录。

- [ ] **Step 1: 读取候选当前 package metadata**

Run:

```powershell
node --version
corepack pnpm --version
pnpm --version
corepack pnpm view @langchain/langgraph version license engines --json
corepack pnpm view @mastra/core version license engines --json
```

Expected: Node 主版本不低于 22；`corepack pnpm` 必须解析为仓库声明的 10.28.1；两个候选均返回精确版本、许可证和 engines。若 ambient `pnpm` 与 Corepack 版本不同，记录偏差并仅使用 Corepack。任何查询失败或许可证不适合赛事／产品时记录 hard fail，不安装该候选。

- [ ] **Step 2: 创建独立 Spike package**

`experiments/agent-harness/package.json` 必须使用本计划核验的精确版本；若执行日 registry metadata 已变化，仍保持下列版本完成本轮可重复比较，升级另开评估记录：

```json
{
  "name": "@beg/agent-harness-spike",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run",
    "verify": "pnpm typecheck && pnpm test"
  },
  "dependencies": {
    "@langchain/langgraph": "1.4.12",
    "@mastra/core": "1.61.0",
    "better-sqlite3": "12.2.0",
    "zod": "4.1.5"
  },
  "devDependencies": {
    "@types/better-sqlite3": "7.6.13",
    "@types/node": "24.3.0",
    "typescript": "5.9.2",
    "vitest": "3.2.4"
  }
}
```

版本核验基线：`@langchain/langgraph@1.4.12` 为 MIT、Node `>=18`；`@mastra/core@1.61.0` 为 Apache-2.0、Node `>=22.13.0`。当前项目 Node 22.19+ 同时满足两者 engines 门槛。

- [ ] **Step 3: 写入环境证据**

`results/environment.json` 保存 `startedAt`、`deadlineAt`、Node／pnpm 版本、两个 package 精确版本、license、registry metadata 查询时间和命令。`deadlineAt` 必须等于 `startedAt` 后 16 个工程小时，不用日历天代替。

- [ ] **Step 4: 安装并验证隔离性**

Run:

```powershell
corepack pnpm --dir experiments/agent-harness install --ignore-workspace
corepack pnpm --dir experiments/agent-harness exec tsc --version
```

Expected: Spike package 可独立解析且 TypeScript CLI 可运行；根目录产品代码、workspace lockfile 和业务配置没有改动。因为此时 `src/` 与 `tests/` 尚为空，不运行项目级 `typecheck`；完整 typecheck 从 Task 2 创建首批输入文件后开始。安装行为、独立 lockfile 和工具链偏差必须在 `environment.json` 记录。

---

### Task 2: 建立共享 Harness Contract 和固定业务 fixture

**Files:**
- Create: `experiments/agent-harness/src/contracts.ts`
- Create: `experiments/agent-harness/src/fixture.ts`
- Create: `experiments/agent-harness/tests/contracts.test.ts`

**Interfaces:**
- Consumes: Frozen Business Baseline 的两个并发 `JobPursuit`、单主责 Task、Envelope、receipt 和 Outcome 规则。
- Produces: `HarnessAdapter`、`HarnessEvent`、`HarnessRunResult`、`HarnessFixture`，供两个候选共同实现。

- [ ] **Step 1: 写失败测试，锁定 fixture 形状**

`tests/contracts.test.ts` 必须断言：fixture 恰好包含两个 Pursuit；一个走 company research，一个走 materials review；薪资消息位于 Envelope 外；ATS action 的 key 固定为 `application:pursuit-direct:v1`；Bridge 有一次 disconnect／reconnect；Evidence 更新会改变 `contentHash`。

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
corepack pnpm --dir experiments/agent-harness test -- tests/contracts.test.ts
```

Expected: FAIL，因为 `contracts.ts` 和 `fixture.ts` 尚不存在。

- [ ] **Step 3: 定义共享接口**

`src/contracts.ts` 至少导出以下稳定接口：

```ts
export type CandidateId = 'langgraph' | 'mastra'

export interface HarnessEvent {
  sequence: number
  runId: string
  candidate: CandidateId
  pursuitId: string | null
  taskId: string
  type: 'node.started' | 'node.completed' | 'run.suspended' | 'run.resumed' |
    'effect.requested' | 'effect.reconciled' | 'bridge.disconnected' |
    'bridge.reconnected' | 'cache.hit' | 'cache.invalidated' | 'run.completed'
  occurredAt: string
  payload: Record<string, unknown>
}

export interface HarnessRunResult {
  runId: string
  status: 'suspended' | 'completed' | 'failed'
  suspendedReason?: 'salary_out_of_envelope' | 'bridge_disconnected'
  events: HarnessEvent[]
  domainSnapshotHash: string
}

export interface HarnessAdapter {
  readonly candidate: CandidateId
  start(runId: string): Promise<HarnessRunResult>
  resume(runId: string, input: { approved: boolean }): Promise<HarnessRunResult>
  recover(runId: string): Promise<HarnessRunResult>
  close(): Promise<void>
}
```

- [ ] **Step 4: 实现固定 fixture**

`src/fixture.ts` 导出 `createHarnessFixture()`，每次返回相同业务内容但接受调用方传入的 `runId`。两个 Pursuit ID 固定为 `pursuit-direct` 和 `pursuit-growth`，Task ID 分别为 `company-research`、`materials-review`、`salary-escalation`；不允许第三个 Pursuit。

- [ ] **Step 5: 运行契约测试**

Run:

```powershell
corepack pnpm --dir experiments/agent-harness test -- tests/contracts.test.ts
corepack pnpm --dir experiments/agent-harness typecheck
```

Expected: 测试与 typecheck 均 PASS。

---

### Task 3: 建立共享领域仓库、SideEffect Ledger、Bridge 和 cache simulator

**Files:**
- Create: `experiments/agent-harness/src/domain-store.ts`
- Create: `experiments/agent-harness/src/effect-ledger.ts`
- Create: `experiments/agent-harness/src/bridge-simulator.ts`
- Create: `experiments/agent-harness/src/context-cache.ts`
- Create: `experiments/agent-harness/tests/shared-adapters.test.ts`

**Interfaces:**
- Consumes: `HarnessFixture` 和固定 run／pursuit／task IDs。
- Produces: 两个候选完全共用的持久化、幂等、断连和失效行为。

- [ ] **Step 1: 写共享 adapter 失败测试**

测试必须断言：SQLite 关闭重开后能读取相同 run；同一 effect key 连续调用两次只增加一个 receipt；Bridge disconnect 后 effect 返回 `unknown` 且不发送；Evidence `contentHash` 变化后旧 cache entry 为 `invalidated`。

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
corepack pnpm --dir experiments/agent-harness test -- tests/shared-adapters.test.ts
```

Expected: FAIL，因为四个共享实现尚不存在。

- [ ] **Step 3: 实现 SQLite fixture repository**

`DomainStore` 只保存业务对象、领域版本、receipt 和有序事件。框架 checkpoint 不得写入这些表。至少建立 `domain_objects`、`effect_receipts`、`harness_events`、`cache_entries` 四张表，并提供 transaction、snapshot hash 与 close／reopen。

- [ ] **Step 4: 实现幂等 ledger**

`SideEffectLedgerStub.execute(key, requestHash)` 使用唯一索引约束 key；首次返回 `performed: true`，后续返回同一 receipt 且 `performed: false`。请求哈希冲突时 fail closed，不覆盖原 receipt。

- [ ] **Step 5: 实现 Bridge 和 cache simulator**

Bridge 只有 `online`／`offline` 两态，reconnect 不自动重发。Context cache key 必须包含 source ID、version、content hash、permission variant 和 schema version；任一字段变化产生 invalidation event。

- [ ] **Step 6: 运行共享测试**

Run:

```powershell
corepack pnpm --dir experiments/agent-harness test -- tests/shared-adapters.test.ts
```

Expected: PASS。

---

### Task 4: Mastra 候选实现与五小时门禁

**Files:**
- Create: `experiments/agent-harness/src/candidates/mastra-adapter.ts`
- Create: `experiments/agent-harness/tests/mastra.test.ts`
- Create: `experiments/agent-harness/results/mastra.json`

**Interfaces:**
- Consumes: `HarnessAdapter`、共享 adapters 和固定 fixture。
- Produces: Mastra 的运行、暂停、恢复、事件和工作量证据。

- [ ] **Step 1: 记录候选开始时间和包表面积**

`results/mastra.json` 记录开始时间、直接依赖数量、传递依赖数量、安装大小、需要的额外服务、官方文档 URL 和 package 版本。五小时计时从首次编写 adapter 开始。

- [ ] **Step 2: 写候选失败测试**

测试必须使用共享 fixture 断言：两个 Pursuit 有并发事件；薪资节点 suspend；进程级 adapter 关闭重建后用同一 run ID 恢复；同一 ATS key 仅一个 receipt；Bridge 离线不执行；Web 事件 sequence 严格递增。

- [ ] **Step 3: 运行测试确认失败**

Run:

```powershell
corepack pnpm --dir experiments/agent-harness test -- tests/mastra.test.ts
```

Expected: FAIL，因为 `MastraHarnessAdapter` 尚不存在。

- [ ] **Step 4: 用 Mastra 原生 workflow 实现 adapter**

只使用 Mastra workflow 的顺序、并行、suspend／resume、storage 和 stream／watch 能力。领域对象只通过 `DomainStore` ID 读取；workflow state 只保存 run ID、task ID、checkpoint payload 和引用版本。不得用自写状态机模拟 suspend／resume。

- [ ] **Step 5: 运行测试并应用硬门**

Run:

```powershell
corepack pnpm --dir experiments/agent-harness test -- tests/mastra.test.ts
corepack pnpm --dir experiments/agent-harness typecheck
```

Expected: 全部 PASS。若重启恢复、可靠暂停、自定义 storage／provider adapter、独立业务状态或许可证任一失败，立即将 `hardGate = "failed"` 写入结果并停止该候选。

- [ ] **Step 6: 记录五小时结果**

记录有效实现 LOC、adapter glue LOC、失败测试次数、首次 green 用时、文档阻塞、额外基础设施、开发者操作步骤和未解决风险。超过五小时仍未通过全部门禁，结果记为 timebox fail。

---

### Task 5: LangGraph.js 候选实现与五小时门禁

**Files:**
- Create: `experiments/agent-harness/src/candidates/langgraph-adapter.ts`
- Create: `experiments/agent-harness/tests/langgraph.test.ts`
- Create: `experiments/agent-harness/results/langgraph.json`

**Interfaces:**
- Consumes: 与 Mastra 完全相同的 `HarnessAdapter`、共享 adapters 和 fixture。
- Produces: LangGraph.js 的 checkpoint、interrupt、恢复、事件和工作量证据。

- [ ] **Step 1: 记录候选开始时间和包表面积**

使用与 Mastra 相同字段写入 `results/langgraph.json`，五小时计时从首次编写 adapter 开始。

- [ ] **Step 2: 写候选失败测试**

复制同一组行为断言，但不得复制 fixture 或共享 adapters。额外断言 interrupt 恢复导致节点重新进入时，interrupt 之前的 effect 请求仍由 ledger 去重。

- [ ] **Step 3: 运行测试确认失败**

Run:

```powershell
corepack pnpm --dir experiments/agent-harness test -- tests/langgraph.test.ts
```

Expected: FAIL，因为 `LangGraphHarnessAdapter` 尚不存在。

- [ ] **Step 4: 用 LangGraph 原生能力实现 adapter**

使用 `StateGraph`、持久 checkpointer、`interrupt()`、`Command({ resume })` 和原生 stream events。graph state 只保存 run／task／pursuit IDs、派生节点输出和业务对象版本引用；不得把 DomainStore snapshot 复制进 graph state。

- [ ] **Step 5: 运行测试并应用硬门**

Run:

```powershell
corepack pnpm --dir experiments/agent-harness test -- tests/langgraph.test.ts
corepack pnpm --dir experiments/agent-harness typecheck
```

Expected: 全部 PASS。hard gate 和五小时规则与 Mastra 完全相同。

- [ ] **Step 6: 记录五小时结果**

使用与 Mastra 完全相同的结果字段；额外记录 checkpointer 配置、thread ID 映射、interrupt 节点重入次数和因幂等增加的 glue LOC。

---

### Task 6: 故障注入、统一评分和选择

**Files:**
- Create: `experiments/agent-harness/tests/candidate-conformance.test.ts`
- Create: `experiments/agent-harness/src/score.ts`
- Create: `experiments/agent-harness/results/scorecard.json`

**Interfaces:**
- Consumes: 两个候选 adapter 和结果 JSON。
- Produces: hard-gate 结论、100 分评分和唯一 winner／平局结果。

- [ ] **Step 1: 写统一 conformance suite**

同一参数化测试分别传入两个 adapter factory，注入：公司研究与材料复核并发、薪资越界、进程关闭重建、ATS 双击、Bridge 断连、事件消费者重连、cache hit 与 Evidence hash invalidation。

- [ ] **Step 2: 运行完整故障测试**

Run:

```powershell
corepack pnpm --dir experiments/agent-harness test -- tests/candidate-conformance.test.ts
```

Expected: 通过 hard gate 的候选全部 PASS；被淘汰候选必须在结果中保留失败证据，不用补丁旁路。

- [ ] **Step 3: 实现固定评分器**

`score.ts` 读取两个结果并按下列权重计算：持久执行／恢复／并行 25，授权／副作用安全 20，TypeScript 与 API 集成 15，可替换性 15，流式事件与调度效率 10，可观测／评估／回放 10，许可证与部署复杂度 5。任一 hard gate 失败时总分为 `null`，不得参与比较。

- [ ] **Step 4: 加入时间与可用性决策规则**

两个候选均通过时，先按总分选高者；分差小于等于 3 分时，选择首次 green 用时更短且额外基础设施更少者；仍相同则选择业务模型与框架耦合更低者；仍无法区分时输出 `tie_requires_user_decision`，不得凭偏好决定。

- [ ] **Step 5: 生成 scorecard**

Run:

```powershell
corepack pnpm --dir experiments/agent-harness exec tsx src/score.ts
```

Expected: `results/scorecard.json` 包含每项原始指标、证据文件、hard gates、分数、tie breaker 和唯一结论。

---

### Task 7: ADR、治理更新与原型迁移边界

**Files:**
- Create: `docs/framework/ADR-001-agent-harness.md`
- Modify: `docs/framework/README.md`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: `scorecard.json` 和两个候选原始证据。
- Produces: 一个主 Agent Harness 选择，以及后续实施可用的清晰边界。

- [ ] **Step 1: 写 ADR**

ADR 必须包含：日期、固定版本、共同 fixture、hard-gate 结果、评分、时间预算、依赖／基础设施、winner、被拒原因、已知风险和回退。不得写“表现更好”而不引用结果文件中的具体指标。

- [ ] **Step 2: 明确框架与 beg 的所有权边界**

ADR 必须写明：winner 只拥有工作流 checkpoint、interrupt、节点调度和运行事件；`beg` 继续拥有领域模型、PromptContract、PersonaContract、DelegationEnvelope、SideEffectLedger、ContextPackage、缓存规则、connector 和 OutcomeOptimizer。框架 state 不得成为业务真值。

- [ ] **Step 3: 更新框架索引与 AGENTS 治理门**

只有 scorecard 有唯一 winner 且 ADR 引用完整时，才把框架协议状态改为 `Evaluated` 并更新 `AGENTS.md`。若为平局或无候选通过，协议保持 `In Review`，列出阻塞证据，不改业务代码。

- [ ] **Step 4: 完整验证**

Run:

```powershell
corepack pnpm --dir experiments/agent-harness verify
corepack pnpm verify
```

Expected: Spike 和冻结原型均通过 typecheck、test、build；如果根项目因既有问题失败，ADR 必须记录与当前变更的关系，不能宣称完成。

## Self-Review Result

- Spec coverage: 成熟 harness、时间、可用性、持久恢复、授权安全、TypeScript、Provider／storage 可替换、流式事件和单一主框架均有对应任务。
- Placeholder scan: 候选包、运行时与测试依赖均已写为精确版本；没有待填占位符或模糊实现步骤。
- Type consistency: 两个候选共享同一个 `HarnessAdapter`、`HarnessRunResult`、`HarnessEvent` 与 fixture，不存在候选专属业务接口。
