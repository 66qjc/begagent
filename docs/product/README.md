# beg Business Baseline

> 总状态：**Frozen / 用户已冻结**

`beg` 面向大学求职者。Business Baseline 使用中文撰写，并保留稳定的英文类型名、协议名和领域对象名，便于产品、设计、业务与工程在同一术语上讨论。

## 状态词汇

| 状态 | 含义 |
|---|---|
| Draft | 已建立的讨论稿，尚未获得逐册确认。 |
| In Review | 正在供用户审阅、修订或裁决。 |
| Confirmed | 已由用户确认，可作为后续分册讨论的基线。 |
| Frozen | 用户明确冻结的完整 Baseline；冻结前不产生框架或业务实现授权。 |
| Superseded | 已被指定的后续版本替代，保留用于追溯。 |

## 分册与审阅顺序

以下分册按编号顺序审阅。01–08 均已由用户确认为 **Confirmed**，总索引现已由用户明确标记为 `Frozen`。后续工作必须遵守本基线；如需改变已冻结业务定义，必须建立新版本并重新确认。

| 审阅顺序 | 分册 | 状态 | 责任 |
|---:|---|---|---|
| 01 | [产品定义](./01-product-definition.md) | Confirmed | 用户、问题、价值与范围。 |
| 02 | [领域模型](./02-domain-model.md) | Confirmed | 业务对象、所有权、状态与不变量。 |
| 03 | [业务流程](./03-business-flows.md) | Confirmed | 入口、并发追求与结果反馈闭环。 |
| 04 | [Agent Prompt Contracts](./04-agent-prompt-contracts.md) | Confirmed | Agent 责任、结构化提案与交接。 |
| 05 | [委托、连接器与执行边界](./05-delegation-connectors.md) | Confirmed | 授权包络、连接器、接管与审计。 |
| 06 | [Memory、检索与缓存](./06-memory-retrieval-cache.md) | Confirmed | 上下文检索、引用、缓存与隐私删除规则。 |
| 07 | [创新层](./07-innovation-layer.md) | Confirmed | 自主执行与效率的产品扩展及赛事证据。 |
| 08 | [赛事切片与验收](./08-contest-slice-acceptance.md) | Confirmed | Golden path、受控 adapter、验收与非主张。 |

**明确闸门：** 01–08 已全部 `Confirmed`，本索引现为 `Frozen`。现在可以按[未来框架评估协议](../framework/README.md)准备框架 Spike；本文档本身不选择任何框架。框架 Spike 仍须单独固定版本、记录证据并通过验收。

## 当前讨论记录（已完成逐册确认并冻结）

以下记录用于保持讨论连续性。01–08 分册已逐册 Confirmed，本索引已 Frozen；后续实现仍必须经过框架评估、ADR 和相应实施授权。

| 决策 | 当前记录 |
|---|---|
| 原型定位 | 现有原型冻结为 golden-path 验证样本，不再是未来产品或框架设计的权威。 |
| 产品范围 | 先形成完整产品蓝图，同时定义一个可验证的赛事切片。 |
| 文档结构 | 用本索引管理 01–08 分册及其逐册确认状态。 |
| Agent 结构 | 四个核心 Agent 承担主价值链；领域专家以明确专长支持它们，不以无边界聊天替代责任。 |
| 技术语言 | 产品与未来实现讨论以 TypeScript-first 为原则。 |
| 产品与本地能力 | 采用 Web Control Center 与 Local Execution Bridge 的双面结构。 |
| 业务流与并发 | Mission 是目标容器；岗位进度由并发的 Pursuit、Application、Conversation 与 Task 分别表达。 |
| 自动化边界 | 委托自动化必须位于用户授权包络（authorization envelope）内。 |
| 信息来源 | 官方或已获授权的来源优先。 |
| 创新主线 | 以 autonomy / efficiency 为创新主线，同时保持用户可理解、可控制。 |
| 框架策略 | 保持一个主框架，通过 adapters 接入可替换能力；评估只依[未来框架评估协议](../framework/README.md)在用户冻结 Baseline 后启动。 |

## 权威顺序

1. 用户在当前讨论中作出的明确确认，以及本索引的显式状态。
2. 状态为 `Confirmed` 的本目录分册；跨册定义应链接到其唯一拥有者，不重复造规范。
3. `Draft` 与 `In Review` 分册仅用于讨论，不能授权实现。
4. [prototype-v0 历史归档](../archive/prototype-v0/README.md)仅用于追溯 2026-08-24 原型决策，不构成现役 Business Baseline。
5. [未来框架评估协议](../framework/README.md)只在本索引被用户明确标为 `Frozen` 后定义未来 Spike 入口；它不构成框架选择。
