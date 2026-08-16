import type {
  ExperienceVerdict, FeedbackCategory, FeedbackEventV3, HealthStatus, TrialPluginRef,
} from './protocol.js'

const CATEGORY_TEXT: Record<FeedbackCategory, string> = {
  installation: '安装',
  startup: '启动',
  invocation: '调用',
  compatibility: '兼容性',
  reliability: '稳定性',
  performance: '性能',
  result_quality: '结果质量',
  general: '整体体验',
}

const HEALTH_TEXT: Record<HealthStatus, string> = {
  ok: '运行正常',
  unavailable: '当前不可用',
  error: '运行错误',
  unknown: '状态未知',
}

const VERDICT_TEXT: Record<ExperienceVerdict, string> = {
  good: '好用',
  mixed: '一般',
  bad: '不好用',
}

export function categoryText(category: FeedbackCategory): string {
  return CATEGORY_TEXT[category]
}

export function verdictText(verdict: ExperienceVerdict): string {
  return VERDICT_TEXT[verdict]
}

/** Agent-facing recommendation derived without conversation, logs, or free text. */
export function suggestedCategory(health: HealthStatus): FeedbackCategory {
  if (health === 'unavailable') return 'startup'
  if (health === 'error') return 'reliability'
  return 'general'
}

export function fixedSummary(
  plugin: TrialPluginRef,
  health: HealthStatus,
  experience: ExperienceVerdict,
  category: FeedbackCategory,
): string {
  const coordinate = `${plugin.moduleName}${plugin.version === undefined ? '' : `#${plugin.version}`}`
  return `${coordinate} 在“${CATEGORY_TEXT[category]}”方面：${HEALTH_TEXT[health]}，用户体验为“${VERDICT_TEXT[experience]}”。`
}

/** Every readable preview line is derived from the exact closed upload packet. */
export function renderUploadPreview(event: FeedbackEventV3): string[] {
  return [
    `脱敏 Summary：${fixedSummary(event.plugin, event.health, event.experience, event.category)}`,
    '发送时只会上传生成这句 Summary 所需的有限枚举；不会附带本地任务、对话、Prompt、回复、日志或文件。',
    '点击“确认发送这份回执”前不会产生网络请求。',
  ]
}
