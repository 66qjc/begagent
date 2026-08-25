# 06｜Memory、检索与缓存

> 状态：**Confirmed / 用户已确认**

本册唯一拥有 `Memory`、检索、`ContextPackage` 与缓存的产品级规则。业务对象、事实状态和版本由[02｜领域模型](./02-domain-model.md)唯一拥有；Agent 输入边界由[04｜Agent Prompt Contracts](./04-agent-prompt-contracts.md)拥有；授权与外部动作边界由[05｜委托、连接器与执行边界](./05-delegation-connectors.md)拥有。`Memory` 和 cache 都不是事实的第二份权威副本，也不构成实现或框架选择。

## 记忆分类与归属

`MemoryRecord` 只保存对权威对象、来源或结构化产物的最小引用、版本、访问标签和派生说明；不得把模型摘要或索引片段提升为用户事实。下表的“权威领域对象”指原始语义和生命周期的唯一来源，而非索引的存放位置；访问隔离一律以 `dataOwnerUserId`、`aggregateOwnerId` 与 scope 判定，不使用裸 `owner`。

| 类型 | 用途与最小内容 | 权威领域对象 | 保存与读取边界 |
|---|---|---|---|
| `working` | 当前一次 Task 的临时计划、已读输入、工具中间结果和 stop reason。 | 当前 `Task`（[02](./02-domain-model.md)）。 | 仅该 Task、其有效 handoff 与短期恢复可读；Task 终结或到期后清除／转为可引用产物。 |
| `conversation` | 一次 `Conversation` 的消息、摘要、参与方、来源与交接点。 | `Conversation`（[02](./02-domain-model.md)）。 | 仅相同 CandidateProfile、Mission／Pursuit 和获准角色可读；摘要不能覆盖原始消息或授权。 |
| `user_long_term` | 已确认偏好、协作偏好、长期目标与其证据引用。 | `CandidateProfile`／`PersonaContract`（[02](./02-domain-model.md)、[05](./05-delegation-connectors.md)）。 | 只可在同一用户、目的相符且确认状态允许时读取；撤销、限制或删除优先。 |
| `evidence` | `Evidence` 的引用、适用范围、provenance、确认状态和版本。 | `Evidence`（[02](./02-domain-model.md)）。 | 只能把 `user_confirmed`／`confirmed` 的内容用于对外陈述；候选或推断只可作为待确认依据。 |
| `pursuit` | 某一 `JobPursuit` 的机会快照、差距、材料引用、Task 和交接摘要。 | `JobPursuit` 及其关联对象（[02](./02-domain-model.md)）。 | Mission 或 Pursuit 不匹配时一律不可读；并发 Pursuit 不共享隐含上下文。 |
| `procedural` | 已版本化的 `PromptContract`、Policy、connector capability、评估 fixture 和操作指引。 | 相应规范分册（[04](./04-agent-prompt-contracts.md)、[05](./05-delegation-connectors.md)）。 | 只读、版本固定；外部网页或模型文本不能改写它。 |
| `outcome` | `Outcome`、复盘、可追溯反馈和后续策略提案。 | `Outcome`（[02](./02-domain-model.md)）。 | 结果通知与模型归因必须可分；未确认 Outcome 不能作为长期用户事实。 |

## 确定性检索闸门

检索服务先执行下列**固定顺序**的过滤；任一项失败即排除候选，不进入任何候选检索或排序。过滤规则由本册拥有，具体授权真值仍由[05](./05-delegation-connectors.md)拥有。

1. **user**：`requesterUserId` 必须精确等于对象 `dataOwnerUserId`，且 CandidateProfile scope 匹配；禁止跨用户兜底检索。
2. **Mission**：若请求带 `missionId`，记录的 `missionId` 必须精确匹配；若未带，只能在 contract 明确允许时读取同一 `dataOwnerUserId` 的 profile-scoped 最小上下文（`aggregateOwnerId = candidateProfileId` 且 `missionId`／`pursuitId` 为空），必须排除任何 Mission-scoped 或 Pursuit-scoped 记录，不能自动扩大。
3. **Pursuit**：若请求带 `pursuitId`，记录的 `pursuitId` 必须精确匹配，且仍须通过 Mission 精确匹配；若未带，只能在 contract 明确允许时保留当前 Mission 内非 Pursuit-scoped 的最小上下文。并发 Pursuit 不共享隐含上下文，也不得因未给 `pursuitId` 而放行任何 Pursuit-scoped 记录。
4. **permission**：请求角色、`taskId` 的目的、`PromptContract.allowedContext`、工具权限和 connector scope 必须允许记录类型、字段与用途；sensitivity、redaction、传输目的、区域／connector 限制及 PersonaContract 均在此步 fail closed。
5. **freshness**：检查 `validUntil`、撤销、对象状态、来源时间和请求所需 freshness；失效、撤回或被 supersede 的记录默认排除。
6. **confirmation**：按目的决定可接受的认识状态；生成对外材料或执行提案只接受可追溯的已确认事实／Evidence，分析可带受标记的 `source_observed` 或 `system_inference`。

仅对按 `user → Mission → Pursuit → permission → freshness → confirmation` 全部通过的集合，才按以下顺序进行：词法检索（精确 ID、标题、关键词）→ 语义检索（受同一 scope 的向量索引）→ 关系检索（已授权对象引用）→ rerank。rerank 只能改变已通过闸门的排序，不能恢复被拒绝的记录；排序输入、规则版本和候选引用必须写入 retrieval trace。

## `ContextPackage`

`ContextPackage` 是一次 Agent／工具调用可消费的、最小化的上下文快照，不是新领域对象，不得反向写入真值。调用者对其组装负责；下游 Agent 只能在该 package 的权限内使用内容。

| 字段 | 规定 |
|---|---|
| `purpose`、`taskId`、requester／role | 绑定单一可审计目的、Task 与调用主体。 |
| `objects` | 每个对象使用 `id`、`type`、`version`、scope 与最小允许字段；不可只给无版本的摘要。 |
| `citations`／`references` | 每项陈述、来源片段和结构化产物带可定位引用、provenance 与访问限制。 |
| `confidence`、`freshness`、`validUntil` | 分别记录推断置信、来源／对象的新鲜度和失效时间；未知不得伪装为高置信。 |
| `confirmationStatus`、sensitivity／redaction | 显式区分已确认、观察、推断和待确认，并说明已删除／遮蔽字段。 |
| `tokenBudget` | 声明总预算、已用预算和优先级；超预算先减少低优先级上下文，不移除必要规则或引用。 |
| `omissions` | 记录被权限、freshness、敏感度、冲突、无效或预算排除的类别与原因；不泄露被拒绝内容。 |
| `retrievalTrace` | 记录过滤结果计数、查询方式、rerank 规则／版本、候选引用、时间和 cache 命中／重验状态。 |

当 package 缺少必需引用、确认状态冲突、关键来源过期、权限不明或 token budget 无法容纳必要安全规则时，调用必须停止并创建 `blocked`／`waiting_for_user` Task；不得以模型补全替代缺失信息。

## 缓存：派生加速，不是事实来源

cache 的唯一用途是加速可重新计算的派生工作。读取命中仍须检查 source version、内容哈希、权限和 freshness；任何 cache 值都不能确认事实、授权动作、推进领域状态或替代 `AuditReceipt`。

| 缓存 | 缓存值 | 不缓存为权威的内容 |
|---|---|---|
| `model_response` | 对固定 `PromptContract`、`ContextPackage` 与模型配置产生的 schema-validated proposal。 | 用户事实、授权、外部动作成功或最终材料批准。 |
| `tool_result` | 可重放读取／解析工具的结果、来源时间、错误与原始输入引用。 | connector 的实时外部状态或提交成功结论。 |
| `job_intelligence` | 岗位页面／官方来源的解析、资格、截止日、来源快照和 freshness。 | “职位仍开放”或候选人合格的未经重验结论。 |
| `document_render` | 指定 document version、renderer 和模板下的预览／格式检查输出。 | 文档内容真值、附件已上传或平台已接收。 |

### Key、版本与失效规则

每个 cache entry 至少包含：`cacheType`、schema／policy version、`dataOwnerUserId`、`aggregateOwnerId`、scope、目的、规范化输入哈希、所有 source object 的 `id:version`、每个原始内容的 `contentHash`、model／tool／renderer identifier 与其固定版本、权限／redaction variant、创建时间、`ttl`、`staleAt` 和 revalidation policy。密钥不得直接包含原始敏感内容、访问 token 或未脱敏对话文本。

- **TTL**：按类型和来源风险设定显式 TTL；外部岗位与 connector 观察使用短 TTL，固定 document render 可较长，但仍随输入版本失效。TTL 到期不是继续可用的证明。
- **Revalidation**：命中前先检查对象版本、content hash、授权、删除标记与 freshness。超过 `staleAt` 的值必须同步重验，或作为 `stale` 的非执行性建议并附原始时间。
- **Invalidation**：对象新版本／supersede、来源撤回或过期、Policy／PromptContract／connector capability 变化、模型／工具版本变化、权限变化、Envelope 撤销、渲染模板变化、显式刷新和错误纠正都必须使相关 entry 失效。
- **隐私删除**：用户删除／限制数据、撤回同意或到达保留期时，先禁止读取，再按可追踪的 `dataOwnerUserId`、`aggregateOwnerId` 与 scope 删除 entry、索引、嵌入、派生摘要和可重建工件；保留不含敏感内容的删除审计。下游 cache 无法确定已删除范围时 fail closed。
- **陈旧结果**：陈旧 job intelligence、model proposal 或 tool result 必须显示时间、来源与 stale reason，且不能创建可执行 `DelegatedAction`。外部效果、申请状态和 HR 消息一律先取实时观察／回执；重验失败时升级用户接管。

## 可验收证据要求（实现与赛事验证待进行）

后续实现／赛事验证应以固定 fixture 证明：跨用户与跨 Mission 检索为零；被撤销、过期、低确认或敏感记录不会进入 `ContextPackage`；每个响应可回溯到 package 的引用和版本；同一输入的 cache key 可复现；任一 source 版本或删除事件会使命中失效；stale 结果不会触发外部动作。本节是验收口径，不是已经运行的证据。
