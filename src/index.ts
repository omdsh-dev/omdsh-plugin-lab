/** Consent-first plugin trial feedback loop for DeepSeek Harness. */

import { createRequire } from 'node:module'
import type { Context } from '@deepseek-ai/cordis'
import type { CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import z from '@deepseek-ai/schemastery'
import { diagnoseExperience } from './diagnosis.js'
import {
  FEEDBACK_USAGE, JOIN_USAGE, parseFeedbackInput, parseResultInput, parseStartInput,
  RESULT_USAGE, RETEST_USAGE, retentionForOutcome, START_USAGE,
} from './input.js'
import {
  EXPERIENCE_SCHEMA_VERSION,
  type ExperienceEventV1,
  type IngestReceipt,
  type LoaderHealth,
  type LocalExperienceRecord,
  type TrialMetrics,
  type TrialPluginRef,
} from './protocol.js'
import { ExperienceStore } from './storage.js'
import { ExperienceUploader } from './uploader.js'

export const name = 'omdsh-plugin-lab'
export const inject = ['commands', 'sessions']

const require = createRequire(import.meta.url)

function dshVersion(): string {
  try {
    return (require('@deepseek-ai/dsh-session/package.json') as { version: string }).version
  } catch {
    return 'unknown'
  }
}

export interface Config {
  readonly dataDir?: string
  readonly ingestUrl?: string
  readonly allowAnonymousShare?: boolean
  readonly authorizationEnv?: string
  readonly profileLabel?: string
  readonly requestTimeoutMs?: number
  readonly retryIntervalMs?: number
}

export const Config: z<Config> = z.object({
  dataDir: z.string(),
  ingestUrl: z.string(),
  allowAnonymousShare: z.boolean().default(false),
  authorizationEnv: z.string().default('OMDSH_PLUGIN_LAB_TOKEN'),
  profileLabel: z.string().default('default'),
  requestTimeoutMs: z.number().default(5_000),
  retryIntervalMs: z.number().default(30_000),
})

interface MutableMetrics {
  assistantMessages: number
  turnsStarted: number
  turnsCompleted: number
  toolCalls: number
  toolErrors: number
  agentErrors: number
  firstReplyMs?: number
  lastTurnReason?: string
}

interface TrialState {
  readonly trialId: string
  readonly plugin: TrialPluginRef
  readonly taskId?: string
  readonly retestOfReceiptId?: string
  readonly startedAt: number
  readonly startSeq: number
  readonly loaderHealthAtStart: LoaderHealth
  readonly metrics: MutableMetrics
}

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    'omdsh/trial-started': {
      trialId: string
      plugin: TrialPluginRef
      taskId?: string
      retestOfReceiptId?: string
      startedAt: number
      loaderHealth: LoaderHealth
    }
    'omdsh/feedback-recorded': {
      eventId: string
      trialId: string
      outcome: 'worked' | 'partial' | 'failed'
      retention: 'keep' | 'unsure' | 'remove'
      requestedShare: boolean
      noteShared: boolean
    }
  }
}

function emptyMetrics(): MutableMetrics {
  return {
    assistantMessages: 0,
    turnsStarted: 0,
    turnsCompleted: 0,
    toolCalls: 0,
    toolErrors: 0,
    agentErrors: 0,
  }
}

function snapshotMetrics(metrics: MutableMetrics): TrialMetrics {
  return {
    assistantMessages: metrics.assistantMessages,
    turnsStarted: metrics.turnsStarted,
    turnsCompleted: metrics.turnsCompleted,
    toolCalls: metrics.toolCalls,
    toolErrors: metrics.toolErrors,
    agentErrors: metrics.agentErrors,
    ...metrics.firstReplyMs === undefined ? {} : { firstReplyMs: metrics.firstReplyMs },
    ...metrics.lastTurnReason === undefined ? {} : { lastTurnReason: metrics.lastTurnReason },
  }
}

function reasonKind(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || !('kind' in value)) return undefined
  return typeof value.kind === 'string' ? value.kind : undefined
}

function observe(state: TrialState, event: SessionEvent): void {
  if (event.seq <= state.startSeq) return
  switch (event.type) {
    case 'turn/start':
      state.metrics.turnsStarted += 1
      return
    case 'turn/end':
      state.metrics.turnsCompleted += 1
      state.metrics.lastTurnReason = reasonKind(event.data.reason) ?? 'unknown'
      return
    case 'assistant/message':
      state.metrics.assistantMessages += 1
      state.metrics.firstReplyMs ??= Math.max(0, event.time - state.startedAt)
      return
    case 'tool/call':
      state.metrics.toolCalls += 1
      return
    case 'tool/result':
      if (event.data.error !== undefined) state.metrics.toolErrors += 1
      return
    default:
      return
  }
}

const FIBER_PHASE: Record<number, LoaderHealth> = {
  0: 'pending',
  1: 'loading',
  2: 'active',
  3: 'failed',
  4: 'unknown',
  5: 'unloading',
}

interface LoaderEntryLike {
  readonly disabled?: boolean
  readonly options?: { readonly name?: string; readonly group?: boolean }
  readonly fiber?: { readonly state?: number }
}

interface LoaderLike {
  entries(): Iterable<LoaderEntryLike>
}

function loaderHealth(ctx: Context, moduleName: string): LoaderHealth {
  const loader = ctx.get('loader') as LoaderLike | undefined
  if (loader === undefined || typeof loader.entries !== 'function') return 'unknown'
  const matches = [...loader.entries()].filter(entry => {
    const name = entry.options?.name
    return entry.options?.group !== true
      && (name === moduleName || name?.startsWith(`${moduleName}/`) === true)
  })
  if (matches.length === 0) return 'missing'
  if (matches.every(entry => entry.disabled === true)) return 'disabled'
  const phases = matches.filter(entry => entry.disabled !== true)
    .map(entry => entry.fiber?.state === undefined ? 'unknown' : FIBER_PHASE[entry.fiber.state] ?? 'unknown')
  if (phases.includes('active')) return 'active'
  if (phases.includes('failed')) return 'failed'
  return phases[0] ?? 'unknown'
}

function renderReceipt(receipt: IngestReceipt): string[] {
  const lines = ['已匿名加入跟进。']
  if (receipt.caseId !== undefined) lines.push(`问题回执：${receipt.caseId}`)
  if (receipt.similarReports !== undefined) lines.push(`相似反馈：${receipt.similarReports} 条。`)
  if (receipt.status !== undefined) lines.push(`状态：${receipt.status}。`)
  if (receipt.recommendedVersion !== undefined) lines.push(`建议版本：${receipt.recommendedVersion}。`)
  if (receipt.message !== undefined) lines.push(receipt.message)
  if (receipt.trackingUrl !== undefined) lines.push(`跟踪地址：${receipt.trackingUrl}`)
  return lines
}

function validateConfig(config: Config): Required<Omit<Config, 'dataDir' | 'ingestUrl'>> & Pick<Config, 'dataDir' | 'ingestUrl'> {
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
    allowAnonymousShare: config.allowAnonymousShare ?? false,
    authorizationEnv,
    profileLabel: config.profileLabel ?? 'default',
    requestTimeoutMs,
    retryIntervalMs,
  }
}

export function apply(ctx: Context, rawConfig: Config): void {
  const config = validateConfig(rawConfig)
  const store = new ExperienceStore(config.dataDir)
  const uploader = config.allowAnonymousShare && config.ingestUrl !== undefined
    ? new ExperienceUploader(store, {
      ingestUrl: config.ingestUrl,
      authorizationEnv: config.authorizationEnv,
      requestTimeoutMs: config.requestTimeoutMs,
    })
    : undefined
  const trials = new Map<string, TrialState>()

  const sessionKey = (session: Session): string => String(session.id)

  const adopt = (session: Session): void => {
    let state: TrialState | undefined
    for (const event of session.events) {
      if (event.type === 'omdsh/trial-started') {
        state = {
          trialId: event.data.trialId,
          plugin: event.data.plugin,
          ...event.data.taskId === undefined ? {} : { taskId: event.data.taskId },
          ...event.data.retestOfReceiptId === undefined ? {} : { retestOfReceiptId: event.data.retestOfReceiptId },
          startedAt: event.data.startedAt,
          startSeq: event.seq,
          loaderHealthAtStart: event.data.loaderHealth,
          metrics: emptyMetrics(),
        }
      } else if (event.type === 'omdsh/feedback-recorded' && state?.trialId === event.data.trialId) {
        state = undefined
      } else if (state !== undefined) {
        observe(state, event)
      }
    }
    if (state !== undefined) trials.set(sessionKey(session), state)
  }

  ctx.on('session/created', adopt)
  ctx.on('session/disposed', session => { trials.delete(sessionKey(session)) })
  ctx.on('session/event', (session, event) => {
    const state = trials.get(sessionKey(session))
    if (state !== undefined) observe(state, event)
  })
  ctx.on('agent/error', ({ agent }) => {
    const state = trials.get(sessionKey(agent.session))
    if (state !== undefined) state.metrics.agentErrors += 1
  })
  for (const session of ctx.sessions.list()) adopt(session)

  const beginTrial = (
    invocation: CommandInvocation,
    input: ReturnType<typeof parseStartInput>,
    retestOfReceiptId?: string,
  ): CommandResult => {
    const key = sessionKey(invocation.agent.session)
    if (trials.has(key)) {
      return { kind: 'error', text: '当前 Session 已有进行中的 Trial；请先提交体验结果，或换一个 Session。' }
    }
    const startedAt = Date.now()
    const health = loaderHealth(ctx, input.plugin.moduleName)
    const event = invocation.agent.session.append('omdsh/trial-started', {
      trialId: crypto.randomUUID(),
      plugin: input.plugin,
      ...input.taskId === undefined ? {} : { taskId: input.taskId },
      ...retestOfReceiptId === undefined ? {} : { retestOfReceiptId },
      startedAt,
      loaderHealth: health,
    })
    trials.set(key, {
      trialId: event.data.trialId,
      plugin: input.plugin,
      ...input.taskId === undefined ? {} : { taskId: input.taskId },
      ...retestOfReceiptId === undefined ? {} : { retestOfReceiptId },
      startedAt,
      startSeq: event.seq,
      loaderHealthAtStart: health,
      metrics: emptyMetrics(),
    })
    return {
      kind: 'success',
      text: [
        `Trial 已开始：${input.plugin.moduleName}${input.plugin.version === undefined ? '' : `#${input.plugin.version}`}`,
        `Loader 状态：${health}`,
        retestOfReceiptId === undefined
          ? '现在正常使用 Agent。完成后在最新回复旁选择结果；默认只保存在本机。'
          : `这是回执 ${retestOfReceiptId} 的修复复测；完成后请选择结果。`,
      ].join('\n'),
      sourceEventSeq: event.seq,
    }
  }

  const startTrial = (invocation: CommandInvocation): CommandResult => {
    try {
      return beginTrial(invocation, parseStartInput(invocation.rawInput))
    } catch (error: unknown) {
      return { kind: 'error', text: error instanceof Error ? error.message : START_USAGE }
    }
  }

  const startRetest = (invocation: CommandInvocation): CommandResult => {
    const [receiptId, ...trialParts] = invocation.rawInput.trim().split(/\s+/u).filter(Boolean)
    if (receiptId === undefined || trialParts.length === 0) return { kind: 'error', text: RETEST_USAGE }
    try {
      return beginTrial(invocation, parseStartInput(trialParts.join(' ')), receiptId)
    } catch (error: unknown) {
      return { kind: 'error', text: error instanceof Error ? error.message : RETEST_USAGE }
    }
  }

  const submitFeedback = async (invocation: CommandInvocation): Promise<CommandResult> => {
    const state = trials.get(sessionKey(invocation.agent.session))
    if (state === undefined) {
      return { kind: 'error', text: `没有进行中的 Trial。先运行 ${START_USAGE}` }
    }
    let input: ReturnType<typeof parseFeedbackInput>
    try {
      input = parseFeedbackInput(invocation.rawInput)
    } catch (error: unknown) {
      return { kind: 'error', text: error instanceof Error ? error.message : FEEDBACK_USAGE }
    }
    if (input.share && uploader === undefined) {
      return {
        kind: 'error',
        text: '匿名分享未启用。当前不会上传任何数据；请移除 --share，或由部署者同时配置 allowAnonymousShare 和 ingestUrl。',
      }
    }
    const currentHealth = loaderHealth(ctx, state.plugin.moduleName)
    const event: ExperienceEventV1 = {
      schemaVersion: EXPERIENCE_SCHEMA_VERSION,
      type: 'feedback.submitted',
      eventId: crypto.randomUUID(),
      occurredAt: Date.now(),
      participantId: store.participantId(),
      trial: {
        id: state.trialId,
        plugin: state.plugin,
        ...state.taskId === undefined ? {} : { taskId: state.taskId },
        startedAt: state.startedAt,
        durationMs: Math.max(0, Date.now() - state.startedAt),
        ...state.retestOfReceiptId === undefined ? {} : { retestOfReceiptId: state.retestOfReceiptId },
      },
      environment: {
        dshVersion: dshVersion(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        locale: Intl.DateTimeFormat().resolvedOptions().locale,
        profileLabel: config.profileLabel,
      },
      signals: {
        ...snapshotMetrics(state.metrics),
        loaderHealth: currentHealth === 'unknown' ? state.loaderHealthAtStart : currentHealth,
      },
      feedback: {
        outcome: input.outcome,
        retention: input.retention,
        ...input.note === undefined ? {} : { note: input.note },
      },
      sharing: {
        transcript: 'none',
        noteIncluded: input.shareNote,
      },
    }
    const record: LocalExperienceRecord = {
      event,
      requestedShare: input.share,
      shareNote: input.shareNote,
    }
    if (input.dryRun) {
      const preview = input.shareNote || event.feedback.note === undefined
        ? event
        : { ...event, feedback: { outcome: event.feedback.outcome, retention: event.feedback.retention } }
      return {
        kind: 'success',
        text: `预览：不会保存或上传。\n${JSON.stringify(preview, null, 2)}`,
      }
    }
    store.append(record)
    const feedbackEvent = invocation.agent.session.append('omdsh/feedback-recorded', {
      eventId: event.eventId,
      trialId: state.trialId,
      outcome: input.outcome,
      retention: input.retention,
      requestedShare: input.share,
      noteShared: input.shareNote,
    })
    trials.delete(sessionKey(invocation.agent.session))

    const diagnosis = diagnoseExperience(event, input.outcome, input.retention)
    const lines = [diagnosis.headline, ...diagnosis.actions.map(action => `- ${action}`)]
    lines.push(`已保存到本机：${store.eventsPath}`)
    lines.push('记录不包含 Prompt、会话正文、Tool 参数/结果或工作目录。')
    if (input.note !== undefined && !input.shareNote) lines.push('文字备注仅保存在本机。')
    if (input.share && uploader !== undefined) {
      try {
        const receipts = await uploader.flushPending(event.eventId)
        const receipt = receipts.get(event.eventId)
        if (receipt !== undefined) {
          lines.push(...renderReceipt(receipt))
          store.markSeen(receipt)
        }
      } catch (error: unknown) {
        lines.push(`匿名上传暂时失败，已留在本地队列并会重试：${error instanceof Error ? error.message : String(error)}`)
      }
    } else {
      lines.push('本次只保存在本机。选择“加入跟进”或运行 /omdsh-join latest 才会匿名发送结构化体感。')
    }
    return { kind: 'success', text: lines.join('\n'), sourceEventSeq: feedbackEvent.seq }
  }

  const submitResult = async (invocation: CommandInvocation): Promise<CommandResult> => {
    let input: ReturnType<typeof parseResultInput>
    try {
      input = parseResultInput(invocation.rawInput)
    } catch (error: unknown) {
      return { kind: 'error', text: error instanceof Error ? error.message : RESULT_USAGE }
    }
    const note = input.note === undefined ? '' : ` ${input.note}`
    return await submitFeedback({
      ...invocation,
      rawInput: `${input.outcome} ${retentionForOutcome(input.outcome)}${note}`,
    })
  }

  const joinFollowUp = async (invocation: CommandInvocation): Promise<CommandResult> => {
    if (uploader === undefined) {
      return {
        kind: 'error',
        text: '匿名跟进未启用。部署者需要同时配置 allowAnonymousShare 和 ingestUrl。',
      }
    }
    const parts = invocation.rawInput.trim().split(/\s+/u).filter(Boolean)
    const target = parts.shift()
    if (target === undefined || parts.some(part => part !== '--share-note')) {
      return { kind: 'error', text: JOIN_USAGE }
    }
    const latestSessionEvent = invocation.agent.session.events.findLast(event => event.type === 'omdsh/feedback-recorded')
    const eventId = target === 'latest'
      ? latestSessionEvent?.data.eventId
      : target
    if (eventId === undefined || store.record(eventId) === undefined) {
      return { kind: 'error', text: '找不到这条本地体验记录。请先提交一次结果。' }
    }
    const existing = store.latestReceipts().find(receipt => receipt.eventId === eventId)
    if (existing !== undefined) return { kind: 'success', text: renderReceipt(existing).join('\n') }
    const shareNote = parts.includes('--share-note')
    store.requestShare(eventId, shareNote)
    try {
      const receipt = (await uploader.flushPending(eventId)).get(eventId)
      if (receipt === undefined) return { kind: 'error', text: '没有生成远端回执，请稍后运行 /omdsh-inbox。' }
      store.markSeen(receipt)
      return { kind: 'success', text: renderReceipt(receipt).join('\n') }
    } catch (error: unknown) {
      return {
        kind: 'success',
        text: `已加入本地发送队列；网络恢复后会自动重试。\n${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  const inbox = async (invocation: CommandInvocation): Promise<CommandResult> => {
    if (uploader !== undefined) {
      try {
        await uploader.refreshReceipts()
      } catch (error: unknown) {
        ctx.logger.warn(`plugin-lab: receipt refresh failed: ${String(error)}`)
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
    const state = trials.get(sessionKey(invocation.agent.session))
    if (state === undefined) {
      return {
        kind: 'success',
        text: [
          '当前没有进行中的 Trial。',
          `待发送匿名记录：${store.pending().length} 条。`,
          `未读处理进展：${store.unreadReceipts().length} 条。`,
        ].join('\n'),
      }
    }
    const metrics = snapshotMetrics(state.metrics)
    return {
      kind: 'success',
      text: [
        `Trial：${state.plugin.moduleName}${state.plugin.version === undefined ? '' : `#${state.plugin.version}`}`,
        `Loader：${loaderHealth(ctx, state.plugin.moduleName)}`,
        `Assistant 回复：${metrics.assistantMessages}`,
        `Tool：${metrics.toolCalls} 次，错误 ${metrics.toolErrors} 次`,
        `Turn：${metrics.turnsCompleted}/${metrics.turnsStarted}`,
        `首回复：${metrics.firstReplyMs === undefined ? '尚未产生' : `${metrics.firstReplyMs} ms`}`,
      ].join('\n'),
    }
  }

  const privacy = (): CommandResult => ({
    kind: 'success',
    text: [
      `匿名分享：${uploader === undefined ? '未启用' : '可由用户逐次通过 --share 触发'}`,
      '默认：仅本地保存。',
      '匿名结构化字段：插件名/版本、DSH/Node/OS、任务 ID、加载状态、时延和错误计数、结果与保留意愿。',
      '永不自动发送：Prompt、回复正文、Tool 参数/结果、cwd、Session ID。',
      '备注默认不发送；只有 --share-note 会发送备注。',
      `本地数据：${store.dataDir}`,
      '结果先用 /omdsh-result 存在本机；/omdsh-join latest 才加入匿名跟进。',
      '发送前也可在 /omdsh-feedback 参数末尾加 --dry-run 查看完整 JSON。',
    ].join('\n'),
  })

  const resetId = (invocation: CommandInvocation): CommandResult => {
    if (invocation.rawInput.trim() !== 'confirm') {
      return { kind: 'error', text: 'Usage: /omdsh-reset-id confirm' }
    }
    store.resetParticipantId()
    return {
      kind: 'success',
      text: '已生成新的 Plugin Lab 匿名 ID。此前已经上传的数据不会因此被远端删除。',
    }
  }

  ctx.commands.register({
    name: 'omdsh-start',
    description: '开始一次有明确目标插件的体验 Trial',
    input: { hint: '<module>[#version] [task-id]' },
    recordInput: false,
    handler: startTrial,
  })
  ctx.commands.register({
    name: 'omdsh-feedback',
    description: '兼容入口：提交结构化插件体感；默认仅本地保存',
    input: { hint: '<worked|partial|failed> <keep|unsure|remove> [flags] [note]' },
    recordInput: false,
    handler: submitFeedback,
  })
  ctx.commands.register({
    name: 'omdsh-result',
    description: '记录这次插件是否做成；只保存在本机',
    input: { hint: '<worked|partial|failed> [note]' },
    recordInput: false,
    handler: submitResult,
  })
  ctx.commands.register({
    name: 'omdsh-join',
    description: '匿名加入相似问题、获取处理回执和后续通知',
    input: { hint: '<latest|event-id> [--share-note]' },
    recordInput: false,
    handler: joinFollowUp,
  })
  ctx.commands.register({
    name: 'omdsh-inbox',
    description: '查看问题确认、修复发布与复测邀请',
    input: { hint: '[--peek]' },
    recordInput: false,
    handler: inbox,
  })
  ctx.commands.register({
    name: 'omdsh-retest',
    description: '从问题回执启动一次修复复测',
    input: { hint: '<receipt-id> <module>[#version] [task-id]' },
    recordInput: false,
    handler: startRetest,
  })
  ctx.commands.register({
    name: 'omdsh-status',
    description: '查看当前 Trial 的无内容运行指标',
    recordInput: false,
    handler: status,
  })
  ctx.commands.register({
    name: 'omdsh-privacy',
    description: '查看 Plugin Lab 的本地存储与分享边界',
    recordInput: false,
    handler: privacy,
  })
  ctx.commands.register({
    name: 'omdsh-reset-id',
    description: '重置 Plugin Lab 自己的匿名安装 ID',
    input: { hint: 'confirm' },
    recordInput: false,
    handler: resetId,
  })

  if (uploader !== undefined) {
    const flush = (): void => {
      void Promise.all([
        uploader.flushPending(),
        uploader.refreshReceipts(),
      ]).catch(error => {
        ctx.logger.warn(`plugin-lab: background exchange failed: ${String(error)}`)
      })
    }
    flush()
    ctx.effect(() => {
      const timer = setInterval(flush, config.retryIntervalMs)
      return () => clearInterval(timer)
    }, 'plugin-lab upload retry')
  }
}

export default { name, inject, Config, apply }
export type * from './protocol.js'
