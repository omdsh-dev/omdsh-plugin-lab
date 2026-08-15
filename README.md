# Oh My DSH Plugin Lab

Plugin Lab 0.4 是面向 DeepSeek Harness rc.6 的隐私优先插件反馈闭环：Agent 可以探活并准备脱敏大类摘要，用户在上传前看到完整预览并逐次确认，后端只把达到阈值的聚合信号提交到 GitHub。

## 现在的体验

1. `/omdsh-start <plugin>#<version>` 选择公开的插件坐标。
2. 用户或 Agent 运行探活，只得到 `ok / unavailable / error / unknown`。
3. Agent 可以建议“安装、启动、调用、兼容性、稳定性、性能、结果质量、整体体验”之一，但反馈工具不接受任务文本。
4. 用户选择“好用 / 一般 / 不好用”和一个大类。
5. Plugin Lab 在本地生成固定模板，并展示即将上传的全部可读信息；此时没有网络请求。
6. 用户点击“确认并提交”或运行 `/omdsh-join latest` 后，有限枚举包才会发送。
7. 后端按插件、版本、状态、体验和大类聚合；同类报告达到阈值后创建 GitHub Issue，并通过回执邀请复测。

```mermaid
flowchart LR
  A["插件试用"] --> B["Host 无日志探活"]
  B --> C["Agent 建议有限大类"]
  C --> D["用户选择体验和大类"]
  D --> E["本地固定模板预览"]
  E -->|"用户再次确认"| F["发送有限枚举"]
  F --> G["后端聚合"]
  G -->|"达到阈值"| H["GitHub 聚合 Issue"]
  H --> I["修复与复测回执"]
```

Agent 可能已经拥有当前任务的正常会话上下文，但 Plugin Lab 的工具参数和上传协议都没有承载这些内容的字段。Agent 只能从封闭枚举中提出建议；最终分类和主观体验由用户确认。

## 安装开发版本

```sh
pnpm install
pnpm pack:release
dsh plugin --profile web add ./oh-my-dsh-plugin-lab-0.4.0.tgz
dsh --profile web
```

Plugin Lab 是标准 DSH Bundle：`package.json` 通过 `dsh.bundle.patch` 声明 Host 插件，通过 `dsh.client` 提供 Web 探活、结果卡和收件箱。

版本 `0.4.0` 的 Peer 契约从 DSH `0.1.0-rc.6` 起。完整测试会执行真实的 rc.6 打包、安装、Host/Web 启动、Client Loader 注册和卸载。

## 命令与 Agent 工具

| 接口 | 作用 |
|---|---|
| `/omdsh-start <module>[#version]` | 开始单插件试用；不接受任务标签或备注 |
| `/omdsh-probe` | 本地读取当前目标的 Host 生命周期状态 |
| `/omdsh-result <verdict> <category>` | 用户确认体验和大类，生成本地预览 |
| `/omdsh-join <latest\|event-id>` | 用户确认发送已经展示的有限字段 |
| `/omdsh-inbox [--peek]` | 查看聚合问题、修复版本与复测邀请 |
| `/omdsh-retest <receipt-id> <module>[#version]` | 从单条回执开始复测 |
| `/omdsh-status` | 查看本地试用、待发送和未读状态 |
| `/omdsh-privacy` | 显示完整隐私边界 |
| `omdsh_analyze_plugin_experience({})` | Agent 查询状态和允许的大类；输入必须为空 |
| `omdsh_preview_plugin_feedback({experience, category})` | 生成无副作用固定模板预览；不保存、不上传 |

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

- 当前任务、任务标签、Prompt、Assistant 回复或 Agent memory；
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

部署开启发送能力不等于用户同意。每条记录仍要由用户单独确认 `/omdsh-join`；拒绝发送不影响插件功能。

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

验证覆盖闭合 Schema、Agent 探活/预览工具、任务内容 canary、两阶段确认、Client 真实点击、服务端未知字段拒绝、PostgreSQL v3 列审计、GitHub 固定模板、聚合阈值、回执/复测，以及真实 DSH rc.6 安装与启动生命周期。
