# 07｜创新层

> 状态：**Confirmed / 用户已确认**

`beg` 的主创新线是**在可理解、可控制的边界内提高 autonomous execution 与 efficiency**：把长周期求职工作拆成可追溯、可恢复、可授权的下一步，而不是让用户在无边界聊天中反复交代上下文。本册唯一拥有“创新层”组件的产品级目标、接口边界与衡量口径；领域对象／生命周期仍只由[02｜领域模型](./02-domain-model.md)拥有，PromptContract 只由[04](./04-agent-prompt-contracts.md)拥有，`DelegationEnvelope` 与 `AuditReceipt` 的权威定义只由[05](./05-delegation-connectors.md)拥有，检索与 cache 规则只由[06](./06-memory-retrieval-cache.md)拥有。

创新层是**未来主流框架之上的产品扩展**，不是自建通用 Agent orchestration framework：它不另造通用图执行器、模型抽象层或跨产品 runtime。未来只选择一个主工作流框架，并以标准 adapters 接入模型、工具、connector 和 observability；选择前的闸门见[框架评估协议](../framework/README.md)。

## 组件合同

每项组件都只能拥有其表中标出的派生计划、决策或 trace；不得拥有／改写领域对象真值、用户确认、授权本身或外部效果。指标用于后续比较和验收，不是当前性能宣称；“competition evidence”是赛事切片中应展示的可验证证据。

| 组件 | 目的 | 输入 | 输出 | 拥有／不拥有状态 | 可量化价值 | 失败 fallback | Competition evidence |
|---|---|---|---|---|---|---|---|
| `PursuitScheduler` | 在同一 Mission 的并发 Pursuit 中选出下一项合规、可做的工作，降低遗漏和等待。 | Mission／Pursuit／Task 状态、截止日、依赖、用户优先级、授权与 freshness 摘要。 | 带理由与版本的 `NextWorkPlan`、队列、阻塞提示。 | 拥有派生排程及其 trace；不拥有 Mission、Pursuit、Task 生命周期或优先级真值。 | 可执行 Task 覆盖率、逾期前完成率、等待时长、无饥饿率。 | 规则冲突或输入陈旧时退回稳定排序（用户优先级→截止日→创建时间）并请求确认。 | 两个并发 Pursuit 走不同路线，显示可复现队列及未被选中原因。 |
| `DelegationEnvelope` | 将已有效的授权包络作为排程、路由和执行前检查的不可扩张边界。 | 已编译 Envelope、动作 proposal、渠道 capability、实时 freshness、idempotency／receipt 摘要。 | allow／deny／takeover decision、最小执行包、审计关联。 | 本层只拥有 Envelope integration／compilation decision trace；Envelope、授权及其状态定义仍由[05](./05-delegation-connectors.md)拥有。 | 被拒绝的越界动作比例、执行前拦截率、无需人工重述的合规动作比例。 | 缺包络、过期、冲突或能力未知即 deny，并创建等待／接管 Task。 | 包络内低风险 HR 消息可放行；薪资等包络外话题被停止并交接。 |
| `SideEffectLedger` | 将一次外部动作从提议、尝试、观察到回执串成可去重的事实链。 | Action proposal、idempotency key、Envelope reference、connector 观察、`AuditReceipt`／错误。 | append-only `EffectTrace`、重复判断、恢复建议。 | 拥有派生 effect trace；不拥有 `DelegatedAction` 状态机、授权或 `AuditReceipt` 的权威内容。 | 重复外部动作数、状态不明恢复率、可关联回执比例。 | 找不到可信回执时仅令 `EffectTrace.observationStatus = unknown`／`reconciling`；`DelegatedAction` 保持 `executing`、停止重发，并创建 `waiting_for_user`／`blocked` 查询或接管 Task。只有权威回执可转 `succeeded`／`failed`；无法确定则继续人工 reconciliation。 | 演示双击提交或断连后重连只查询同一 key，不产生第二次提交。 |
| `CapabilityAwareConnectorPlanner` | 按平台能力与规则为目标动作选择官方 API、browser assist、Deep Link 或拒绝。 | 所需动作、Envelope、connector capability、平台规则、用户设备／Bridge 状态。 | `ConnectorPlan`、最小权限需求、takeover／prohibited reason。 | 拥有 connector 选择建议；不拥有 connector 权限、账户 session 或平台规则真值。 | 自动可完成动作比例、错误转接率、违规路径为零。 | capability 缺失、规则不明或 Bridge 不在线时使用 Deep Link／用户接管；禁止猜测替代路径。 | 同一申请分别显示官方／受控浏览器／Deep Link 三种正确分类。 |
| `AdaptiveContextCompiler` | 以最小而充分的上下文支持每个受控调用，减少重复叙述和隐私暴露。 | `PromptContract`、Task purpose、检索许可、对象版本、token budget、敏感度。 | [06](./06-memory-retrieval-cache.md)规定的 `ContextPackage`、omissions、retrieval trace。 | 拥有 package 编译选择；不拥有原始对象、记忆真值或权限规则。 | token 使用、被拒上下文比例、引用覆盖率、因缺上下文停止率。 | 无法在预算／权限内编译时只返回缺口与升级，不用模型猜测。 | 展示同一用户多 Pursuit 下只装入目标岗位的已授权引用与 omissions。 |
| `FreshnessAwareCache` | 加速可重算工作，同时使版本、授权、删除与外部新鲜度优先于命中率。 | cache key、source versions／hashes、TTL、revalidation policy、删除／撤销事件。 | hit／miss／stale／invalidated decision、重验请求与 trace。 | 拥有缓存条目和失效 trace；不拥有 source truth、授权或外部状态。 | 命中率、重验成功率、过期读取拦截率、删除传播时延。 | 版本未知、TTL 到期或失效事件缺失时按 miss 重算／重取；外部动作 fail closed。 | 岗位更新、Evidence 修订或隐私删除后显示 cache 被失效，陈旧值不能发消息。 |
| `ModelToolRouter` | 在固定 contract 内选择许可的模型协议与工具路径，保持结构化输出和可替换性。 | purpose、PromptContract、provider／tool capability、成本／时延预算、数据限制、健康状态。 | `RouteDecision`、执行计划、schema validation 与 fallback trace。 | 拥有路由 decision；不拥有业务决策、模型回复真值或工具权限。 | schema 通过率、降级成功率、单位有效产物成本／时延。 | 首选不可用或输出无效时选择已批准的兼容路径；无安全路径则停止并升级。 | 模型或工具故障时展示不越权的备用 route，产物仍有引用和 schema 结果。 |
| `ExecutionReplay` | 用不可变输入引用、决策和回执复盘一次运行，定位恢复点而非伪造历史。 | Task／ContextPackage／route／effect trace、规则版本、对象版本、redacted inputs、receipt references。 | `ReplayRecord`、差异报告、建议恢复点。 | 拥有 replay manifest；不拥有原始敏感内容、领域状态或重新执行许可。 | 可重放 trace 覆盖率、诊断时间、无法解释的状态转移数。 | trace 不完整时输出不可重放原因并拒绝自动重跑；仅允许从新授权的 Task 恢复。 | 展示 Bridge 断开后的重放：定位最后可靠观察，要求查询而非假定成功。 |
| `OutcomeOptimizer` | 将已确认 Outcome 与可追溯复盘转为后续 Mission／Growth 建议，不把相关性伪装成事实。 | confirmed Outcome、来源引用、Mission 约束、Pursuit 历史、用户反馈、偏差／样本量标记。 | `StrategyProposal`、改进假设、置信／局限、后续 Task 建议。 | 拥有建议与度量聚合；不拥有 Outcome 确认、用户偏好真值或自动执行权限。 | 已确认反馈覆盖率、建议采纳率、重复无效动作下降率。 | 样本少、来源冲突或隐私限制时只给描述性复盘／请求确认，不产生自动策略改变。 | 一次拒绝或无回复只生成带局限的复盘与可验证 Growth Task，不宣称因果或自动投递。 |

## 协作边界与演示原则

1. 组件可交换结构化 artifacts（`NextWorkPlan`、`ConnectorPlan`、`RouteDecision`、trace、`StrategyProposal`），但每个 Task 仍仅有一个 `responsibleActor`；它们不以共享全局 stage 覆盖并发 Pursuit。
2. 一切外部 effect 仍须由 `DelegatedAction`、有效 Envelope、idempotency 和 `AuditReceipt` 约束。创新层提高“何时提醒、何时查验、何时交接”的效率，不放宽任何规则。
3. 赛事展示必须把自主性落实为可观察的输入、决策、引用、回执与 fallback；不能以自动播放的聊天文本代替真实状态、验证或用户接管。
4. 本册不声称这些组件已经被某个框架实现、已经达到某项指标或已在真实招聘平台运行；这些都是 Future Spike／赛事验收事项。
