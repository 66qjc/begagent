# 05｜委托、连接器与执行边界

> 状态：**Confirmed / 用户已确认**

本册定义用户授权如何编译为可执行边界，以及 Web Control Center、Local Execution Bridge 和 connector 如何在这些边界内协作。对象与状态机由[02｜领域模型](./02-domain-model.md)拥有，端到端业务流由[03｜业务流程](./03-business-flows.md)拥有，Agent 只可产生提案的 contract 由[04｜Agent Prompt Contracts](./04-agent-prompt-contracts.md)拥有。本册不选择框架，也不构成实现授权。

## `PersonaContract` 与 `DelegationEnvelope`

`PersonaContract` 是 CandidateProfile 下的用户可审阅、可撤销的协助偏好和授权意图，不能由 Agent 自行激活。它沿用 CandidateProfile 的 `dataOwnerUserId`，并以 `aggregateOwnerId = candidateProfileId` 关联；至少包含：

| 字段组 | `PersonaContract` 字段 |
|---|---|
| 主体与版本 | `candidateProfileId`、`contractId`、版本、状态、确认人、确认时间、有效期、撤销记录。 |
| 可协助角色 | 允许的 Agent／人工协作角色、沟通偏好、可做与不可做的工作。 |
| 目标范围 | Mission、Pursuit、岗位、公司、渠道、地区、工作类型和时间窗口。 |
| 行动边界 | 允许的 action class、动作类型、频率、提交前审阅、是否必须 user takeover。 |
| 承诺边界 | 薪资、地点、入职、身份、可用性、offer、撤回、法律／合同等必须升级的主题。 |
| 隐私与数据 | 可使用的材料、可共享字段、redaction 规则、禁止上传／传输的敏感数据。 |
| 连接器边界 | 允许 connector、账户／会话归属、平台规则、浏览器辅助或 Deep Link 偏好。 |
| 安全与审计 | 来源要求、最低置信度、idempotency、receipt 保存期、暂停与紧急撤销方式。 |

`DelegationEnvelope` 是一次具体 `DelegatedAction` 的不可扩张执行快照：它由有效 PersonaContract、当前对象版本、渠道能力、风险分类和用户明确授权编译而成，含 `envelopeId`、关联 Task／Pursuit／Application／Conversation、允许的 job/channel/time/action、commitment/privacy 限制、批准材料版本、`idempotencyKey`、过期时间、takeover 条件和审计策略。它不是通用委托书，也不能由模型文本、网页内容或 connector 自行扩大。

编译采用 fail-closed：任一规则缺失、规则冲突、置信度低、对象版本陈旧、授权被撤销／过期、来源不足或动作越出边界，都不产生 `authorized` 执行许可，而是创建 `waiting_for_user`／`blocked` Task 和最小解释。完整自动化只可发生在**岗位、渠道、时间、动作、承诺、隐私**六类边界都匹配时。

## 动作类别

| 类别 | 可做什么 | 示例 | 规则 |
|---|---|---|---|
| internal automatic | 不改变外部世界的内部分析、草案、去重、提醒和本地审阅。 | JD 解析、Evidence 引用检查、生成材料草案。 | 可自动进行，但不得把推断升级为事实或绕过数据范围。 |
| delegated external | 在有效 Envelope 内、具备回执和幂等的受控外部动作。 | 已授权表单填充／提交、低风险 HR 消息、已授权排期动作。 | 必须有授权、idempotency、执行回执和可接管恢复路径。 |
| escalate/takeover | 高影响、歧义、低置信、平台挑战或边界外动作。 | 薪资／地点／offer 回复、撤回、改期、用户身份确认。 | 停止自动化，提供 Deep Link 或最小交接包，由用户决定。 |
| forbidden | 违反事实、平台、法律、授权或隐私边界的行为。 | CAPTCHA 绕过、批量未授权投递、冒充、伪造材料、规避平台限制。 | 不创建可执行动作，不尝试替代路径；记录合规拒绝原因。 |

## 服务面与信任边界

| 面 | 责任 | 不可信／不得承担 |
|---|---|---|
| Web Control Center | 显示 Mission／Pursuit／Task 状态、来源、材料版本、授权摘要、待决与 AuditReceipt；让用户确认、撤销、暂停、恢复或接管。 | 不能假装 connector 已执行；不能把模型建议显示为已确认事实；不持有超出用户选择的本地会话秘密。 |
| Local Execution Bridge | 在用户设备上承接获授权的浏览器上下文、文件选择、页面观察、connector 调用与回执回传；检测断连和陈旧状态。 | 不是绕过平台、隐藏自动化或提升 Envelope 权限的通道；不能在后台静默扩张至其他站点／账户。 |

Control Center 是授权与可见状态的权威交互面；Bridge 是受限执行环境。Bridge 只能接收最小化、短期、不可扩张的 Envelope 和所需材料引用，回传事实观察／回执，不能确认用户事实、批准动作或将秘密回传给无权服务。

## connector 能力模式与信息来源

| 能力模式 | 适用条件 | 允许操作 | 不允许操作 |
|---|---|---|---|
| official API | 官方 API 或明确授权 API，权限和审计能力可验证。 | 在 Envelope 内读写、查询状态、接收结构化回执。 | 超出 token／scope、绕过 API 限速或把 API 权限解释为所有行动授权。 |
| authorized browser assist | 用户授权的浏览器辅助，平台规则允许，Bridge 可观察当前页面与结果。 | 填充、导航、上传或执行明确许可的单一动作。 | 绕过登录挑战、隐藏后台批量操作、对不可见页面猜测结果。 |
| Deep Link/user takeover | 无安全自动化能力、动作高影响，或需要用户判断／验证。 | 生成预填上下文、Deep Link、最小交接包和后续回执入口。 | 代替用户点击最终承诺、输入 OTP 或回答身份／offer 问题。 |
| prohibited automation | 平台规则、法律、授权或安全要求不允许。 | 仅记录拒绝与合规替代建议。 | 自动化、规避、模拟用户行为或另找未授权 connector。 |

事实来源优先级是：官方公司站点、官方公告、ATS、已授权 API；它们可作为岗位、截止日和申请状态的优先证据。招聘 App 可补充机会情报并在允许时提供执行表面，但其观察内容默认仍须标明来源、新鲜度与验证状态，不能替代官方事实。

## 外部效果的授权、恢复与回执

所有下表动作都以 `DelegatedAction` 表达，状态转换遵循[02｜领域模型](./02-domain-model.md)。`Task.responsibleActor` 只管理内部工作；外部效果责任明确拆为 `accountableActor` 与 `effectExecutor`。`AuditReceipt` 的最小 schema 是 `actionId`、`actionType`、envelope／授权版本、目标、请求摘要哈希、idempotency key、`accountableActor`、`effectExecutor`／connector、时间、结果／错误码、外部引用、观察状态和用户 takeover 状态；回执不是对内容真实性或结果的推断。

**封闭注册治理：**任何 `actionType` 若未在本表定义，或未同时定义 `accountableActor`、授权来源、idempotency、failure／takeover、`AuditReceipt` schema，就不得进入 `authorized` 或 `executing`。编译器只接受完整注册项；缺项只能创建 `blocked`／`waiting_for_user` Task，不得以模型或 connector 默认值补齐。

| actionType／外部效果 | `accountableActor` | `effectExecutor` | 授权来源 | 幂等 | failure／takeover | `AuditReceipt` schema（在最小 schema 之外） |
|---|---|---|---|---|---|---|
| `application_submit` | 用户 | 获授权 connector 或用户 | 有效 PersonaContract + 该岗位／渠道／材料版本的 DelegationEnvelope + 明确提交许可。 | 每个申请／渠道／版本一个 key；前后查询既有回执。 | 页面变化、提交不明、错误或断连时停止；先查询，必要时 Deep Link；用户确认后才新建重试。 | 材料版本、平台申请 ID／确认页或失败码、最终状态。 |
| `hr_message` | 用户 | 获授权 connector 或用户 | Conversation 话题、渠道、时间、承诺／隐私边界均匹配的 Envelope。 | conversation、消息草案版本与动作 key。 | 发送状态不明先查线程／回执；薪资、地点、排期、隐私、offer 或低置信转用户接管。 | 草案哈希、风险判断、平台消息 ID 或失败原因。 |
| `scheduling` | 用户 | 获授权 connector 或用户 | 明确可选时间、时区、渠道和是否可代发的 Envelope。 | calendar／conversation／时段组合 key。 | 冲突、可用性不明、身份确认或会议链接异常时暂停并交接。 | 提议／确认时间、时区、外部事件／消息 ID、未决条件。 |
| `withdrawal` | 用户 | 获授权 connector 或用户 | 单独、明确、未过期的撤回授权；不能从一般申请许可推导。 | application + withdrawal action key；先查是否已撤回。 | 平台无撤回能力、提交状态不明或后果不清时提供接管，不发替代消息。 | 撤回原因摘要、平台确认／失败、后续 Application 状态。 |
| `offer_response` | 用户 | 用户（Bridge 只协助） | 每次具体回复均需用户明确确认；一般 PersonaContract 不能替代。 | offer ID + response version key；先读取现有线程／回执。 | 薪资、合同、地点、入职或期限歧义一律用户接管。 | 用户确认时间、草案版本、用户亲自发送标记、外部引用／未发送原因。 |
| `growth_registration` | 用户 | 获授权 connector 或用户 | GrowthPlan、目标课程／活动、渠道、费用与期限均在有效 Envelope 内。 | growth plan + target + version key。 | 名额、费用、资格或登录挑战不明时停止并交接。 | 目标、费用／名额观察、报名确认 ID 或失败码。 |
| `growth_publication` | 用户 | 获授权 connector 或用户 | 明确的作品／渠道／可见范围／隐私 Envelope。 | artifact version + channel key。 | 可见性、署名、隐私或平台规则冲突时停止并交接。 | artifact hash、可见范围、发布 URL／ID 或失败原因。 |
| `growth_payment` | 用户 | 用户（Bridge 可跳转） | 每笔金额、币种、收款方和用途均需明确一次性授权。 | payment intent + amount + payee key；先查支付结果。 | 支付状态不明、金额变更或需身份验证时用户接管；绝不重发扣款。 | 金额、币种、收款方、支付确认／失败／未知观察。 |
| `growth_assignment_submission` | 用户 | 获授权 connector 或用户 | 作业／项目、材料版本、渠道、截止时间与提交许可均在有效 Envelope 内。 | assignment + artifact version + channel key。 | 截止、附件、评分规则或提交状态不明时停止、查询并交接。 | 材料版本、提交 ID／确认页或失败码、截止时间观察。 |

## 平台挑战与恢复协议

| 情况 | 必须行为 | 恢复条件 |
|---|---|---|
| 登录 | 不读取、保存或代填未获授权凭据；将认证交给用户或官方 session。 | 用户完成登录后，Bridge 重新观察页面和 Envelope 是否仍匹配。 |
| CAPTCHA／OTP／QR／face check | 立即停止自动化；不识别、转发、绕过或模拟验证。 | 用户自行通过后，重新检查页面、动作状态、时效与是否已有回执。 |
| Bridge 断开 | `DelegatedAction` 保持 `executing`，`EffectTrace.observationStatus` 记为 `unknown` 或 `reconciling`；保存最后可靠观察与断连时间，并建有界查询／接管 Task。 | 重连后先查询 connector／页面事实；仅权威回执可令 action 变为 `succeeded`／`failed`。无法确定则继续 `executing` 并人工 reconciliation，不重发。 |
| 陈旧页面 | 检测版本、岗位、表单和 session freshness 失配时停止。 | 刷新并由用户或 connector 重新取得事实；必要时重审材料／授权。 |
| 表单变更 | 不把旧映射盲填进新字段；生成差异与缺口。 | 用户审阅新字段并给出新授权或更新 Envelope。 |
| 平台限制 | 归入 prohibited automation 或 Deep Link；不给出规避建议。 | 仅在平台规则、connector 能力和用户授权均改变且可验证时重新分类。 |
