# AGENTS.md — beg

## 治理门：冻结中的产品演进

[Business Baseline](./docs/product/README.md) 的 01–08 分册均为 **Confirmed**，总索引现为 **Frozen**。现在可以按框架评估协议准备 framework spike，但在候选框架通过共同场景验证、ADR 记录完成并获得相应实施授权前，仍不得添加框架依赖、进行业务重构或改写现有原型。当前技术约束只用于维护和验证冻结的黄金路径原型，并不是未来架构的永久预批准。未来架构只有在获选框架 ADR 记录完成且本文件与相应架构文档被有意同步修订后，才可迁移或替换当前边界。

本文件是所有 AI 编码 Agent 维护或验证当前原型时的统一规范。先阅读本文件、[文档总导航](./docs/README.md)和相关现役文档；原型时期的架构与产品资料仅见[历史归档](./docs/archive/prototype-v0/README.md)，不构成未来产品权威。

---

## 1. 项目本质

面向大学生求职执行的多 Agent 演示平台。当前版本实现一条真实运行、可审批、可审计、可恢复的黄金闭环：招聘平台和 HR 通道使用受控 Mock，业务编排与状态持久化不使用假页面状态。

**关键事实：**
- pnpm monorepo，Node.js 22.19+，TypeScript 5.9（`strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`）。
- 前端：React 19 + Vite，自研 Career Command Center，不复用任何外部 Agent Web UI。
- 后端：Fastify 5 + Zod 4，SQLite（better-sqlite3）作为唯一真实状态源。
- 领域核心层 `packages/core` 不依赖 Fastify、SQLite、DeepSeek Harness 或 React。

---

## 2. 当前原型的分层与调用边界

以下是维护或验证冻结原型时必须遵守的调用边界，不是对未来架构的永久选择。依赖方向固定为：`apps → infrastructure → core → contracts`。反向依赖禁止。

1. **Web 只能调用 API**，不能直接调用 Agent、数据库或外部通道。
2. **API 只能调用 `CareerOrchestrator`**，不包含业务状态判断，不直接推进 Mission。
3. **`CareerOrchestrator` 是唯一可以推进 Career Mission 状态的入口。** 三个业务 Agent 只通过 `CareerRuntimePort` 提供能力，不互相直接调用。
4. **一个任务只有一个主责 Agent**；编排器生成结构化 `AgentHandoff` 后，支持 Agent 才接手。
5. Agent 可以提出分析、草稿、证据候选，**不能直接写入已确认记忆、发布简历或执行对外承诺**。
6. **Memory、Evidence、ActionIntent 是领域实体**，不是隐藏在提示词里的上下文。`Memory` 只保存带来源和作用域的数据；跨 Agent 读取由编排器按任务边界组装上下文。
7. `Evidence` 必须能追溯到用户完成的成果；简历更新只能引用已有证据。
8. 所有 ATS/HR 副作用**先形成 `ActionIntent`**。策略判定、审批版本检查与幂等键通过后，才调用 `ExternalChannelPort`。
9. 事件日志记录每次状态变化、交接、审批和外部回执，供 UI 与故障恢复使用。

维护或验证原型时，违反以上任一条的改动直接拒绝。未来如需调整边界，须先满足顶部治理门，再随获选 ADR 有意同步修订本文件和相应架构文档，然后才可改代码。

---

## 3. 模块布局

```
apps/
  api/                  HTTP composition root 与路由（Fastify + Zod）
  web/                  自研 Career Command Center（React + Vite）
packages/
  contracts/            跨进程 Zod 契约（可被前后端共享）
  core/                 领域模型、状态机、策略、端口、编排器
  infrastructure/       SQLite、多协议运行时、DSH SDK 适配器、Mock 通道
config/
  runtime.providers.json  Provider 目录，不保存密钥
  career-policy.json      版本化职业策略
tests/
  core/                 领域与边界测试
  integration/          数据库恢复、API 与黄金闭环测试
docs/
  README.md                         现役、门控与历史文档导航
  product/README.md                 Draft Business Baseline 索引
  framework/README.md               Future framework evaluation protocol（门控）
  archive/prototype-v0/README.md    原型历史归档
  superpowers/plans/                历史计划记录
```

`config/` 下的 JSON 是运维侧启动配置，**不是业务数据载体**；不要把运行时业务状态写进配置文件。

---

## 4. 常用命令

```bash
pnpm install          # 安装依赖
pnpm dev              # 同时启动 API(4317) 与 Web(4318)
pnpm verify           # typecheck + test + build（提交前必须通过）
pnpm typecheck        # tsc --noEmit -p tsconfig.json
pnpm test             # vitest run
pnpm test:watch       # vitest 监听
pnpm build            # pnpm -r --if-present build
pnpm start            # 生产构建后本地预览
```

端口约定：API `127.0.0.1:4317`，Web `127.0.0.1:4318`。`CAREER_DB_PATH` 可覆盖职业数据库路径。

---

## 5. 编码规范

### TypeScript
- 严格模式全开，禁止 `any`、禁止 `@ts-ignore`、禁止非空断言 `!` 除非有注释说明为什么安全。
- `noUncheckedIndexedAccess` 下，`array[i]` 是 `T | undefined`，必须处理 undefined，不要用 `array[i]!` 绕过。
- `exactOptionalPropertyTypes` 下，可选属性不能赋 `undefined`，要么不写该字段要么给值。
- 导入路径带 `.ts` 扩展名（`allowImportingTsExtensions` 已开），例如 `import { foo } from './foo.ts'`。
- ESM 项目，使用 `import type` 区分类型导入。

### 领域层（packages/core）
- 不导入 Fastify、SQLite、better-sqlite3、DeepSeek Harness 或 React。
- 状态变更走 `assertMissionTransition` 校验，不直接给 `mission.stage` 赋值跳过校验。
- 新增领域实体必须在 `model.ts` 定义接口并在 `WorkspaceState` 中声明。

### 前端（apps/web）
- 自研 React，不复用 DeepSeek Harness 或其它通用 Agent 框架的 Web UI。
- 样式用 CSS tokens（`styles/tokens.css` + `styles/global.css`），不引入 Tailwind 等运行时 CSS 框架。
- 桌面与移动浏览器无横向溢出，主要操作可交互是验收门槛。

### API（apps/api）
- 路由只做契约校验和委托，业务判断全部在编排器。
- 错误映射用稳定错误码：`VALIDATION_ERROR`(400)、`STATE_CONFLICT`(409)、`INTERNAL_ERROR`(500)。
- 密钥只从进程环境变量读取，**绝不写入 JSON 配置或代码**。

---

## 6. 测试要求

- 任何改动 `packages/core` 或 `packages/contracts` 的 PR 必须伴随或更新对应 `tests/core/` 测试。
- 改动 API 路由或编排器接线的，必须通过 `tests/integration/`。
- 提交前 `pnpm verify` 必须全绿：typecheck + test + build。
- 不引入依赖网络或模型密钥的测试进默认套件；需要网络的放单独脚本并默认跳过。

---

## 7. 第三方代码与参考借鉴

在获顶部治理门授权的未来开发开始前，不引入外部代码、框架或依赖。对当前原型的维护，如确有必要借鉴外部代码：

1. **本仓库内**：先读 `packages/`、`apps/` 是否已有等价实现，避免重复造轮子。
2. **外部参考**：原型时期的 `MadsLorentzen/ai-job-search` 审计记录在[历史归档](./docs/archive/prototype-v0/README.md)中；它不授权改变当前编排器、运行时端口或状态源。
3. **GitHub 检索**：引入任何外部代码前，确认其许可证兼容、记录采纳边界到 `docs/`，并优先以等价 TypeScript 移植而非引入异构运行时。
4. **当前原型维护禁止项**：不允许外部参考替换 `CareerOrchestrator`、`CareerRuntimePort`、SQLite 状态源或审批/幂等机制。

---

## 8. 第三方模型 Provider 边界

`runtime.providers.json` 不保存密钥；每个远程 Provider 只声明 `protocol`、`baseUrl`、`model`、`apiKeyEnv` 和超时，密钥仅在进程启动时从环境变量解析。

支持的协议各有独立适配器：
- `chat-completions` → `POST {baseUrl}/chat/completions`
- `responses` → `POST {baseUrl}/responses`
- `anthropic-messages` → `POST {baseUrl}/v1/messages`
- `deterministic` → 本地无密钥比赛模式

**第三方模型只能返回**：岗位分析、证据任务、简历候选和 HR 回复草稿。**它不能**直接推进 Mission、确认事实、批准动作或调用 ATS/HR 通道。`GET /api/system/config` 可查当前协议与 Provider 状态，但响应不泄露密钥值或密钥环境变量名。

未设置第三方 Provider 时系统继续使用 `local-demo`。

---

## 9. 策略与审批

`config/career-policy.json` 保存版本化职业策略，服务启动时用 Zod 校验并编译为有优先级的失败关闭规则：

- 绿色内部动作可执行；
- 黄色授权范围外动作暂停；
- 红色敏感/承诺动作始终确认；
- 黑色造假动作禁止；
- 未命中规则时**失败关闭**（默认拒绝）。

投递与包含薪资/到岗承诺的 HR 回复先生成动作意图，再经策略与用户审批后执行。外部副作用使用幂等键；状态版本阻止重复或过期审批。

---

## 10. 提交与验收门槛

第一门槛是**无模型密钥的黄金闭环**，而不是先验证任意 Agent 聊天：

1. 创建 Career Mission，已有确认档案与分层记忆。
2. 求职执行 Agent 完成岗位五层判断并识别证据缺口。
3. 编排器把短期证据任务交给面试成长 Agent。
4. 用户提交真实成果，证据写入记忆，任务交回优势简历 Agent。
5. 优势简历 Agent 生成只引用已确认事实的新版本。
6. 投递形成黄色动作意图，用户批准后受控 Mock ATS 只执行一次。
7. HR 薪资/到岗问题形成红色动作意图，用户批准后发送草稿。
8. 关闭并重启进程后，Mission、审批、消息、证据和事件仍可恢复。

验收必须同时满足：领域测试通过、HTTP 全链路通过、SQLite 重启恢复通过、重复审批无重复副作用、TypeScript 严格检查通过、生产构建通过、桌面与移动浏览器无横向溢出且主要操作可交互。

**提交前自检清单：**
- [ ] `pnpm verify` 全绿
- [ ] 没有违反第 2 节调用边界
- [ ] 密钥未进 JSON 或代码
- [ ] 新增领域实体有对应测试
- [ ] 若引入外部代码，已记录采纳边界与许可证

---

## 11. 回退策略

若 DeepSeek Harness 或第三方模型任一关键项失败，按以下顺序回退，保证产品可靠性与通用框架成熟度解耦：

1. 立即切回 `DeterministicCareerRuntime`，比赛展示与产品状态不受影响。
2. 如需真实模型，选 Chat Completions / Responses / Anthropic Messages，实现仍统一在 `CareerRuntimePort` 后。
3. DSH 插件只做可观测性或开发辅助；在 SDK 验证稳定前，不允许插件成为业务必需依赖。
