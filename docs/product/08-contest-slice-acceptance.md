# 08｜赛事切片与验收

> 状态：**Confirmed / 用户已确认**

本册唯一拥有赛事切片的演示范围、验收口径、交付物与非主张。产品范围由[01｜产品定义](./01-product-definition.md)拥有，领域状态由[02｜领域模型](./02-domain-model.md)拥有，业务流由[03｜业务流程](./03-business-flows.md)拥有，授权与 connector 边界由[05｜委托、连接器与执行边界](./05-delegation-connectors.md)拥有。本册定义的是已确认的验收基线，不等于这些能力已经实现或已经通过验证。

## Golden path

赛事演示必须按以下顺序完整展示一条可回溯路径；每一箭头都应有输入、结构化产物、领域状态／事件或受控 adapter 回执，不能以单一聊天记录替代：

`conversational profile → major-company job discovery → growth pursuit → evidence task → resume/evidence profile → independent review/verification → delegated application → autonomous in-envelope HR conversation → out-of-envelope escalation → outcome feedback`

其中的“major-company job discovery”指具有可追溯来源、freshness 与适用范围的岗位情报；“independent review/verification”必须由与材料起草不同的 review／verification contract 产生，并保留 evidenceRefs、冲突或缺口。任何未确认事实、过期来源、状态不明提交或包络外承诺都必须显示为阻塞、重新验证或用户接管，而不是被路径静默跳过。

## 必须真实运行的能力与受控外部 adapter

赛事不是只展示设计稿。以下能力必须以可重复的本地／赛事环境真实运行并产生可检查 artifacts：

| 必须真实运行 | 运行证据 |
|---|---|
| 对话式资料采集，形成待确认／已确认的 CandidateProfile 与 Evidence 引用。 | 版本、确认状态、来源／引用和 `Task` trace。 |
| 机会解析、GrowthPlan、evidence Task、材料草案以及独立 review／verification。 | 结构化 Agent artifact、输入版本、evidenceRefs、风险／缺口和 schema 结果。 |
| `ContextPackage` 检索引用、freshness 判断、cache 命中／失效与 omission。 | retrieval trace、引用列表、版本变更后的 invalidation 记录。 |
| Envelope 编译检查、幂等去重、SideEffectLedger、包络内／外 HR 路由与用户接管。 | Envelopes／policy version、idempotency key、`AuditReceipt` 或 controlled-adapter receipt、escalation packet。 |
| restart／Bridge 重连后的恢复与 Outcome 反馈。 | replay／恢复 trace、最后可靠观察、Outcome／StrategyProposal 的确认与局限。 |

下列项目可以使用**受控外部 adapter**，但 adapter 必须实现与真实 connector 相同的请求、能力、失败、回执和重连 contract，并在画面和交付物中明确标注为受控环境：

| 受控 adapter | 可模拟的边界 | 不得暗示的能力 |
|---|---|---|
| job source | 固定的 major-company 官方页面快照／经允许的示例数据、更新与撤回事件。 | 实时覆盖全部公司、持续在线抓取或职位仍开放。 |
| application channel | 表单字段、提交成功／未知／失败回执、重复提交查询。 | 已对真实 ATS 或第三方站点投递，或可绕过登录／验证码。 |
| HR conversation channel | 包络内低风险消息、包络外薪资／地点等消息、平台消息 ID 与断连恢复。 | 已与真实 HR 沟通、可代表用户作承诺，或可处理所有话题。 |
| Local Execution Bridge | 在线、断开、重连、陈旧页面与能力变化信号。 | 已控制用户浏览器、保存凭据或绕开平台限制。 |

## Screen traceability

每个屏幕、卡片、状态徽标和 CTA 都必须能向下追溯到至少一种可检查来源：一个版本化领域对象、一个带时间的 domain event，或一个 schema-validated structured Agent artifact。UI 必须显示其对应的 ID／版本／来源摘要或可打开的 trace；没有此来源的装饰性“AI 已完成”“已投递”“记忆已更新”等文案不得出现。

展示中至少应可从 Mission 看见并发 Pursuit、从 Pursuit 看见 Evidence／Application／Conversation／Task、从外部动作看见 Envelope 与 receipt、从模型建议看见输入引用与 confirmation status。由 adapter 产生的内容须额外标记 adapter 名称、controlled status 和观察时间。

## 验收场景（已确认基线）

以下八项均须具有可重复的 fixture、起始数据、预期状态／artifact、可查看 trace 与明确 pass 条件；与[03｜业务流程](./03-business-flows.md)的业务验收保持一致，且不声称已经通过。

| 场景 | Fixture 与必经行为 | Pass 条件 |
|---|---|---|
| 1. 简历入口 | 导入带模糊陈述的材料，形成 Evidence 候选与问题。 | 未确认字段不进入对外材料；每项候选可见来源与版本。 |
| 2. 岗位入口 | 提供信息不全／新鲜度不足的岗位。 | `Opportunity` 留在 `unverified`，显示缺口，不能创建可提交 Application。 |
| 3. 直接申请路线 | 对 qualified Opportunity 用已确认 Evidence 生成材料与准备包。 | 只有 Envelope、幂等 key 与成功 receipt 同时存在时才显示 submitted。 |
| 4. 成长申请路线 | 真实差距生成 GrowthPlan 与 evidence Task。 | 完成 Task 只产生待确认 Evidence；不把计划完成写成能力或申请成功。 |
| 5. 并行追求 | 同一 Mission 有两个岗位，一个直接申请、一个暂停成长。 | 两个 Pursuit 状态独立；没有全局 Mission stage 覆盖其进度。 |
| 6. 包络内自主 HR 沟通 | 给出话题／渠道／时间／承诺／隐私均匹配的低风险消息。 | 受控 adapter 返回 receipt；消息、Envelope、idempotency 和 trace 可关联。 |
| 7. 包络外升级 | HR 询问薪资、地点、排期、隐私或其他越界承诺。 | 不发送；Conversation／Task 进入等待／接管，提供最小 escalation packet。 |
| 8. Outcome 反馈 | 给出拒绝、撤回、无响应或 offer 通知。 | 原始来源与 Outcome 草案可见；用户确认后才给 StrategyProposal，offer／撤回不自动执行。 |

### 韧性与数据验收

这些是八场景之外的共同门槛，任一失败则该赛事切片不通过：

- **Restart recovery**：在准备或执行中重启后，以持久化版本、trace 和最后可靠观察恢复；不得将未完成动作宣告成功。
- **Duplicate action prevention**：对相同 application／conversation／action key 的双击或重试先查询 ledger／receipt；不得产生第二次外部 effect。
- **Bridge reconnect**：Bridge 断开后停止执行；重连时重新观察页面／connector 状态、Envelope 有效期和 freshness，状态不明时升级接管。
- **Cache invalidation**：Evidence、岗位来源、权限或隐私删除改变时，相关 package／proposal／render／job-intelligence cache 失效；旧值不得推动动作。
- **Retrieval citations**：每个模型建议、review、材料陈述和策略建议都能回到 `ContextPackage` 的引用、对象版本、确认状态与 retrieval trace；无引用必须停止或标为缺口。

## 赛事交付物

1. 可运行的 Golden path 演示，以及八个可单独复现的 fixtures 与韧性用例。
2. Web Control Center 演示面，含 Mission／Pursuit／Task、Evidence、材料、Envelope、状态、takeover 与 trace。
3. 受控 adapter 清单、能力声明、固定输入／预期输出、失败／重连模拟与 receipt 示例。
4. 结构化 artifact／trace 导出：`ContextPackage`、Agent proposal、review／verification、`ConnectorPlan`、`AuditReceipt`、replay 与 Outcome feedback。
5. 一份验收记录，逐项列出环境、版本、fixture、实际结果、截图／trace 引用和未通过原因；没有记录就不能宣称通过。

## 明确非主张

- 不主张已经对真实 major-company ATS、招聘 App、HR 或用户浏览器进行生产级集成；受控 adapter 不等于真实平台覆盖。
- 不主张自动处理登录、CAPTCHA、OTP、QR、身份验证、薪资、地点、offer、撤回或其他高影响承诺。
- 不主张单次赛事结果证明长期求职效果、模型准确性、因果优化、隐私合规认证、平台合规认证或规模化可靠性。
- 不主张缓存、模型输出、聊天文本或 demo 状态即为业务真值；不主张已经选择／验证任何通用 orchestration framework。
