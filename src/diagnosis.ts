import type { ExperienceEventV1, RetentionIntent, TrialOutcome } from './protocol.js'

export interface Diagnosis {
  readonly headline: string
  readonly actions: readonly string[]
}

export function diagnoseExperience(
  event: ExperienceEventV1,
  outcome: TrialOutcome,
  retention: RetentionIntent,
): Diagnosis {
  const actions: string[] = []
  if (event.signals.loaderHealth === 'missing') {
    return {
      headline: '目标插件没有出现在当前 DSH Loader 中。',
      actions: ['检查它是否已安装进当前 Profile，以及 Bundle patch 是否插入了插件行。'],
    }
  }
  if (event.signals.loaderHealth === 'failed') {
    return {
      headline: '目标插件已被发现，但加载失败。',
      actions: ['优先检查构建产物、依赖版本和插件启动日志，再判断插件能力。'],
    }
  }
  if (event.signals.loaderHealth !== 'active' && event.signals.loaderHealth !== 'unknown') {
    actions.push(`插件当前 Loader 状态为 ${event.signals.loaderHealth}，建议状态稳定后复测。`)
  }
  if (event.signals.assistantMessages === 0) {
    actions.push('本次 Trial 没有产生完整 Assistant 回复，反馈更可能指向启动或运行链路。')
  }
  if (event.signals.toolErrors > 0) {
    actions.push(`记录到 ${event.signals.toolErrors} 次 Tool 错误；后续报告应优先附错误码，不必附会话正文。`)
  }
  if (event.signals.agentErrors > 0) {
    actions.push(`记录到 ${event.signals.agentErrors} 次 Agent 运行错误，建议先排除框架或模型侧异常。`)
  }
  if (outcome === 'worked' && retention === 'keep') {
    return {
      headline: '这次试用形成了明确的正向保留信号。',
      actions: actions.length > 0 ? actions : ['可以用一个相似任务复测，确认体验不是偶然。'],
    }
  }
  if (outcome === 'failed') {
    return {
      headline: '这次试用没有完成目标。',
      actions: actions.length > 0 ? actions : ['建议用相同任务在干净 Profile 中复测，再决定卸载或报告问题。'],
    }
  }
  return {
    headline: '这次试用提供了部分价值，但证据还不足以直接保留或淘汰。',
    actions: actions.length > 0 ? actions : ['建议固定同一任务再试一次，或与不安装插件的基线结果比较。'],
  }
}
