/** Task-agnostic plugin health and user-confirmed feedback loop for DeepSeek Harness. */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands'
import z from '@deepseek-ai/schemastery'
import { createAgentAssessmentTool, createAgentPreviewTool } from './agent-tool.js'
import { healthText, probeLoaderHealth, type LoaderLike } from './health.js'
import {
  JOIN_USAGE, parseJoinTarget, parseReceiptId, parseResultInput, parseStartInput,
  RESULT_USAGE, RETEST_USAGE, START_USAGE,
} from './input.js'
import {
  FEEDBACK_SCHEMA_VERSION,
  type ExperienceVerdict,
  FEEDBACK_CATEGORIES,
  type FeedbackCategory,
  type FeedbackEventV3,
  type FeedbackPreview,
  type HealthStatus,
  type IngestReceipt,
  type LocalFeedbackRecord,
  type PluginLabPanelAction,
  type PluginLabPanelProbe,
  type SafeExperienceAssessment,
  type TrialPluginRef,
} from './protocol.js'
import { PluginLabPanelService } from './panel-service.js'
import { FeedbackStore } from './storage.js'
import { fixedSummary, renderUploadPreview } from './summary.js'
import { ExperienceUploader } from './uploader.js'

export const name = 'omdsh-plugin-lab'
export const inject = ['commands']

export interface Config {
  readonly dataDir?: string
  readonly ingestUrl?: string
  readonly allowShare?: boolean
  /** Deprecated deployment alias retained only so existing rc.6 configs keep working. */
  readonly allowAnonymousShare?: boolean
  readonly authorizationEnv?: string
  readonly requestTimeoutMs?: number
  readonly retryIntervalMs?: number
}

export const Config: z<Config> = z.object({
  dataDir: z.string(),
  ingestUrl: z.string(),
  allowShare: z.boolean(),
  allowAnonymousShare: z.boolean(),
  authorizationEnv: z.string().default('OMDSH_PLUGIN_LAB_TOKEN'),
  requestTimeoutMs: z.number().default(5_000),
  retryIntervalMs: z.number().default(30_000),
})

interface ResolvedConfig {
  readonly dataDir?: string
  readonly ingestUrl?: string
  readonly allowShare: boolean
  readonly authorizationEnv: string
  readonly requestTimeoutMs: number
  readonly retryIntervalMs: number
}

interface TrialState {
  readonly plugin: TrialPluginRef
  readonly retestOfReceiptId?: string
}

function sessionKey(invocation: Pick<CommandInvocation, 'agent'>): string {
  return String(invocation.agent.session.id)
}

function agentSessionKey(agent: { readonly session: { readonly id: unknown } } | undefined): string | undefined {
  return agent === undefined ? undefined : String(agent.session.id)
}

function agentKey(agent: Agent): string {
  return String(agent.session.id)
}

function health(ctx: Context, plugin: TrialPluginRef): HealthStatus {
  return probeLoaderHealth(ctx.get('loader') as LoaderLike | undefined, plugin.moduleName)
}

function assessment(status: HealthStatus): SafeExperienceAssessment {
  return {
    health: status,
    experience: 'unknown',
    feedbackCategories: FEEDBACK_CATEGORIES,
    summaryIsTemplateOnly: true,
    userConfirmationRequired: true,
  }
}

function renderReceipt(receipt: IngestReceipt): string[] {
  const details = [
    receipt.similarReports === undefined ? undefined : `同类 ${receipt.similarReports} 条`,
    receipt.status,
    receipt.caseId,
  ].filter((value): value is string => value !== undefined)
  const lines = [`已提交${details.length === 0 ? '' : ` · ${details.join(' · ')}`}`]
  if (receipt.recommendedVersion !== undefined) lines.push(`建议版本：${receipt.recommendedVersion}`)
  if (receipt.trackingUrl !== undefined) lines.push(`跟踪：${receipt.trackingUrl}`)
  return lines
}

function validateConfig(config: Config): ResolvedConfig {
  const requestTimeoutMs = config.requestTimeoutMs ?? 5_000
  const retryIntervalMs = config.retryIntervalMs ?? 30_000
  if (!Number.isFinite(requestTimeoutMs) || requestTimeoutMs <= 0) {
    throw new TypeError('plugin-lab: requestTimeoutMs must be a positive finite number')
  }
  if (!Number.isFinite(retryIntervalMs) || retryIntervalMs < 1_000) {
    throw new TypeError('plugin-lab: retryIntervalMs must be at least 1000')
  }
  const authorizationEnv = config.authorizationEnv ?? 'OMDSH_PLUGIN_LAB_TOKEN'
  if (!/^[A-Z_][A-Z0-9_]*$/u.test(authorizationEnv)) {
    throw new TypeError('plugin-lab: authorizationEnv must be an uppercase environment variable name')
  }
  if (config.ingestUrl !== undefined && config.ingestUrl.length > 0) {
    const parsed = new URL(config.ingestUrl)
    if (parsed.protocol !== 'https:' && parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') {
      throw new TypeError('plugin-lab: ingestUrl must use HTTPS (HTTP is allowed only for localhost testing)')
    }
  }
  return {
    ...config.dataDir === undefined ? {} : { dataDir: config.dataDir },
    ...config.ingestUrl === undefined || config.ingestUrl.length === 0 ? {} : { ingestUrl: config.ingestUrl },
    allowShare: config.allowShare ?? config.allowAnonymousShare ?? false,
    authorizationEnv,
    requestTimeoutMs,
    retryIntervalMs,
  }
}

export function apply(ctx: Context, rawConfig: Config): void {
  const config = validateConfig(rawConfig)
  const store = new FeedbackStore(config.dataDir)
  const uploader = config.allowShare && config.ingestUrl !== undefined
    ? new ExperienceUploader(store, {
      ingestUrl: config.ingestUrl,
      authorizationEnv: config.authorizationEnv,
      requestTimeoutMs: config.requestTimeoutMs,
    })
    : undefined
  const trials = new Map<string, TrialState>()

  const assessTrial = (key: string | undefined): SafeExperienceAssessment => {
    const state = key === undefined ? undefined : trials.get(key)
    return assessment(state === undefined ? 'unknown' : health(ctx, state.plugin))
  }

  const previewTrial = (
    key: string | undefined,
    experience: ExperienceVerdict,
    category: FeedbackCategory,
  ): FeedbackPreview => {
    const state = key === undefined ? undefined : trials.get(key)
    if (state === undefined) throw new TypeError('no active Plugin Lab trial')
    const status = health(ctx, state.plugin)
    return {
      plugin: state.plugin,
      health: status,
      experience,
      category,
      summary: fixedSummary(state.plugin, status, experience, category),
      willUpload: false,
      userConfirmationRequired: true,
    }
  }

  const panelProbe = (agent: Agent): PluginLabPanelProbe => {
    const state = trials.get(agentKey(agent))
    const result = assessment(state === undefined ? 'unknown' : health(ctx, state.plugin))
    return {
      active: state !== undefined,
      health: result.health,
      text: state === undefined
        ? '未选择试用插件'
        : `${state.plugin.moduleName} · ${healthText(result.health)}`,
    }
  }

  const recordFeedback = (
    agent: Agent,
    verdict: ExperienceVerdict,
    category: FeedbackCategory,
  ): PluginLabPanelAction => {
    const key = agentKey(agent)
    const state = trials.get(key)
    if (state === undefined) return { ok: false, text: '没有进行中的插件试用。' }
    const event: FeedbackEventV3 = {
      schemaVersion: FEEDBACK_SCHEMA_VERSION,
      type: 'feedback.signal',
      eventId: crypto.randomUUID(),
      plugin: state.plugin,
      health: health(ctx, state.plugin),
      experience: verdict,
      category,
      source: 'user_confirmed',
      ...state.retestOfReceiptId === undefined ? {} : { retestOfReceiptId: state.retestOfReceiptId },
    }
    store.append({ event, requestedShare: false })
    trials.delete(key)
    return { ok: true, text: renderUploadPreview(event).join('\n') }
  }

  const joinFeedback = async (eventId: string | undefined): Promise<PluginLabPanelAction> => {
    if (uploader === undefined) {
      return { ok: false, text: '结构化分享未启用；当前不会产生反馈网络请求。' }
    }
    if (eventId === undefined || store.record(eventId) === undefined) {
      return { ok: false, text: '找不到这条本地体验记录。请先确认一次结果。' }
    }
    const existing = store.latestReceipts().find(receipt => receipt.eventId === eventId)
    if (existing !== undefined) return { ok: true, text: renderReceipt(existing).join('\n') }
    store.requestShare(eventId)
    try {
      const receipt = (await uploader.flushPending(eventId)).get(eventId)
      if (receipt === undefined) return { ok: false, text: '反馈服务没有返回回执。' }
      store.markSeen(receipt)
      return { ok: true, text: renderReceipt(receipt).join('\n') }
    } catch {
      return { ok: true, text: '已加入本地发送队列；网络恢复后只会重试同一份有限字段。' }
    }
  }

  const readInbox = async (markRead: boolean): Promise<string> => {
    if (uploader !== undefined) {
      try {
        await uploader.refreshReceipts()
      } catch {
        // No logging: network failures remain an unavailable state, not diagnostic data.
      }
    }
    const unread = store.unreadReceipts()
    if (unread.length === 0) return '暂无新进展'
    const lines = [`${unread.length} 条新进展`]
    for (const receipt of unread) {
      lines.push('', ...renderReceipt(receipt))
      if (markRead) store.markSeen(receipt)
    }
    return lines.join('\n')
  }

  new PluginLabPanelService(ctx, {
    probe: panelProbe,
    record: recordFeedback,
    join: async agent => {
      const result = await joinFeedback(store.latestLocalRecord()?.event.eventId)
      if (result.ok) {
        await ctx.commands.execute(agent, '/omdsh-history', new AbortController().signal)
      }
      return result
    },
    inbox: async () => readInbox(true),
  })

  // Optional capability: headless command-only tests still work, while a normal
  // rc.6 Agent runtime receives the closed, zero-argument assessment tool.
  ctx.inject(['tools'], toolCtx => {
    toolCtx.tools.register(createAgentAssessmentTool(agent => assessTrial(agentSessionKey(agent))))
    toolCtx.tools.register(createAgentPreviewTool((agent, experience, category) => (
      previewTrial(agentSessionKey(agent), experience, category)
    )))
  })

  const beginTrial = (
    invocation: CommandInvocation,
    input: ReturnType<typeof parseStartInput>,
    retestOfReceiptId?: string,
  ): CommandResult => {
    const key = sessionKey(invocation)
    if (trials.has(key)) {
      return { kind: 'error', text: '当前任务已有进行中的插件试用；请先确认体验结果。' }
    }
    const state: TrialState = {
      plugin: input.plugin,
      ...retestOfReceiptId === undefined ? {} : { retestOfReceiptId },
    }
    trials.set(key, state)
    return {
      kind: 'success',
      text: `正在试用：${input.plugin.moduleName}${input.plugin.version === undefined ? '' : `#${input.plugin.version}`} · ${healthText(health(ctx, input.plugin))}`,
    }
  }

  const startTrial = (invocation: CommandInvocation): CommandResult => {
    try {
      return beginTrial(invocation, parseStartInput(invocation.rawInput))
    } catch {
      return { kind: 'error', text: START_USAGE }
    }
  }

  const startRetest = (invocation: CommandInvocation): CommandResult => {
    const [receiptId, ...pluginParts] = invocation.rawInput.trim().split(/\s+/u).filter(Boolean)
    if (receiptId === undefined || pluginParts.length !== 1) return { kind: 'error', text: RETEST_USAGE }
    try {
      return beginTrial(invocation, parseStartInput(pluginParts[0] ?? ''), parseReceiptId(receiptId))
    } catch {
      return { kind: 'error', text: RETEST_USAGE }
    }
  }

  const probe = (invocation: CommandInvocation): CommandResult => {
    return { kind: 'success', text: panelProbe(invocation.agent).text }
  }

  const submitResult = (invocation: CommandInvocation): CommandResult => {
    let verdict: ExperienceVerdict
    let category: FeedbackCategory
    try {
      const parsed = parseResultInput(invocation.rawInput)
      verdict = parsed.verdict
      category = parsed.category
    } catch {
      return { kind: 'error', text: RESULT_USAGE }
    }
    const result = recordFeedback(invocation.agent, verdict, category)
    return result.ok
      ? { kind: 'success', text: result.text }
      : { kind: 'error', text: `${result.text} 先运行 ${START_USAGE}` }
  }

  const joinFollowUp = async (invocation: CommandInvocation): Promise<CommandResult> => {
    let target: string
    try {
      target = parseJoinTarget(invocation.rawInput)
    } catch {
      return { kind: 'error', text: JOIN_USAGE }
    }
    const eventId = target === 'latest' ? store.latestLocalRecord()?.event.eventId : target
    const result = await joinFeedback(eventId)
    return result.ok ? { kind: 'success', text: result.text } : { kind: 'error', text: result.text }
  }

  const inbox = async (invocation: CommandInvocation): Promise<CommandResult> => {
    return { kind: 'success', text: await readInbox(invocation.rawInput.trim() !== '--peek') }
  }

  const status = (invocation: CommandInvocation): CommandResult => {
    const state = trials.get(sessionKey(invocation))
    const lines = state === undefined
      ? ['当前没有进行中的插件试用。']
      : [
        `插件：${state.plugin.moduleName}${state.plugin.version === undefined ? '' : `#${state.plugin.version}`}`,
        `运行状态：${healthText(health(ctx, state.plugin))}`,
        '主观体验：未确认',
      ]
    lines.push(`待发送记录：${store.pending().length} 条。`, `未读处理进展：${store.unreadReceipts().length} 条。`)
    return { kind: 'success', text: lines.join('\n') }
  }

  const privacy = (): CommandResult => ({
    kind: 'success',
    text: [
      `结构化分享：${uploader === undefined ? '未启用' : '只能由用户逐次运行 /omdsh-join 触发'}`,
      '探活：仅本地读取 DSH Host 的 Loader/Fiber 生命周期枚举，不访问插件对象或网络。',
      'Agent：探活工具零参数；预览工具只接受体验和大类枚举，固定模板预览不会存储或发送。',
      '可发送字段：schemaVersion、type、随机单次 eventId、公开插件 ID/版本、health、experience、category、source。',
      '绝不读取或发送：日志、异常、堆栈、崩溃指纹、Prompt、回复、Tool 数据、文件、路径、环境、时间、用户/设备/安装/Session ID。',
      '网络仍会自然暴露传输元数据，因此本插件不宣称匿名；服务端必须禁止持久化 IP、User-Agent 和请求体日志。',
      `本地最小化数据：${store.dataDir}`,
    ].join('\n'),
  })

  const history = (): CommandResult => {
    const record = store.latestLocalRecord()
    if (record === undefined) return { kind: 'error', text: '没有可记录的插件反馈。' }
    const event = record.event
    const receipt = store.latestReceipts().find(item => item.eventId === event.eventId)
    const suffix = receipt?.status === undefined ? '已提交' : `已提交 · ${receipt.status}`
    return {
      kind: 'success',
      text: `${fixedSummary(event.plugin, event.health, event.experience, event.category)} ${suffix}`,
    }
  }

  ctx.commands.register({
    name: 'omdsh-start',
    description: '开始一次单插件试用；不采集会话内容',
    input: { hint: '<public-module>[#version]' },
    recordInput: false,
    handler: startTrial,
  })
  ctx.commands.register({
    name: 'omdsh-probe',
    description: '一键查看当前插件的无日志运行状态',
    recordInput: false,
    handler: probe,
  })
  ctx.commands.register({
    name: 'omdsh-result',
    description: '由用户确认体验与脱敏大类，生成本地上传预览',
    input: { hint: `<good|mixed|bad> <${FEEDBACK_CATEGORIES.join('|')}>` },
    recordInput: false,
    handler: submitResult,
  })
  ctx.commands.register({
    name: 'omdsh-feedback',
    description: '兼容入口：由用户确认体验与脱敏大类，生成本地上传预览',
    input: { hint: `<good|mixed|bad> <${FEEDBACK_CATEGORIES.join('|')}>` },
    recordInput: false,
    handler: submitResult,
  })
  ctx.commands.register({
    name: 'omdsh-join',
    description: '明确发送已经显示给用户的有限状态字段',
    input: { hint: '<latest|event-id>' },
    recordInput: false,
    handler: joinFollowUp,
  })
  ctx.commands.register({
    name: 'omdsh-inbox',
    description: '查看聚合问题、修复版本与复测邀请',
    input: { hint: '[--peek]' },
    recordInput: false,
    handler: inbox,
  })
  ctx.commands.register({
    name: 'omdsh-retest',
    description: '从问题回执开始一次零内容复测',
    input: { hint: '<receipt-id> <public-module>[#version]' },
    recordInput: false,
    handler: startRetest,
  })
  ctx.commands.register({
    name: 'omdsh-status',
    description: '查看当前试用与本地反馈状态',
    recordInput: false,
    handler: status,
  })
  ctx.commands.register({
    name: 'omdsh-privacy',
    description: '查看零日志数据边界与完整可发送字段',
    recordInput: false,
    handler: privacy,
  })
  ctx.commands.register({
    name: 'omdsh-history',
    description: '内部：在 Session 历史中保留一条已确认的插件反馈卡片',
    recordInput: false,
    handler: history,
  })

  if (uploader !== undefined) {
    const flush = (): void => {
      void Promise.all([uploader.flushPending(), uploader.refreshReceipts()]).catch(() => {
        // Explicitly queued packets remain local; no exception text is logged.
      })
    }
    flush()
    ctx.effect(() => {
      const timer = setInterval(flush, config.retryIntervalMs)
      return () => clearInterval(timer)
    }, 'plugin-lab closed-packet retry')
  }
}

export default { name, inject, Config, apply }
export type * from './protocol.js'
