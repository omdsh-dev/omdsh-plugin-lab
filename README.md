# Oh My DSH Plugin Lab

Plugin Lab 0.6 是面向 DeepSeek Harness rc.6 的隐私优先“体验回执”。默认只有一个轻量入口 `体验回执`：点开同一张票据即可选择插件、让用户或 Agent 准备反馈、确认发送，并持续查看处理进度。它不是插件格子，也不会自动弹窗或常驻展开。

插件确实参与一次 Agent 回复时，该回复下方还会出现就地 `👍 👎`，但它只是快捷方式，不是第二个常驻入口。Agent 只接收一个安全胶囊：公开插件名、版本和 Host 状态枚举。客户端为摆放按钮只读取最新回复的消息 ID 与时间，不读取回复正文；任何反馈工具都不接收任务、文件或日志。

## 现在的体验

1. 默认只显示一个 `体验回执` 小按钮；未读进展显示数字角标，明确故障或手动选中插件时显示“待反馈”。
2. 点开后可从已安装插件中选择目标。这里仅调用 rc.6 Host 插件清单，读取公开 `moduleName`、启用状态和 Fiber 生命周期枚举，不读取插件配置或内容。
3. 用户可直接点 `👍 👎`，也可明确告诉 Agent“这个插件好用/不好用”。Agent 只能把这一个有限评价交给本地准备工具；用户未表达评价时必须询问，不能根据对话或结果自行猜测。
4. Agent 按 Host 状态固定归类，并在同一张票据中生成发送前预览。Summary 只由公开插件坐标和有限枚举拼成；此时只保存到本机，没有网络请求。
5. 点“修改”后可在原位调整 `好用 / 一般 / 不好用` 和问题大类，Summary 会实时重算；点击“应用修改”才替换本地草稿。插件对象与 Host 状态保持只读，选错对象可“取消并重选”。只有点击“确认发送”，所见有限字段才会发送；确认后 Session 历史新增一条独立“体验回执”卡片。
6. 同一入口长期保留本地草稿、等待发送、聚合、公开跟进、修复和复测状态。默认只显示最近 3 条紧凑进度；单条 Summary 和完整历史都由用户按需展开。后端达到聚合阈值后才创建 GitHub Issue。

普通 Agent/模型调用错误、网络错误或“缺少 API Key”不会被自动归因给插件，因为它们不能证明插件本身故障。`体验回执` 入口仍保持可用，但不会据此自动生成差评。

Agent 的“分析”不是自由阅读：工具输入必须为空，输出只有插件公开坐标、Host 状态、建议大类和允许的枚举。没有模型 API Key 时，固定规则建议与完整回执流程仍然可用。

```mermaid
flowchart LR
  A["一个常驻入口 · 体验回执"] --> B["选择已安装插件"]
  B --> C["Host 无日志探活"]
  C --> D{"如何表达体验？"}
  D -->|"用户点击"| E["👍 / 👎"]
  D -->|"用户明确告诉 Agent"| F["Agent 准备有限评价"]
  E --> G["本机固定模板预览"]
  F --> G
  G -->|"修改或取消"| G
  G -->|"用户确认发送"| H["有限枚举包"]
  H --> I["后端聚合"]
  I -->|"达到阈值"| J["GitHub 聚合 Issue"]
  J --> K["同一入口查看修复与复测进度"]
```

Agent 可能已经拥有当前任务的正常会话上下文，但 Plugin Lab 工具不接受这些内容作为参数，也不读 Session 事件。客户端只用消息 ID 和时间把按钮挂到正确回复，不读取内容块。建议只由 Host 状态确定；主观体验由用户点击，并在 Summary 预览中再次确认。

## 安装开发版本

```sh
pnpm install
pnpm pack:release
dsh plugin --profile web add ./oh-my-dsh-plugin-lab-0.6.2.tgz
dsh --profile web
```

Plugin Lab 是标准 DSH Bundle：`package.json` 通过 `dsh.bundle.patch` 声明 Host 插件，通过 `dsh.client` 注册一个输入区回执入口和回复下方的上下文快捷操作。插件选择、探活、脱敏预览、确认提交与进度查看都在这一入口中完成。

版本 `0.6.2` 的 Peer 契约从 DSH `0.1.0-rc.6` 起。完整测试会执行真实的 rc.6 打包、安装、Host/Web 启动、Client Loader 注册和卸载。

## 兼容命令与 Agent 工具

这些接口用于市场接入、自动化和排障；普通用户不需要逐个运行。命令默认只返回一到两行，完整数据边界集中在 `/omdsh-privacy`。

| 接口 | 作用 |
|---|---|
| `/omdsh-start <module>[#version]` | 开始单插件试用；不接受任务标签或备注 |
| `/omdsh-probe` | 本地读取当前目标的 Host 生命周期状态 |
| `/omdsh-result <verdict> <category>` | 用户确认体验和大类，生成本地预览 |
| `/omdsh-join <latest\|event-id>` | 用户确认发送已经展示的有限字段 |
| `/omdsh-inbox [--peek]` | 查看本地待确认回执、聚合进展与复测邀请 |
| `/omdsh-retest <receipt-id> <module>[#version]` | 从单条回执开始复测 |
| `/omdsh-status` | 查看本地试用、待发送和未读状态 |
| `/omdsh-privacy` | 显示完整隐私边界 |
| `omdsh_analyze_plugin_experience({})` | Agent 读取安全胶囊和建议大类；输入必须为空 |
| `omdsh_preview_plugin_feedback({experience, category})` | 生成无副作用固定模板预览；不保存、不上传 |
| `omdsh_prepare_plugin_receipt({experience})` | Agent 在用户明确评价后准备/替换本地草稿；不上传 |

`verdict` 只能是 `good / mixed / bad`。`category` 只能是：

```text
installation | startup | invocation | compatibility
reliability | performance | result_quality | general
```

## 精确上传协议

唯一允许上传的数据包为：

```json
{
  "schemaVersion": 3,
  "type": "feedback.signal",
  "eventId": "随机单次 UUID",
  "plugin": {
    "moduleName": "marketplace-public-id",
    "version": "1.2.3"
  },
  "health": "error",
  "experience": "bad",
  "category": "reliability",
  "source": "user_confirmed"
}
```

复测时可以额外出现一个随机、单报告范围的 `retestOfReceiptId`。客户端和服务端拒绝任何其他字段。协议没有 `summary` 自由文本字段；界面和 GitHub 中看到的中文摘要都由上述枚举通过固定模板生成。

不会创建、读取或发送：

- 当前任务、任务标签、Prompt、Assistant 回复正文或 Agent memory；
- stdout、stderr、访问日志、应用日志或 Tool 参数/结果；
- exception、错误码、stack、frame、崩溃指纹；
- 文件、代码、路径、URL、环境变量、配置；
- 用户、账号、设备、安装、Session 等稳定标识；
- 客户端时间、locale、OS、架构、计数或时延；
- 备注、理由、模型自由摘要或其他自由文本。

本地 v3 文件只有：

```text
$DSH_HOME/omdsh-plugin-lab/
  feedback-v3.ndjson
  share-requests-v3.ndjson
  receipts-v3.ndjson
  receipt-seen-v3.ndjson
  draft-discards-v3.ndjson
```

目录权限为 `0700`，文件权限为 `0600`。v3 不读取或补传旧版 `.install-id`、`events.ndjson`、`crashes.ndjson` 或 v2 队列；历史文件不会被自动删除。

网络传输仍会让服务器或中间层观察 IP、请求时间等元数据，因此项目不宣称绝对匿名。生产部署必须关闭代理、网关、WAF、应用和数据库的请求体日志，并不得把 IP/User-Agent 写入业务数据。

完整不变量和攻击测试见 [PRIVACY.md](./PRIVACY.md)。

## 启用中央反馈

Bundle 默认关闭网络发送：

```yaml
- id: omdsh-plugin-lab
  config:
    allowShare: true
    ingestUrl: https://feedback.example.com/v1/experience-events
    authorizationEnv: OMDSH_PLUGIN_LAB_TOKEN
    requestTimeoutMs: 5000
    retryIntervalMs: 30000
```

部署开启发送能力不等于用户同意。每条记录仍要由用户在预览卡上单独点击“确认发送”；`/omdsh-join` 只是兼容入口。拒绝发送不影响插件功能。

## 后端与 GitHub 飞轮

`server/` 提供 Node.js + PostgreSQL 接收器：

- 只接受 schema v3，未知字段 fail closed；
- 请求体上限 1 KiB，错误响应不回显输入或异常；
- 不存 IP、User-Agent、原始请求体或客户端时间；
- 不使用稳定用户 ID，统计口径是“报告数”而非“独立用户数”；
- 按公开插件、版本、health、experience 和 category 聚合；
- 默认同类报告达到 5 条后才创建 GitHub 聚合 Issue；
- GitHub 只接收固定模板和聚合计数，不接收单条反馈、回执 ID或任务信息；
- Follow Token 只关联一条报告，用于返回修复与复测状态。

生产环境需要：

```text
DATABASE_URL
PUBLIC_BASE_URL
FOLLOW_SECRET
ADMIN_TOKEN
```

可选 GitHub 配置：

```text
GITHUB_TOKEN=<具有目标仓库 Issues 写权限的 token>
GITHUB_REPOSITORY=omdsh-dev/omdsh-plugin-lab
GITHUB_REPORT_THRESHOLD=5
```

## 验证

```sh
pnpm test:all
```

验证覆盖闭合 Schema、Agent 探活/准备工具、任务内容 canary、单入口选择、修改/取消、两阶段确认、回执进度、Client 真实点击、服务端未知字段拒绝、PostgreSQL v3 列审计、GitHub 固定模板、聚合阈值、回执/复测，以及真实 DSH rc.6 安装与启动生命周期。
