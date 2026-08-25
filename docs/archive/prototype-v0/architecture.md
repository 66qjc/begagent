# 大学生求职执行 Agent：系统架构定稿

## 1. 框架决策

DeepSeek Harness 采用 **SDK + 受控子进程** 接入，不直接嵌入其内部 packages。

原因：SDK 是最窄且相对稳定的公开边界，能够保留会话、事件与审批能力；子进程故障可以隔离、熔断和替换。内部 packages 与实验性 Agent Team 不进入关键路径。比赛黄金闭环默认使用本地确定性运行时，即使 DeepSeek Harness、模型服务或网络不可用，整条展示仍可完成。

Pi 不作为主运行时。未来如果需要接入，只实现同一个 `CareerRuntimePort`，不改业务编排器、数据库或 Web UI。

## 2. 分层与职责

```text
React Career Command Center
              │ HTTP
Fastify API / 输入校验 / 错误映射
              │
CareerOrchestrator（唯一状态推进者）
       ┌──────┼──────────┐
  Domain policy      RuntimePort      ExternalChannelPort
  状态机/审批/交接     三业务 Agent       ATS / HR 副作用
       │                 │                   │
SQLite Career DB   Deterministic / HTTP / DSH   Controlled Mock
```

- **展示层**：自研 React Web 控制台，只展示职业任务、Agent 主责、阶段、审批、证据、记忆与事件；不复用 DeepSeek Web UI。
- **API 层**：Fastify 负责契约校验、命令/查询路由和稳定错误码，不包含业务状态判断。
- **领域编排层**：`CareerOrchestrator` 创建任务、推进状态机、生成交接包、写入记忆/证据、创建动作意图并协调副作用。
- **策略层**：从版本化 `career-policy.json` 加载有优先级的规则；绿色内部动作可执行，黄色授权范围外动作暂停，红色敏感/承诺动作始终确认，黑色造假动作禁止，未命中规则时失败关闭。
- **运行时适配层**：固定的三个业务 Agent 通过 `CareerRuntimePort` 返回结构化结果。传输层可选择本地确定性、Chat Completions、Responses、Anthropic Messages 或后续 DSH 适配器。
- **基础设施层**：职业领域 SQLite 与通用运行时会话库分离。领域库是任务真实状态的唯一来源，不能从聊天记录反推业务状态。

## 3. 调用边界

1. Web 只能调用 API，不能直接调用 Agent、数据库或外部通道。
2. API 只能调用编排器，不能直接推进 Mission。
3. 业务 Agent 不互相调用。一个任务只有一个主责 Agent；编排器生成结构化 `Handoff` 后，支持 Agent 才接手指定工作。
4. Agent 可以提出分析、草稿、证据候选，不能直接写入已确认记忆、发布简历或执行对外承诺。
5. `CareerMemory` 只保存带来源和作用域的数据；跨 Agent 读取由编排器按任务边界组装上下文。
6. `Evidence` 必须能追溯到用户完成的成果；简历更新只能引用已有证据。
7. 所有 ATS/HR 副作用先形成 `ActionIntent`。策略判定、审批版本检查与幂等键通过后，才调用 `ExternalChannelPort`。
8. 事件日志记录每次状态变化、交接、审批和外部回执，供 UI 与故障恢复使用。

## 4. 模块边界

```text
apps/
  api/                  HTTP composition root 与路由
  web/                  自研 Career Command Center
packages/
  contracts/            跨进程 Zod 契约
  core/                 领域模型、状态机、策略、端口、编排器
  infrastructure/       SQLite、多协议运行时、DSH SDK 适配器、Mock 通道
config/
  runtime.providers.json  Provider 目录，不保存密钥
  career-policy.json      版本化职业策略
tests/
  core/                 领域与边界测试
  integration/          数据库恢复、API 与黄金闭环测试
docs/
  architecture.md       技术架构定稿
  product-logic-architecture.md
```

依赖方向固定为：`apps -> infrastructure -> core -> contracts`。`core` 不导入 Fastify、SQLite、DeepSeek Harness 或 React。

## 5. 最小技术验证与验收门槛

第一门槛是无模型密钥的黄金闭环，而不是先验证任意 Agent 聊天：

1. 创建 Career Mission，已有确认档案与分层记忆。
2. 求职执行 Agent 完成岗位五层判断并识别证据缺口。
3. 编排器把短期证据任务交给面试成长 Agent。
4. 用户提交真实成果，证据写入记忆，任务交回优势简历 Agent。
5. 优势简历 Agent 生成只引用已确认事实的新版本。
6. 投递形成黄色动作意图，用户批准后受控 Mock ATS 只执行一次。
7. HR 薪资/到岗问题形成红色动作意图，用户批准后发送草稿。
8. 关闭并重启进程后，Mission、审批、消息、证据和事件仍可恢复。

验收必须同时满足：领域测试通过、HTTP 全链路通过、SQLite 重启恢复通过、重复审批无重复副作用、TypeScript 严格检查通过、生产构建通过、桌面与移动浏览器无横向溢出且主要操作可交互。

## 6. DeepSeek Harness 验证与回退

DSH 技术验证放在黄金闭环之后，验证项为：子进程可启动；固定 session 可恢复；结构化输出可校验；超时/崩溃可关闭；审批事件能映射为领域动作意图；领域数据库不受运行时进程异常破坏。

若任一关键项失败，按以下顺序回退：

1. 立即切回 `DeterministicCareerRuntime`，比赛展示与产品状态不受影响。
2. 如需要真实模型，选择 Chat Completions、Responses 或 Anthropic Messages Provider，实现仍统一在 `CareerRuntimePort` 后。
3. Pi 仅作为另一可选适配器或设计参考，不接管领域状态与审批。
4. DSH 插件只做可观测性或开发辅助；在 SDK 验证稳定前，不允许插件成为业务必需依赖。

这使“职业产品是否可靠”与“某个通用 Agent 框架是否成熟”解耦。

## 7. 多协议 Provider 边界

`runtime.providers.json` 是运维侧启动配置，不是普通用户可写的业务数据。每个远程 Provider 只声明 `protocol`、`baseUrl`、`model`、`apiKeyEnv` 和超时；真正密钥仅在进程启动时从对应环境变量解析。

三种传输协议分别拥有独立适配器：

- `OpenAiChatProtocol` → `POST {baseUrl}/chat/completions`；
- `OpenAiResponsesProtocol` → `POST {baseUrl}/responses`；
- `AnthropicMessagesProtocol` → `POST {baseUrl}/v1/messages`。

协议适配器只把上游响应归一化为文本，`ConfiguredCareerRuntime` 再解析 JSON 并按岗位分析、证据冲刺、简历版本或 HR 回复的 Zod 契约校验。校验失败不会写入领域数据库。Provider 无权直接调用编排器、Repository 或外部通道。

## 8. DeepSeek Harness plugin 边界

本地源码确认 DSH 基于 Cordis 组合插件，配置通常由 `cordis.yml` 装配；插件既可以是提供服务的 class，也可以是声明 `name`、`inject`、`Config`、`apply` 的 function plugin。插件具有随 Host 装载/卸载的生命周期，产品可见插件按其仓库规则还需要通过真实组合配置启动的测试，而不能只做手工 `ctx.plugin(...)` 单测。当前版本又明确处于 developer preview，因此只把插件作为 **运行时侧扩展**。

第一批值得做、但不进入比赛关键路径的插件：

- `career-runtime-observability`：把 session、模型调用、工具调用、超时和 token 事件转换为脱敏诊断事件，并携带 Mission 相关 ID。
- `career-context-reader`：只读获取编排器为当前任务裁剪的上下文包，禁止查询整个职业记忆库。
- `career-proposal-submit`：允许 Agent 提交结构化分析或草稿候选，但只能写入“待编排器校验”的提案队列，不能推进 Mission 或执行外部动作。

以下能力明确不能成为 DSH plugin 的所有者：Career Mission 状态机、已确认 Memory/Evidence、授权策略、用户审批决定、幂等外部副作用和恢复日志。这些继续由自研领域层拥有。只有在 SDK 子进程验证通过、插件真实组合测试通过、卸载/崩溃不破坏领域状态后，才启用上述 opt-in 插件。

## 9. `ai-job-search` 参考仓库采纳边界

对 `MadsLorentzen/ai-job-search@e2c311a5b40512daf79a04b22c96d7e049afc745` 的代码级审计表明：该项目的主体是 Claude Code Markdown 命令与 Skill 规范，不是可替换 `CareerOrchestrator`、DeepSeek Harness 或 `CareerRuntimePort` 的运行时框架。因此不改变第 1 至 4 节的架构决策。

采纳后的职责边界：

- `CareerRuntimePort` 可以分别返回 `ResumeDraft` 和 `ResumeReview` 提案，但不能确认事实、发布材料或推进 Mission。
- `core` 持有 Claim 到 `evidenceIds` 的关联、Reviewer 结果、材料验证状态和允许进入申请审批的门槛。
- `DocumentRendererPort` 负责使用受控模板生成 PDF，不执行模型提供的任意编译命令。
- `DocumentVerifierPort` 负责页数、文本层、关键字段和关键词覆盖等机械检查；视觉检查结果作为独立验证项记录。
- SQLite 继续保存岗位、申请、Outcome 和事件；不引入上游的 CSV/Markdown 第二状态源。
- Application 状态变化采用追加式领域事件；重新生成材料不能把已提交、面试中或已结束的申请倒退为草稿，关键岗位正文、草稿、复核与审批产物保存版本、时间戳和内容哈希。
- 上游 Portal CLI 只能作为未来 `JobSourcePort` 适配器的参考，Mock ATS 仍是比赛关键路径。

最接近可复用代码的是上游 `tools/verify_pdf.py`。进入正式简历渲染里程碑时，可选择固定提交、保留 MIT 声明后受控调用，或以等价测试移植为 TypeScript。`tools/robots_check.py` 只在未来接入公开岗位页面时评估，不用于绕过站点明确禁止的访问规则；正式使用前还必须补充 URL scheme 限制、SSRF 防护和域名白名单。

详细的采纳矩阵、Prompt Contract、实施顺序和许可证要求见 [`reference-adoption-ai-job-search.md`](./reference-adoption-ai-job-search.md)。

当前落地状态：三个结构化产物的 Zod 契约和纯 `evaluateResumeReadiness` 领域门已经实现；Reviewer 运行、SQLite 投影、PDF 工具链以及 `requestApplication()` 强制接线尚未实现。UI 和 API 在接线完成前不得显示“材料已验证”。
