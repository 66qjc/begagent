# beg

`beg` 是面向大学求职者的求职执行产品探索。当前仓库保留的是一个**冻结的黄金路径验证原型**：它实现并验证一条真实运行、可审批、可审计、可恢复的闭环；招聘平台和 HR 通道使用受控 Mock，业务编排与状态持久化不使用假页面状态。

## 文档状态与入口

- [Business Baseline](./docs/product/README.md)：未来业务定义的唯一入口；01–08 当前均为 **Confirmed**，总索引已 **Frozen**。这允许进入框架评估闸门，但不代表业务能力已经实现，也不单独授权架构重构或代码迁移。
- [未来框架评估协议](./docs/framework/README.md)：仅在 Business Baseline 经用户逐册确认并明确标为 **Frozen** 后，才可按单独授权启动评估；当前没有框架选择。
- [prototype-v0 历史归档](./docs/archive/prototype-v0/README.md)：记录 2026-08-24 原型时期的产品、架构和外部参考决策，仅供追溯，不是当前产品权威。
- [文档总导航](./docs/README.md)：上述现役、门控与历史资料的唯一导航。

除非上述闸门完成，以下内容均只描述和维护现有原型，不能被解读为 `beg` 未来产品蓝图或已批准的技术架构。

## 运行冻结原型

需要 Node.js 22.19+ 与 pnpm（仓库声明 `pnpm@10.28.1`）。

```powershell
pnpm install
pnpm dev
```

打开 <http://127.0.0.1:4318>。点击“载入黄金演示”，依次完成岗位分析、证据冲刺、简历更新、投递审批、HR 敏感回复审批。

生产构建与本地预览：

```powershell
pnpm verify
pnpm start
```

默认 API 为 <http://127.0.0.1:4317>，Web 为 <http://127.0.0.1:4318>。`CAREER_DB_PATH` 可覆盖职业领域数据库路径。

## 冻结原型的多协议第三方模型

运行时目录位于 `config/runtime.providers.json`，目前支持：

- `chat-completions`：调用 `/chat/completions`；
- `responses`：调用 `/responses`；
- `anthropic-messages`：调用 `/v1/messages`；
- `deterministic`：本地无密钥比赛模式。

接入第三方服务时：

1. 复制配置文件中的对应示例，填写 `baseUrl`、`model` 和密钥环境变量名；
2. 将该 Provider 的 `enabled` 改为 `true`；
3. 通过 `CAREER_RUNTIME_PROVIDER` 选择 Provider；
4. 在进程环境中设置密钥，不要把密钥写入 JSON。

PowerShell 示例：

```powershell
$env:CAREER_RUNTIME_PROVIDER='responses-example'
$env:CAREER_RESPONSES_API_KEY='your-secret'
pnpm dev
```

`GET /api/system/config` 可查看当前协议、Provider 状态与生效策略；响应不会包含密钥值或密钥环境变量名。若未设置第三方 Provider，系统继续使用 `local-demo`。

## 冻结原型的策略配置

`config/career-policy.json` 保存版本化职业策略，包括真实性与证据、敏感承诺确认、授权范围、用户接管和第三方模型权限边界。服务启动时使用 Zod 校验并编译为有优先级的失败关闭规则。

第三方模型只能返回岗位分析、证据任务、简历候选和 HR 回复草稿；它不能直接推进 Mission、确认事实、批准动作或调用 ATS/HR 通道。

## 冻结原型已实现且已验证的边界

- `CareerOrchestrator` 是唯一可以推进 Career Mission 状态的入口。
- 三个业务 Agent 只通过固定运行时端口提供能力，不互相直接调用。
- Memory、Evidence、ActionIntent 是领域实体，不是隐藏在提示词里的上下文。

## 外部参考采纳

`MadsLorentzen/ai-job-search` 的代码与提示词审计结论、可复用资产、禁止项和 MIT 许可证要求已保留在 [prototype-v0 历史归档](./docs/archive/prototype-v0/README.md)。该参考仅说明当时原型边界，不构成未来 `beg` 的架构选择。

当前原型已落地 `ResumeDraft`、`ResumeReview`、`DocumentVerification` 的 Zod 契约及纯申请就绪门；真实 Reviewer、PDF 验证工具和编排器接线仍属于后续里程碑，不能视为已实现。
- 投递与包含薪资/到岗承诺的 HR 回复先生成动作意图，再经策略与用户审批后执行。
- 外部副作用使用幂等键；状态版本阻止重复或过期审批。
- SQLite 保存任务、交接、记忆、证据、简历版本、动作意图、外部回执与事件，可在进程重启后恢复。
- 比赛默认使用 `DeterministicCareerRuntime` 和 `ControlledMockChannels`，不依赖网络或模型密钥。
- 第三方运行时支持 Messages、Chat Completions 和 Responses 三种协议，统一映射到 `CareerRuntimePort`。
- DeepSeek Harness 只存在于可替换的 SDK 子进程适配器 `DshCareerRuntime` 中；未依赖实验性 Agent Team，也未使用其 Web UI。

这些是冻结原型的事实和维护边界，不预先决定未来 `beg` 的框架、模块或实现方式。未来技术选型须先遵循[未来框架评估协议](./docs/framework/README.md)，并在获选 ADR 后与治理和架构文档一并更新。
