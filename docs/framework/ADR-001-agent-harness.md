# ADR-001: Agent Harness 框架选择 — LangGraph.js

> 状态：**Accepted**
> 日期：2026-08-25
> 评估协议：[Future framework evaluation protocol](./README.md)
> 实施计划：[Agent Harness Evaluation Implementation Plan](../superpowers/plans/2026-08-25-agent-harness-evaluation.md)

## 背景

beg 需要一个成熟的 TypeScript Agent Harness / durable workflow 主框架，不再自研通用编排器。通过真实 Spike 在同一业务 fixture 上验证 Mastra 与 LangGraph.js，选出唯一主框架。OpenAI Agents SDK JS 和 Vercel AI SDK 仅作为 model/tool adapter 参考，不作为第二套编排系统。

## 固定版本

| 候选 | 版本 | 许可证 | Node engines |
|---|---|---|---|
| `@langchain/langgraph` | 1.4.12 | MIT | `>=18` |
| `@mastra/core` | 1.61.0 | Apache-2.0 | `>=22.13.0` |

运行环境：Node v24.14.1、pnpm 10.28.1、TypeScript 5.9.2、Vitest 3.2.4。

## 共同 fixture

两个候选使用完全相同的 fixture、共享 adapters 和 7 个验证场景：

1. 同时推进两个 `JobPursuit`（`pursuit-direct` 做 company research，`pursuit-growth` 做 materials review）
2. 并行执行 company research 和 materials review
3. 薪资越界时 `interrupt`/`suspend` 并请求用户接管
4. 杀掉进程（close adapter）后用同一 run ID 恢复
5. ATS 投递严格幂等（`application:pursuit-direct:v1`，exactly-once receipt）
6. 本地执行 Bridge 断线后安全重连（不自动重发）
7. 缓存命中、失效及有序事件推送

## Hard gate 结果

| Gate | Mastra | LangGraph.js |
|---|---|---|
| Restart recovery | Passed — `SqliteWorkflowsStorage` 持久化 snapshot | Passed — `SqliteCheckpointSaver` 持久化 checkpoint |
| Pause / interrupt | Passed — `suspend()` + `run.resume()` | Passed — `interrupt()` + `Command({ resume })` |
| Business state | Passed — `DomainStore` 持有领域对象 | Passed — `DomainStore` 持有领域对象 |
| Custom storage | Passed — 自定义 `WorkflowsStorage`（8 方法） | Passed — 自定义 `BaseCheckpointSaver`（5 方法） |
| License | Passed — Apache-2.0 | Passed — MIT |

## 评分（总分 100）

| 维度 | 权重 | Mastra | LangGraph.js |
|---|---:|---:|---:|
| Durable execution、restart recovery、idempotent side-effect | 25 | 24 | 24 |
| State/authorization governance 与审计可追溯 | 20 | 19 | 19 |
| Human-in-the-loop、takeover、escalation | 15 | 15 | 15 |
| TypeScript-first DX 与结构化 contract fit | 15 | 10 | 10 |
| 观测、调试、replay 与评估可操作性 | 10 | 9 | 9 |
| Provider/tool/connector adapter 边界与可替换性 | 10 | 9 | 9 |
| 最小运行与维护负担 | 5 | 3 | 5 |
| **总分** | **100** | **89** | **91** |

## 决策规则

分差 = 2（≤3），触发 tie breaker：
- 首次 green 用时：LangGraph 26 分钟 < Mastra 27 分钟
- 直接依赖数：LangGraph 4 < Mastra 32
- Glue LOC：LangGraph 151 > Mastra 129（此维度 Mastra 更优，但前两项已决出）

**Winner：LangGraph.js。**

## 证据文件

| 文件 | 内容 |
|---|---|
| `experiments/agent-harness/results/environment.json` | 环境、版本、隔离性记录 |
| `experiments/agent-harness/results/mastra.json` | Mastra 候选结果、hard gate、LOC、时间 |
| `experiments/agent-harness/results/langgraph.json` | LangGraph 候选结果、hard gate、LOC、时间 |
| `experiments/agent-harness/results/scorecard.json` | 统一评分、tie breaker、结论 |
| `experiments/agent-harness/tests/candidate-conformance.test.ts` | 参数化 conformance suite（16 测试 × 2 候选） |

## 被拒原因 — Mastra

Mastra 在所有 hard gate 上均通过，但在以下维度弱于 LangGraph.js：

1. **直接依赖数**（32 vs 4）：`@mastra/core` 携带大量传递依赖（memory、vector、evals、deployer 等），对 beg 只需要 durable workflow 的场景而言基础设施更重。
2. **自定义 storage 复杂度**：Mastra 的 `WorkflowsStorage` 有 8 个抽象方法且需要理解 composite store 注入机制（`InMemoryStore.stores.workflows` 替换）；LangGraph 的 `BaseCheckpointSaver` 有 5 个抽象方法且直接注入 compile。
3. **首次 green 用时**：Mastra 27 分钟，LangGraph 26 分钟（差异微小但 tie breaker 规则按此决出）。

Mastra 的优势在于 workflow builder DSL（`.parallel().then()`）更直觉、`stateSchema` 在 step 间共享状态更自然、stream 事件类型更丰富。

## 框架与 beg 的所有权边界

LangGraph.js 只拥有：
- 工作流 checkpoint 持久化与恢复
- `interrupt()` / `Command({ resume })` 暂停恢复机制
- `StateGraph` 节点调度与并行执行
- `stream()` / `streamEvents()` 运行时事件推送

beg 继续拥有：
- 领域模型（`CandidateProfile`、`CareerMission`、`JobPursuit`、`Task`、`DelegatedAction` 等）
- `PromptContract`、`PersonaContract`、`DelegationEnvelope`
- `SideEffectLedger` 与 idempotency 规则
- `ContextPackage` 与缓存规则
- connector 与 `OutcomeOptimizer`
- `DomainStore` 作为唯一业务真值源

框架 graph state 不得成为业务真值。graph state 只保存 run ID、task ID、pursuit ID 和派生节点输出引用；领域对象必须从 `DomainStore` 读取。

## 已知风险

1. LangGraph `graph.stream()` 返回 `Promise<IterableReadableStream>`，需先 `await` 再 `for await`。
2. 对已完成的 graph 执行 `Command({ resume })` 会重新进入节点；需通过事件历史检查确保 effect 幂等。
3. `@langchain/core` 作为 devDependency 提供 `RunnableConfig` 类型。

## 回退

若 LangGraph.js 在后续实施中任一关键项失败，按协议回退顺序：
1. 切回当前冻结的 `DeterministicCareerRuntime` 原型，产品状态不受影响。
2. 如需真实模型，选 Chat Completions / Responses / Anthropic Messages，实现统一在 `CareerRuntimePort` 后。
3. Mastra 作为已验证的备选（89/100，全部 hard gate 通过），可在后续 ADR 中升级为主框架。
