# 02｜领域模型

> 状态：**Confirmed / 用户已确认**

本册唯一拥有 `beg` 的业务对象、所有权、生命周期与状态不变量。产品定位和范围见[01｜产品定义](./01-product-definition.md)；本册不选择技术框架。

## 建模原则

- `CandidateProfile` 是候选人的个人事实与偏好边界；一个 `CandidateProfile` 可以拥有多个 `CareerMission`。
- `CareerMission` 是一个相对一致的职业目标容器；一个 Mission 可以拥有多个并发的 `JobPursuit`。
- `Task` 是唯一的单主责工作单元：每个 Task 同一时刻只有一个 `responsibleActor`；协作通过结果、依赖或显式交接表达，不以多主责覆盖状态。
- Mission、Pursuit、Task 和 `DelegatedAction` 使用相互独立的状态机。一个对象的完成、暂停或失败不得自动重写另一个对象的状态。
- 所有对象都带明确的数据主体、聚合归属与 scope；跨用户、跨 Mission 或跨授权范围的读取与写入默认禁止。裸 `owner` 不再是跨边界字段。

## 通用元数据、来源与事实状态

每个领域对象至少记录：`id`、`dataOwnerUserId`、`aggregateOwnerId`（父聚合；可空）、`scope`、`source` / `provenance`、`version`、`createdAt`、`updatedAt`、`lifecycleStatus`，以及适用时的 `validUntil`、`freshness` 或失效理由。`Task` 另记录唯一的 `responsibleActor`；仅外部 effect 另记录 `accountableActor` 与 `effectExecutor`。派生内容还应记录其输入对象或来源版本，便于回溯。裸 `owner` 不得作为跨用户、跨聚合、Task 主责或外部效果责任的替代字段。

信息的认识状态独立于生命周期：

| 认识状态 | 含义 | 可否作为用户事实 |
|---|---|---|
| `user_confirmed` | 用户确认，且可追溯到来源或证据。 | 可以。 |
| `pending_confirmation` | 系统、专家或用户输入形成的待确认提案。 | 不可以。 |
| `system_inference` | 系统根据已知输入作出的判断、归纳或预测。 | 不可以；必须保留依据与置信说明。 |
| `source_observed` | 从外部来源观察到，尚未由用户确认或验证。 | 不可以直接转为用户事实。 |
| `rejected` | 已被用户或规则否定。 | 不可以。 |

`Evidence` 记录证明材料、来源、适用范围和认识状态；`ResumeArtifact` 与其他输出只能把 `user_confirmed` 的事实或其可追溯 Evidence 当作陈述依据。系统推断可以辅助排序、提问或建议，但不得伪装成用户经历。

## 对象、稳定归属字段与关系

下表前 12 项是用户计划明确列出的**12 个业务／治理领域对象**：`CandidateProfile`、`PersonaContract`、`Evidence`、`CareerMission`、`Opportunity`、`JobPursuit`、`ResumeArtifact`、`Application`、`Conversation`、`GrowthPlan`、`Outcome`、`DelegatedAction`。`Task` 是为单一主责与状态管理所需的第 13 项 **execution-control object**，不静默扩充核心业务名录。

| 分类与对象 | 稳定归属字段与主要关系 | 生命周期状态 |
|---|---|---|
| 业务／治理：`CandidateProfile` | `dataOwnerUserId` 为数据主体；`aggregateOwnerId = null`；关联 PersonaContract、Evidence、Mission 与长期偏好。 | `draft`、`active`、`restricted`、`archived`。 |
| 业务／治理：`PersonaContract` | 同 CandidateProfile 的 `dataOwnerUserId`；`aggregateOwnerId = candidateProfileId`；声明可协助角色、边界、偏好与沟通方式。 | `draft`、`proposed`、`active`、`suspended`、`revoked`、`expired`。 |
| 业务／治理：`Evidence` | `dataOwnerUserId` 为数据主体；`aggregateOwnerId = candidateProfileId`；可被 Mission、ResumeArtifact、GrowthPlan 引用。 | `captured`、`pending_confirmation`、`confirmed`、`superseded`、`rejected`、`archived`。 |
| 业务／治理：`CareerMission` | `dataOwnerUserId` 为数据主体；`aggregateOwnerId = candidateProfileId`；聚合 Pursuit、Task、GrowthPlan、Outcome。 | 见 Mission 状态表。 |
| 业务／治理：`Opportunity` | `dataOwnerUserId` 为可见性隔离主体；`aggregateOwnerId` 可空；可被多个 Mission 评估，保留时效与 provenance。 | `discovered`、`unverified`、`qualified`、`expired`、`withdrawn`、`archived`。 |
| 业务／治理：`JobPursuit` | `dataOwnerUserId` 为数据主体；`aggregateOwnerId = missionId`；围绕一个 Opportunity 组织材料、申请、对话、Task 与 Outcome。 | 见 Pursuit 状态表。 |
| 业务／治理：`ResumeArtifact` | `dataOwnerUserId` 为数据主体；`aggregateOwnerId = candidateProfileId`，并关联 Mission/Pursuit；版本保留证据引用。 | `draft`、`in_review`、`approved`、`retired`、`archived`。 |
| 业务／治理：`Application` | `dataOwnerUserId` 为数据主体；`aggregateOwnerId = pursuitId`；记录渠道、材料版本、结果与提交依据。 | `draft`、`prepared`、`pending_authorization`、`submitted`、`in_process`、`closed`、`withdrawn`。 |
| 业务／治理：`Conversation` | `dataOwnerUserId` 为数据主体；`aggregateOwnerId = pursuitId`；可关联 Application，保存参与方、渠道、消息、摘要与交接。 | `open`、`waiting_for_user`、`waiting_for_counterparty`、`paused`、`closed`。 |
| 业务／治理：`GrowthPlan` | `dataOwnerUserId` 为数据主体；`aggregateOwnerId = missionId`；可由多个 Pursuit 提出并产出 Evidence。 | `draft`、`active`、`paused`、`completed`、`abandoned`。 |
| 业务／治理：`Outcome` | `dataOwnerUserId` 为数据主体；`aggregateOwnerId = missionId` 或 `pursuitId`；必要时关联 Application。 | `recorded`、`confirmed`、`superseded`、`archived`。 |
| 业务／治理：`DelegatedAction` | `dataOwnerUserId` 为数据主体；`aggregateOwnerId = taskId`；位于授权包络内，可关联 Application/Conversation；仅外部 effect 填 `accountableActor` 与 `effectExecutor`。 | 见 DelegatedAction 状态表。 |
| execution-control：`Task`（第 13 项） | `dataOwnerUserId` 为数据主体；`aggregateOwnerId` 可取 `candidateProfileId` 或 `missionId`。另有可空 `missionId`／`pursuitId` 引用：建档、四类首入口与 re-entry review 使用 profile-scoped Task（`aggregateOwnerId = candidateProfileId`，两项引用为空）；进入 Mission 范围后使用 Mission-scoped Task，必要时引用 Pursuit。唯一 `responsibleActor` 是当前主责。 | 见 Task 状态表。 |

关系方向不意味着复制定义：`Application` 不拥有 ResumeArtifact 或 Opportunity；它只固定引用的版本与当时适用的来源快照。`Outcome` 不替代原始申请或对话记录；它是其结果的可追溯表达。

### Task scope 与进入 Mission 的交接

profile-scoped Task 进入 Mission 范围时，不得静默把原 Task 的 `aggregateOwnerId` 从 `candidateProfileId` 改为 `missionId`，也不得补写其 `missionId`／`pursuitId` 来伪造同一工作单元。必须 formal handoff，或创建一个带原 Task、输入版本和 scope 决策 provenance／关联的新的 Mission-scoped Task。原 profile-scoped Task 依自身状态机完成或取消；新 Task 才可在 Mission／Pursuit 范围继续。

## 状态转换

除非下表明确列出，状态转换一律不允许。需要修订已经进入终态的内容时，创建带有 provenance 的新版本或新对象，而不是倒退原对象。`archived` 仅表示不再参与现行流程；它不删除历史记录或其来源链。

### CandidateProfile

| 当前状态 | 允许转入 |
|---|---|
| `draft` | `active`、`restricted`、`archived` |
| `active` | `restricted`、`archived` |
| `restricted` | `active`、`archived` |
| `archived` | 无 |

### PersonaContract

| 当前状态 | 允许转入 |
|---|---|
| `draft` | `proposed`、`revoked` |
| `proposed` | `active`、`revoked`、`expired` |
| `active` | `suspended`、`revoked`、`expired` |
| `suspended` | `active`、`revoked`、`expired` |
| `revoked` / `expired` | 无 |

### Evidence

| 当前状态 | 允许转入 |
|---|---|
| `captured` | `pending_confirmation`、`rejected`、`archived` |
| `pending_confirmation` | `confirmed`、`rejected`、`archived` |
| `confirmed` | `superseded`、`archived` |
| `superseded` / `rejected` / `archived` | 无 |

### Opportunity

| 当前状态 | 允许转入 |
|---|---|
| `discovered` | `unverified`、`qualified`、`expired`、`withdrawn`、`archived` |
| `unverified` | `qualified`、`expired`、`withdrawn`、`archived` |
| `qualified` | `expired`、`withdrawn`、`archived` |
| `expired` / `withdrawn` / `archived` | 无 |

### ResumeArtifact

| 当前状态 | 允许转入 |
|---|---|
| `draft` | `in_review`、`retired`、`archived` |
| `in_review` | `draft`、`approved`、`retired`、`archived` |
| `approved` | `retired`、`archived` |
| `retired` / `archived` | 无 |

### Application

| 当前状态 | 允许转入 |
|---|---|
| `draft` | `prepared`、`withdrawn` |
| `prepared` | `pending_authorization`、`withdrawn` |
| `pending_authorization` | `prepared`、`submitted`、`withdrawn` |
| `submitted` | `in_process`、`closed`、`withdrawn` |
| `in_process` | `closed`、`withdrawn` |
| `closed` / `withdrawn` | 无 |

### Conversation

| 当前状态 | 允许转入 |
|---|---|
| `open` | `waiting_for_user`、`waiting_for_counterparty`、`paused`、`closed` |
| `waiting_for_user` | `open`、`paused`、`closed` |
| `waiting_for_counterparty` | `open`、`paused`、`closed` |
| `paused` | `open`、`closed` |
| `closed` | 无 |

### GrowthPlan

| 当前状态 | 允许转入 |
|---|---|
| `draft` | `active`、`abandoned` |
| `active` | `paused`、`completed`、`abandoned` |
| `paused` | `active`、`abandoned` |
| `completed` / `abandoned` | 无 |

### Outcome

| 当前状态 | 允许转入 |
|---|---|
| `recorded` | `confirmed`、`superseded`、`archived` |
| `confirmed` | `superseded`、`archived` |
| `superseded` / `archived` | 无 |

### CareerMission

| 当前状态 | 允许转入 |
|---|---|
| `draft` | `planning`、`cancelled` |
| `planning` | `active`、`paused`、`cancelled` |
| `active` | `paused`、`completed`、`cancelled` |
| `paused` | `planning`、`active`、`cancelled` |
| `completed` / `cancelled` | 无 |

### JobPursuit

| 当前状态 | 允许转入 |
|---|---|
| `draft` | `active`、`abandoned` |
| `active` | `paused`、`closed`、`abandoned` |
| `paused` | `active`、`closed`、`abandoned` |
| `closed` / `abandoned` | 无 |

### Task

| 当前状态 | 允许转入 |
|---|---|
| `draft` | `ready`、`cancelled` |
| `ready` | `in_progress`、`blocked`、`waiting_for_user`、`cancelled` |
| `in_progress` | `blocked`、`waiting_for_user`、`completed`、`cancelled` |
| `blocked` | `ready`、`in_progress`、`waiting_for_user`、`cancelled` |
| `waiting_for_user` | `ready`、`in_progress`、`cancelled` |
| `completed` / `cancelled` | 无 |

### DelegatedAction

| 当前状态 | 允许转入 |
|---|---|
| `drafted` | `pending_authorization`、`revoked`、`expired` |
| `pending_authorization` | `authorized`、`revoked`、`expired` |
| `authorized` | `executing`、`revoked`、`expired` |
| `executing` | `succeeded`、`failed` |
| `succeeded` / `failed` / `revoked` / `expired` | 无 |

## 不变量与生命周期规则

1. 终态不得回退：所有表中标为无后续转移的终态不能被普通重试、重新生成或重新同步改回活动状态；需要新工作时创建新版本或新对象，并保留关联。
2. 一个 `CandidateProfile` 可并行持有多个 Mission；每个 Mission 内可并行有多个 Pursuit，但其目标、授权范围与上下文必须可区分。
3. Mission 的暂停不自动取消 Pursuit；Pursuit 的关闭不自动完成 Mission；Task 的完成不自动认定 DelegatedAction 已执行。关联对象必须各自满足转换条件。
4. 每个 Task 只有一个当前 `responsibleActor`。协作者不能在未交接的情况下改写该 Task 的生命周期或代表用户执行外部动作。
5. DelegatedAction 必须引用有效的授权范围、适用对象、有效期与幂等标识；授权撤销、过期或范围不匹配时不得执行。
6. Opportunity、Evidence、Outcome 和外部观察必须保留 source/provenance 与 freshness；过期、撤回或未验证不能伪装为当前事实。
7. 会影响候选人对外陈述、申请提交、承诺或隐私的变化，必须保留来源、版本、确认人与时间，并由相关对象各自的状态机判定是否允许。
8. `DelegatedAction.revoked` 只表示尚未发生的动作被撤销或其授权被取消；它不代表已执行的外部效果被回滚。因此 `executing` 不得转入 `revoked`。执行后状态不明时，动作保持 `executing`，由 `EffectTrace.observationStatus = unknown | reconciling` 表示观察状态，并创建 `Task`（`waiting_for_user` 或 `blocked`）进行有界查询或接管；获得权威回执后才转 `succeeded` 或 `failed`。无法确定时继续 `executing` 并要求人工 reconciliation，绝不盲目重发。
