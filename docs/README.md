# 文档导航

按以下唯一入口了解文档状态，不要将历史原型资料当作当前实现授权：

- [Business Baseline](./product/README.md)：现役业务权威索引；01–08 分册均已 Confirmed，总索引 Frozen。改变冻结业务定义须建立新版本并重新确认。
- [框架评估协议与结论](./framework/README.md)：评估已完成，[ADR-001](./framework/ADR-001-agent-harness.md) 选定 `@langchain/langgraph@1.4.12` 为唯一主框架，并已自 competition v1（2026-08-26）起以 `WorkflowPort` 形式落地产品代码。
- [统一求职自动化目标架构](./architecture/target-architecture.md)：将 beg 产品域与已授权复用的 BossHunter 执行能力合并到 Opportunity Pipeline、ExecutionRun 与 Local Execution Bridge。
- [统一求职自动化迁移计划](./architecture/migration-plan.md)：按 contracts、bridge、岗位池、评分、证据、审批、执行和对话监听分阶段实施。
- [prototype-v0 历史归档](./archive/prototype-v0/README.md)：2026-08-24 冻结黄金路径原型的历史决策与参考资料，仅供追溯。
- [历史 Superpowers 计划](./superpowers/plans/)：保留的历史计划，不是现役产品或架构权威。
