# Future framework evaluation protocol

> 状态：**Evaluated** — Spike 已完成，winner 已选出，见 [ADR-001](./ADR-001-agent-harness.md)

[Agent Harness 评估](../superpowers/plans/2026-08-25-agent-harness-evaluation.md) 已在 2026-08-25 完成。两个候选（`@mastra/core@1.61.0` Apache-2.0、`@langchain/langgraph@1.4.12` MIT）在同一业务 fixture、共享 adapters 和 16 工程小时 timebox 下通过了全部 hard gate。评分结果：Mastra 89/100，LangGraph.js 91/100；分差 2（≤3），按 tie breaker 规则选出 **LangGraph.js** 为 winner。完整评分见 `experiments/agent-harness/results/scorecard.json`，决策记录见 [ADR-001](./ADR-001-agent-harness.md)。

LangGraph.js 只拥有工作流 checkpoint、interrupt、节点调度和运行事件；beg 继续拥有领域模型、PromptContract、DelegationEnvelope、SideEffectLedger、ContextPackage、缓存规则、connector 和 OutcomeOptimizer。框架 state 不得成为业务真值。OpenAI Agents SDK JS 与 Vercel AI SDK 保持 comparison／adapter 角色。

后续实施须先取得用户的实施授权，才可迁移现有业务代码。Mastra 作为已验证备选（全部 hard gate 通过，89/100）保留在 ADR 回退路径中。

## 候选角色与官方资料

| 候选 | 本次角色 | 官方资料 | 本协议不作的当前断言 |
|---|---|---|---|
| LangGraph.js | main-workflow candidate。 | [LangGraph.js 官方概览](https://docs.langchain.com/oss/javascript/langgraph/overview) | 不断言当前版本、Node／TypeScript、persistence provider、部署或现有代码兼容。 |
| Mastra | main-workflow candidate。 | [Mastra 官方文档](https://mastra.ai/docs) | 不断言当前版本、model router、storage、workflow、部署或现有代码兼容。 |
| OpenAI Agents SDK JS | agent-runtime comparison，用来比较 agent／tool runtime 能力；不是第二个主工作流框架。 | [OpenAI Agents SDK JS 官方文档](https://openai.github.io/openai-agents-js/) | 不断言它可替代 durable orchestration，或与任何候选的当前兼容性。 |
| Vercel AI SDK | provider／tool abstraction comparison；**不是**独立的 durable orchestration 候选。 | [Vercel AI SDK 官方文档](https://ai-sdk.dev/docs/introduction) | 不断言其适合作为持久工作流主框架，或与候选的当前组合方式。 |

每一次获授权 Spike 必须将所有实际安装的 package、Node／TypeScript 版本、lockfile、adapter 版本和相关 capability 固定为精确版本（禁止 `latest`、范围版本或未记录的全局工具）。这些版本、官方资料与运行时兼容性均须在 Spike 当日重新核实；本 Draft 中的链接不是当前兼容性证明。

## 共同 Spike 场景

在 Frozen 后，对两个 main-workflow candidates 使用**同一份**受控 fixture、同一 Node／TypeScript 基线、同一 provider／tool adapters、同一观测字段和同一失败注入。Fixture 必须固化为**恰好两个独立的 `JobPursuit`**，并同时运行 company research 与 materials review；不得把并发改写成泛化示意、串行演示或第三个 Pursuit。最低场景是[赛事 Golden path](../product/08-contest-slice-acceptance.md)中从已确认资料／岗位到材料审查、申请动作 proposal、包络内 HR 路由、包络外 escalation 和 Outcome feedback 的一段闭环，并必须逐项覆盖：

1. 对每个 Task 进行 task-level `Memory` retrieval，使用版本化 `ContextPackage`、citations 和固定 token budget 组装结构化 Agent proposal；缺引用、过期、越权或 confirmation 不符应 fail closed。须在同一 fixture 记录一次 cache hit，并由 source version／content hash 改变触发 cache invalidation。
2. 两个独立 Pursuit 并行：一个执行 company research，另一个执行 materials review；二者各自保留 Mission／Pursuit／Task 边界，不能通过 chat history 或共享隐含上下文传递业务状态。
3. 在 HR 消息中注入包络外薪资问题，必须触发明确的 `interrupt`／用户接管；不得发送、不得以草案继续自动执行。
4. 将可恢复 Task 显式暂停于确定的 pause point，终止进程后重启；必须从该暂停点及最后可靠观察恢复，且不把状态不明写成成功。
5. 经受控 ATS adapter 执行 application submit：同一 idempotency key 的重试、重启后恢复或双击只产生**exactly-once** 投递，并以 receipt／ledger 证明。
6. 使 Local Execution Bridge 断线，再安全重连；重连前停止 effect，重连后重新验证页面／connector、Envelope 和 freshness，状态不明时升级而非重发。
7. 对每个 workflow node event 实时推送到 Web UI，使用 Web streaming／SSE 或等价的有序传输；验收记录必须显示事件顺序、关联 Task／Pursuit 和断线后的恢复／重连行为。
8. 导出可关联的领域版本、route、tool／model、retrieval、cache hit／invalidation、effect、replay 与 Web event trace，并测量同一 fixture 的结果。

不得在一个候选中以手工旁路、第二套 orchestration framework 或未声明 adapter 实现上述能力；否则该候选的该项证据无效。

## 评分（总分 100）

只在全部 hard gates 通过后评分。每个维度以同一 fixture 的可运行、可导出证据计分；文档宣传、代码阅读、类比或 vendor 承诺不计分。

| 权重 | 维度 | 评分证据 |
|---:|---|---|
| 25 | Durable execution、restart recovery 与 idempotent side-effect recovery | 中断、重启、Bridge 断开／重连、receipt 查询的 trace 与结果。 |
| 20 | State／authorization governance 与审计可追溯性 | 版本、Envelope、单 owner、确认状态、effect／replay trace 的可检查关联。 |
| 15 | Human-in-the-loop、takeover 与 escalation | 包络外和高影响场景的停止、最小交接和恢复。 |
| 15 | TypeScript-first 开发体验与结构化 Agent／tool contract fit | 类型边界、schema validation、测试 fixture 与稳定的 adapter 边界。 |
| 10 | 观测、调试、replay 与评估可操作性 | redacted trace、差异定位、指标和可复现导出。 |
| 10 | provider／tool／connector adapter 边界与可替换性 | 一个主框架下的标准 adapters、故障降级与无框架泄漏的业务 contract。 |
| 5 | 最小运行与维护负担 | 精确依赖面、启动／测试步骤、升级风险和文档化运维成本。 |

## Hard elimination gates

固定版本、干净环境、lockfile 和可归档运行记录是每次 Spike 的**测试前提**，不是额外的产品 hard gate。满足前提后，任一候选出现以下任一情况即淘汰，不计算总分；“以后可以补”不是通过：

1. **Restart**：不能在进程重启后可靠恢复同一工作，或不能保留最后可靠观察并避免把状态不明外部效果当成功。
2. **Pause／interrupt**：不能可靠暂停、打断和恢复长运行工作，而导致在用户接管、授权撤销或 Bridge 断开后继续执行。
3. **Business state**：要求把 `beg` 的业务状态放在 chat history 中，而不能以独立、版本化的领域对象和 adapters 保存／读取。
4. **Custom Provider／storage**：不能接入自定义 Provider 或 storage，以满足三种模型协议和可替换、受控的数据持久化边界。
5. **License**：其许可证与赛事使用及后续产品使用不兼容。

即使通过上述 gate，Spike 仍必须用共同场景验证授权、trace、contract、cache 与单一主框架边界；这些是加权评分证据，不能被第二个 orchestration framework 旁路。Agents SDK JS、Vercel AI SDK 和 connector 只能处于所列的 comparison／adapter 角色。

## 决策规则

先淘汰未过 gate 的候选，再按 100 分加权总分选出**一个** main framework；其他能力只能作为标准 adapters，不得并列运行多个 orchestration frameworks。

若总分相同，先选择所需基础设施组件较少的候选；仍相同，再选择 `beg` 业务模型与框架耦合更低的候选。两项仍无法区分时，记录为平局并由用户明确裁决，**不**以直觉选型。

决策记录必须附各项原始证据、固定版本、评分、gate 结果、偏差和被拒候选的原因。Spike 已完成；决策记录见 [ADR-001](./ADR-001-agent-harness.md)，评分见 `experiments/agent-harness/results/scorecard.json`。后续实施须先取得用户的实施授权，才可迁移现有业务代码。当前 winner：**LangGraph.js**（`@langchain/langgraph@1.4.12`，MIT）。
