/** Zero-content plugin health and user-confirmed feedback loop for DeepSeek Harness. */

import type { Context } from '@deepseek-ai/cordis'
import type { CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands'
import z from '@deepseek-ai/schemastery'
import { createAgentAssessmentTool } from './agent-tool.js'
import { healthText, probeLoaderHealth, type LoaderLike } from './health.js'
import {
  JOIN_USAGE, parseJoinTarget, parseReceiptId, parseStartInput, parseVerdict,
  RESULT_USAGE, RETEST_USAGE, START_USAGE,
} from './input.js'
import {
  FEEDBACK_SCHEMA_VERSION,
  type ExperienceVerdict,
  type FeedbackEventV2,
  type HealthStatus,
  type IngestReceipt,
  type LocalFeedbackRecord,
  type SafeExperienceAssessment,
  type TrialPluginRef,
} from './protocol.js'
import { FeedbackStore } from './storage.js'
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

function health(ctx: Context, plugin: TrialPluginRef): HealthStatus {
  return probeLoaderHealth(ctx.get('loader') as LoaderLike | undefined, plugin.moduleName)
}

function assessment(status: HealthStatus): SafeExperienceAssessment {
  return { health: status, experience: 'unknown', userConfirmationRequired: true }
}

function verdictText(verdict: ExperienceVerdict): string {
  if (verdict === 'good') return '好用'
  if (verdict === 'mixed') return '一般'
  return '不好用'
}

function renderReceipt(receipt: IngestReceipt): string[] {
  const lines = ['已发送严格最小化反馈。']
  if (receipt.caseId !== undefined) lines.push(`问题回执：${receipt.caseId}`)
  if (receipt.similarReports !== undefined) lines.push(`同类反馈：${receipt.similarReports} 条。`)
  if (receipt.status !== undefined) lines.push(`状态：${receipt.status}。`)
  if (receipt.recommendedVersion !== undefined) lines.push(`建议版本：${receipt.recommendedVersion}。`)
  if (receipt.trackingUrl !== undefined) lines.push(`聚合跟踪：${receipt.trackingUrl}`)
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

  // Optional capability: headless command-only tests still work, while a normal
  // rc.6 Agent runtime receives the closed, zero-argument assessment tool.
  ctx.inject(['tools'], toolCtx => {
    toolCtx.tools.register(createAgentAssessmentTool(agent => assessTrial(agentSessionKey(agent))))
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
      text: [
        `试用已开始：${input.plugin.moduleName}${input.plugin.version === undefined ? '' : `#${input.plugin.version}`}`,
        `运行状态：${healthText(health(ctx, input.plugin))}`,
        '完成后由你选择“好用 / 一般 / 不好用”；Agent 不会读取会话或日志替你判断。',
      ].join('\n'),
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
    const state = trials.get(sessionKey(invocation))
    const result = assessTrial(sessionKey(invocation))
    return {
      kind: 'success',
      text: state === undefined
        ? `${healthText(result.health)}：当前没有选中的插件试用。`
        : [
          `插件：${state.plugin.moduleName}`,
          `运行状态：${healthText(result.health)}`,
          '主观体验：未确认。探活没有读取日志、会话、异常或文件。',
        ].join('\n'),
    }
  }

  const submitResult = (invocation: CommandInvocation): CommandResult => {
    const key = sessionKey(invocation)
    const state = trials.get(key)
    if (state === undefined) return { kind: 'error', text: `没有进行中的插件试用。先运行 ${START_USAGE}` }
    let verdict: ExperienceVerdict
    try {
      verdict = parseVerdict(invocation.rawInput)
    } catch {
      return { kind: 'error', text: RESULT_USAGE }
    }
    const event: FeedbackEventV2 = {
      schemaVersion: FEEDBACK_SCHEMA_VERSION,
      type: 'feedback.signal',
      eventId: crypto.randomUUID(),
      plugin: state.plugin,
      health: health(ctx, state.plugin),
      experience: verdict,
      source: 'user_confirmed',
      ...state.retestOfReceiptId === undefined ? {} : { retestOfReceiptId: state.retestOfReceiptId },
    }
    store.append({ event, requestedShare: false })
    trials.delete(key)
    return {
      kind: 'success',
      text: [
        `运行状态：${healthText(event.health)}`,
        `主观体验：${verdictText(verdict)}（由你确认）`,
        `已只保存到本机：${store.eventsPath}`,
        '记录只有公开插件 ID/版本、状态枚举和你的选择；不含日志、会话、时间、环境或稳定身份。',
        '运行 /omdsh-join latest 才会发送屏幕上这组有限字段。',
      ].join('\n'),
    }
  }

  const joinFollowUp = async (invocation: CommandInvocation): Promise<CommandResult> => {
    if (uploader === undefined) {
      return { kind: 'error', text: '结构化分享未启用；当前不会产生反馈网络请求。' }
    }
    let target: string
    try {
      target = parseJoinTarget(invocation.rawInput)
    } catch {
      return { kind: 'error', text: JOIN_USAGE }
    }
    const eventId = target === 'latest' ? store.latestLocalRecord()?.event.eventId : target
    if (eventId === undefined || store.record(eventId) === undefined) {
      return { kind: 'error', text: '找不到这条本地体验记录。请先确认一次结果。' }
    }
    const existing = store.latestReceipts().find(receipt => receipt.eventId === eventId)
    if (existing !== undefined) return { kind: 'success', text: renderReceipt(existing).join('\n') }
    store.requestShare(eventId)
    try {
      const receipt = (await uploader.flushPending(eventId)).get(eventId)
      if (receipt === undefined) return { kind: 'error', text: '反馈服务没有返回回执。' }
      store.markSeen(receipt)
      return { kind: 'success', text: renderReceipt(receipt).join('\n') }
    } catch {
      return { kind: 'success', text: '已加入本地发送队列；网络恢复后只会重试同一份有限字段。' }
    }
  }

  const inbox = async (invocation: CommandInvocation): Promise<CommandResult> => {
    if (uploader !== undefined) {
      try {
        await uploader.refreshReceipts()
      } catch {
        // No logging: network failures remain an unavailable state, not diagnostic data.
      }
    }
    const unread = store.unreadReceipts()
    if (unread.length === 0) return { kind: 'success', text: 'Plugin Lab 暂无新的处理进展。' }
    const lines = [`Plugin Lab 有 ${unread.length} 条新进展：`]
    for (const receipt of unread) {
      lines.push('', ...renderReceipt(receipt))
      if (invocation.rawInput.trim() !== '--peek') store.markSeen(receipt)
    }
    return { kind: 'success', text: lines.join('\n') }
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
      'Agent：零参数工具只返回 health、experience=unknown、userConfirmationRequired=true。',
      '可发送字段：schemaVersion、type、随机单次 eventId、公开插件 ID/版本、health、experience、source。',
      '绝不读取或发送：日志、异常、堆栈、崩溃指纹、Prompt、回复、Tool 数据、文件、路径、环境、时间、用户/设备/安装/Session ID。',
      '网络仍会自然暴露传输元数据，因此本插件不宣称匿名；服务端必须禁止持久化 IP、User-Agent 和请求体日志。',
      `本地最小化数据：${store.dataDir}`,
    ].join('\n'),
  })

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
    description: '由用户确认主观体验；只保存在本机',
    input: { hint: '<good|mixed|bad>' },
    recordInput: false,
    handler: submitResult,
  })
  ctx.commands.register({
    name: 'omdsh-feedback',
    description: '兼容入口：由用户确认主观体验；只保存在本机',
    input: { hint: '<good|mixed|bad>' },
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
