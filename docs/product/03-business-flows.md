# 03｜业务流程

> 状态：**Confirmed / 用户已确认**

本册定义 `beg` 从任意入口到结果反馈的业务流。对象、归属、状态机和不变量只由[02｜领域模型](./02-domain-model.md)拥有；本册仅引用它们，不重写状态表。本册不选择框架，也不构成实现授权。

## 流程阅读规则

- 每个流都以一个 `Task` 组织工作；同一时刻只有一个 `Task.responsibleActor`。Agent 或人工协作者只能交付结构化产物或显式 handoff，不能同时成为同一 Task 的共同主责。
- `CareerMission` 是职业目标容器，不是所有岗位进度的单一全局阶段。一个 Mission 可有多个并发 `JobPursuit`；每个 Pursuit、`Application`、`Conversation` 与 `DelegatedAction` 依各自状态机推进。**禁止用一个全局 Mission stage 表示所有岗位已投递、面试中或结束。**
- 外部动作只能以可审计的 `DelegatedAction` 表达，并须遵守[05｜委托、连接器与执行边界](./05-delegation-connectors.md)的 `DelegationEnvelope`。无有效授权、来源、时效或幂等标识时，`DelegatedAction` 只能保持在其自身合法的 `drafted` 或 `pending_authorization` 状态，或依其状态机记录为 `failed`、`revoked`／`expired`；不得把 `blocked` 或 `waiting_for_user` 赋给它。
- 已进入 `executing` 的 `DelegatedAction` 若外部结果不明，必须保持 `executing`；仅 `EffectTrace.observationStatus = unknown | reconciling` 与分离的查询／接管 Task 表达不确定性。只有权威回执可转 `succeeded`／`failed`；不得以 `revoked` 假称已执行效果被回滚，亦不得盲目重发。
- 需要等待资料、规则、授权或用户决定时，创建或更新一个与该动作分离的单主责 `Task`，由该 `Task` 依[02](./02-domain-model.md)进入 `blocked` 或 `waiting_for_user`；恢复后再依法创建或推进动作。
- 建档、四类首入口与 re-entry review 的 Task 是 profile-scoped（`aggregateOwnerId = candidateProfileId`，`missionId`／`pursuitId` 为空）。工作进入 Mission 范围时，必须按[02](./02-domain-model.md)formal handoff 或创建带 provenance 的 Mission-scoped Task；不得静默改写原 Task 的聚合归属，原 Task 仅依自身状态机完成或取消。
- “终态”是业务终点，不是删除历史。再次尝试须创建新版本、新 Task 或新 Pursuit，并保留 provenance。

## 四条渐进入口

| 入口 | 最小输入 | 首个可交付产物 | 渐进补齐 | 不能自动假定 |
|---|---|---|---|---|
| 简历／材料导入 | 简历、作品、成绩单或经历片段 | `Evidence` 候选、`CandidateProfile` 草案 | 逐项要求来源、适用范围与用户确认 | 导入文本是已确认事实，或其量化成果真实。 |
| 岗位 URL／文本 | URL、JD 文本或公告截图的可读内容 | `Opportunity` 观察记录、JD 解析提案 | 补齐官方来源、发布日期、截止日、地点与资格条件 | 岗位仍开放、来源官方或用户符合条件。 |
| 职业兴趣 | 方向、行业、约束或目标公司 | `CareerMission` 草案、探索问题 | 形成偏好、可用 Evidence 与机会检索范围 | 兴趣等于能力、承诺或可直接投递岗位。 |
| 空白对话 | 一句目标或“我不知道从哪里开始” | 澄清 Task、最小 `CandidateProfile` 草案 | 仅在当前任务需要时询问资料、机会或授权 | 对话推断可写入用户事实或替用户选择目标。 |

四个入口都先生成可审阅的草案和 profile-scoped Task；用户确认后才可把事实转为 `user_confirmed`，并可在同一 `CandidateProfile` 下创建或继续多个 Mission。创建 Mission 后以 formal handoff 或带 provenance 的新 Mission-scoped Task 继续，不能原地改写入口 Task 的聚合归属。

### Downstream resume／re-entry（不是第五、六入口）

将来导入既有 `Application` 或 `Conversation` 时，它们只能作为四类入口建档后的 downstream resume／re-entry：先归一化为所需的 CandidateProfile、Opportunity／JobPursuit、材料或职业兴趣对象，再审阅；不能把“已有申请／对话”宣称为新的首入口，也不能直接恢复自动执行。

| 项目 | 规则 |
|---|---|
| `Task.responsibleActor` | `ApplicationAgent` 负责归一化审阅；外部动作的 `accountableActor`／`effectExecutor` 仅在另建 DelegatedAction 后确定。 |
| 输入与校验 | 导入记录、`provenance`、当前状态、参与方／渠道、CandidateProfile 归属及现有授权；缺任一项即不推断。 |
| 输出与初始状态 | 生成映射草案、来源快照和一个 profile-scoped review `Task`（`aggregateOwnerId = candidateProfileId`，`missionId`／`pursuitId` 为空）；Task 初始为 `blocked` 或 `waiting_for_user`，既有 Application／Conversation 只在能证实时按[02](./02-domain-model.md)状态机表示。 |
| 进入 Mission | 审阅形成 Mission 后，由 formal handoff 或带原 Task／输入版本／scope 决策 provenance 的新 Mission-scoped Task 接续；原 review Task 只完成或取消，不能原地变更聚合归属。 |
| 授权与恢复 | 校验 `dataOwnerUserId`、有效 PersonaContract／Envelope、时效、幂等与既有回执；状态不明仅创建有界查询／takeover Task。审阅、授权和权威回执齐备前不得进入执行。 |

## 全链路与并发编排

`profile → mission → opportunity intelligence → pursuit → deep evaluation → direct/growth route → materials → application → HR/interview → outcome → strategy feedback`

这是一条可回路，不是一条强制线性漏斗。每个已评估的 Opportunity 创建或关联一个 `JobPursuit`；Pursuit 可独立走“直接申请”或“成长追求”路线，也可暂停、关闭或放弃而不改写 Mission 的其他 Pursuit。策略反馈可调优 Mission 的目标、偏好和后续检索，但不能回写已经确认的 Evidence 或历史 Outcome。

## 流程规范

### 1. 简历、CandidateProfile 与 Evidence

| 字段 | 规定 |
|---|---|
| 触发 | 用户导入材料、补充一段经历，或在其他流程中发现证据缺口。 |
| Task.responsibleActor | `ProfileAgent`；`EvidenceVerifier`、`DocumentVerifier` 仅提供提案。 |
| 输入 | 原始材料、用户解释、已有 `CandidateProfile`／`Evidence`、来源与版本。 |
| 输出产物 | `Evidence` 候选及 provenance、待确认事实提案、`ResumeArtifact` 草案或修订建议。 |
| 状态变化 | Evidence 按[02](./02-domain-model.md)从 `captured` 到 `pending_confirmation`；确认后才为 `confirmed`。ResumeArtifact 可进入 `in_review`，不能直接 `approved`。 |
| 外部效果 | 无；本流只处理用户提供或已授权读取的材料。 |
| 中断／恢复 | 缺字段、冲突、低置信或无法读档时 Task 置 `waiting_for_user`／`blocked`，保存解析提案；补充资料后以新版本重跑，不覆盖原件。 |
| 终端结果 | 已确认的可引用 Evidence、待用户确认的草案，或标为 `rejected`／`archived` 的材料；不产生虚构经历。 |

### 2. 机会情报

| 字段 | 规定 |
|---|---|
| 触发 | 用户粘贴岗位、订阅 Mission 机会范围，或从材料流选择目标。 |
| Task.responsibleActor | `OpportunityAgent`；`Researcher`、`JDAnalyst` 提供结构化来源与解析提案。 |
| 输入 | URL／JD、Mission 约束、已授权来源、来源快照、时效和检索范围。 |
| 输出产物 | `Opportunity`、来源引用、JD 结构化提案、资格／风险／新鲜度说明、比较清单。 |
| 状态变化 | Opportunity 由 `discovered` 进入 `unverified` 或 `qualified`；过期或撤回走 `expired`／`withdrawn`，不回退。合格机会可创建独立 Pursuit。 |
| 外部效果 | 仅在允许的连接器内读取公开或已授权信息；不得发布、联系或提交。 |
| 中断／恢复 | 来源不完整、岗位未验证、连接器离线或信息冲突时保留 snapshot 并阻塞深评；恢复连接后重新取证，确认 freshness 后才继续。 |
| 终端结果 | 可评估的 `qualified` Opportunity，或保留理由的 `unverified`、`expired`、`withdrawn`／`archived` 记录。 |

### 3. 直接申请路线

| 字段 | 规定 |
|---|---|
| 触发 | 用户为合格 Opportunity 选择“直接申请”，且无需先完成 GrowthPlan。 |
| Task.responsibleActor | `ApplicationAgent`；`ResumeDrafter`、`Reviewer`、`PolicyGuard` 输出建议与审查结论。 |
| 输入 | 一个 `JobPursuit`、Opportunity/JD 版本、`user_confirmed` Evidence、材料偏好、渠道限制。 |
| 输出产物 | 匹配解释、差距／风险清单、岗位定制 `ResumeArtifact` 草案、`Application` 准备包。 |
| 状态变化 | Pursuit 保持独立 `active`；Application 从 `draft` 到 `prepared`，等待授权时为 `pending_authorization`。 |
| 外部效果 | 无提交；可生成本地材料。任何对外填表或发送转入“申请执行流程”。 |
| 中断／恢复 | 关键资格不明、材料缺证据、岗位过期或用户暂停时 Task `waiting_for_user`／`blocked`，Pursuit 可单独 `paused`；补证据或新 JD 版本后创建修订包。 |
| 终端结果 | 可授权的 Application 准备包、转入成长路线的差距说明，或关闭／放弃该 Pursuit。 |

### 4. 成长追求路线

| 字段 | 规定 |
|---|---|
| 触发 | 深评发现真实差距、用户选择先成长，或 Opportunity 暂未开放但方向仍有效。 |
| Task.responsibleActor | `GrowthAgent`；`Researcher`、`EvidenceVerifier`、`Reviewer` 提供任务与验证提案。 |
| 输入 | Mission、关联 Pursuit／Opportunity、已确认 Evidence、差距说明、用户时间与隐私边界。 |
| 输出产物 | `GrowthPlan`、可验证行动 Task、预期 Evidence 标准、复盘提案。 |
| 状态变化 | GrowthPlan 依[02](./02-domain-model.md)从 `draft` 至 `active`／`paused`／终态；关联 Pursuit 不因计划完成而自动申请。 |
| 外部效果 | 可做内部规划和本地提醒；报名、公开发布、付费、提交作业等外部承诺须另建 DelegatedAction。 |
| 中断／恢复 | 用户暂停、计划失配、机会过期或所需连接器离线时暂停计划并保留进度；用新 Evidence 或新机会创建后续 Task。 |
| 终端结果 | 形成 `confirmed` 新 Evidence、完成／放弃的 GrowthPlan，或带理由转回直接申请／关闭 Pursuit。 |

### 5. 申请执行

| 字段 | 规定 |
|---|---|
| 触发 | 用户审阅 Application 准备包并请求填表或提交。 |
| Task.responsibleActor；外部侧 | `ApplicationAgent`；真正外部执行的 `accountableActor` 与 `effectExecutor` 由[05](./05-delegation-connectors.md)动作注册表确定。 |
| 输入 | `Application`、审批材料版本、目标岗位快照、`DelegationEnvelope`、授权、`idempotencyKey`。 |
| 输出产物 | `DelegatedAction`、表单映射提案、提交前差异清单、`AuditReceipt` 或失败回执。 |
| 状态变化 | Application 只在有效授权且收到成功回执后从 `pending_authorization` 进 `submitted`；失败维持可恢复状态，不伪造提交成功。 |
| 外部效果 | 允许的填表、附件上传与提交严格在授权包络内执行；最终提交若要求接管则仅生成 Deep Link／交接包。 |
| 中断／恢复 | 重复或重试使用同一 idempotency key 查询既有回执；结果不明时 action 保持 `executing`，以 `EffectTrace.observationStatus = unknown`／`reconciling` 和独立 Task 查询或交接。仅权威回执可定成功／失败；提交失败、陈旧页面、表单变更、离线或平台限制时停止并交给用户，修复后才创建明确重试。 |
| 终端结果 | 可核验的提交回执、用户接管完成、撤回的申请，或记录失败原因的未提交 Application。 |

### 6. 委托 HR 沟通

| 字段 | 规定 |
|---|---|
| 触发 | 收到 HR 消息、用户起草沟通目标，且当前 `Conversation` 与授权仍有效。 |
| Task.responsibleActor；外部侧 | `ApplicationAgent` 管理 Task；`PolicyGuard` 审查边界；`accountableActor`／`effectExecutor` 由[05](./05-delegation-connectors.md)动作注册表确定。 |
| 输入 | Conversation 上下文、用户确认事实、消息来源、`DelegationEnvelope` 的话题／渠道／承诺边界、历史回执。 |
| 输出产物 | 回复提案、风险分类、`DelegatedAction`、消息发送或交接 `AuditReceipt`、Conversation 摘要。 |
| 状态变化 | Conversation 依[02](./02-domain-model.md)进入 `waiting_for_user`、`waiting_for_counterparty`、`paused` 或 `closed`；未授权提案不改变对外状态。 |
| 外部效果 | 仅发送在话题、时间、渠道、隐私与承诺边界内的低风险消息；面试安排、薪资、地点、offer、身份／隐私问题默认升级。 |
| 中断／恢复 | 连接器离线、重复发送疑虑、登录挑战、边界冲突或低置信时先查回执；结果不明时 action 保持 `executing`，以 observationStatus 和独立查询／接管 Task 表达。恢复后重新确认消息和授权而非盲目重发。 |
| 终端结果 | 可审计的已发送消息、等待对方、用户接管／拒绝，或关闭 Conversation；绝不冒充用户作出承诺。 |

### 7. 面试、结果与策略反馈

| 字段 | 规定 |
|---|---|
| 触发 | 收到面试邀约／结果、用户记录反馈、无响应超出用户设定的等待窗口，或出现 offer／拒绝／撤回。 |
| Task.responsibleActor | `ApplicationAgent` 维护申请与沟通；`OutcomeAnalyst` 提供复盘提案；`GrowthAgent` 接手可验证的成长跟进。 |
| 输入 | Application、Conversation、面试记录、用户陈述、可核验通知、Mission 目标与偏好。 |
| 输出产物 | 面试准备／复盘、`Outcome` 草案、策略调整提案、新 GrowthPlan 或后续 Opportunity 查询。 |
| 状态变化 | Application 到 `in_process`、`closed` 或 `withdrawn`；Outcome 从 `recorded` 到用户确认后 `confirmed`。无响应只更新等待任务，不擅自关闭。 |
| 外部效果 | 可生成本地准备与提醒；改期、撤回、offer 回复或追问须走[05](./05-delegation-connectors.md)的显式外部动作规则。 |
| 中断／恢复 | 用户暂停时保留通知与截止时间；无响应创建待决检查；拒绝、撤回、offer 或来源冲突均保留原始证据和可恢复的后续策略 Task。 |
| 终端结果 | 已确认 Outcome、继续等待／用户接管、关闭或撤回的 Application，以及不回写事实的 Mission 策略反馈。 |

## 八项验收场景（已确认基线）

这些场景是业务可验收的最小闭环，后续赛事切片可引用但不得把它们解释为已实现或已确认。

1. **简历入口**：用户导入经历，系统产生 Evidence 候选与来源链；未确认前，简历草案不能把它当事实。
2. **岗位入口**：用户粘贴信息不全的岗位，系统保留 `unverified` Opportunity 和缺口；不能直接创建可提交的 Application。
3. **直接申请路线**：用户选择合格岗位，系统以确认 Evidence 产出材料和 Application 准备包；只在授权、幂等和成功回执齐备后提交。
4. **成长申请路线**：真实差距转为 GrowthPlan；完成行动后新增 Evidence 仍需确认，不能把“完成计划”当作能力或申请成功。
5. **并行追求**：同一 Mission 同时追求两个岗位，一个 Pursuit 走直接申请，另一个暂停成长；任何单一 Mission stage 都不能覆盖二者进度。
6. **包络内自主 HR 沟通**：话题、渠道、时间、承诺与隐私均在有效 Envelope 内时，可发出低风险消息并保留 AuditReceipt；发送状态不明先查询回执。
7. **包络外升级**：HR 消息触及薪资、地点、排期、隐私或其他包络外承诺时，自动回复停止，Conversation 进入 `waiting_for_user`，提供最小交接包。
8. **Outcome 反馈**：收到拒绝、撤回、无响应或 offer 时保留原始通知和 Outcome 草案；用户确认后才形成策略反馈，offer 回复与撤回均需独立授权。

## 跨流程异常处理

| 情形 | 一致处理 |
|---|---|
| 不完整／未验证岗位、已过期岗位 | 保留 provenance 和 freshness，分别停在 `unverified`／`expired`；不以旧快照提交。 |
| 用户暂停 | 只暂停明确对象或 Task；不隐式取消其他并发 Pursuit、授权记录或历史证据。 |
| connector 离线、页面陈旧或平台限制 | 不猜测外部结果；记录阻塞原因、提供 takeover，并在恢复后重新验证状态。 |
| 重复／重试动作 | 以 idempotency key 和 AuditReceipt 去重；需要再尝试时记录原因和新版本。 |
| 提交失败或无响应 | 失败有回执；无响应仅形成等待／提醒任务，不等同拒绝。 |
| 拒绝、撤回、offer | 各自保留原始来源；任何撤回或 offer 回应属于新的高影响外部动作，必须单独授权。 |
