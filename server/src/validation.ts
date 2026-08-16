import type {
  AcceptedEvent, ExperienceVerdict, FeedbackCategory, HealthStatus,
} from './types.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const MODULE = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u
const VERSION = /^[0-9A-Za-z][0-9A-Za-z.+_-]{0,63}$/u
const HEALTH = new Set<HealthStatus>(['ok', 'unavailable', 'error', 'unknown'])
const EXPERIENCE = new Set<ExperienceVerdict>(['good', 'mixed', 'bad'])
const CATEGORY = new Set<FeedbackCategory>([
  'installation', 'startup', 'invocation', 'compatibility',
  'reliability', 'performance', 'result_quality', 'general',
])
const SUMMARY_SOURCE = new Set(['template', 'user_edited'])
const MAX_SUMMARY = 320
const CATEGORY_TEXT: Record<FeedbackCategory, string> = {
  installation: '安装', startup: '启动', invocation: '调用', compatibility: '兼容性',
  reliability: '稳定性', performance: '性能', result_quality: '结果质量', general: '整体体验',
}
const HEALTH_TEXT: Record<HealthStatus, string> = {
  ok: '运行正常', unavailable: '当前不可用', error: '运行错误', unknown: '状态未知',
}
const EXPERIENCE_TEXT: Record<ExperienceVerdict, string> = {
  good: '好用', mixed: '一般', bad: '不好用',
}
const SUMMARY_GUARDS: readonly RegExp[] = [
  /\r|\n|[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u,
  /\b(?:https?:\/\/|www\.)/iu,
  /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/u,
  /(?:^|[\s'"`])(?:\/(?:Users|home|private|tmp|var|etc)\/|[A-Za-z]:[\\/])/u,
  /\b(?:sk|ghp|github_pat|AKIA|AIza)[-_A-Za-z0-9]{8,}\b/u,
  /\b(?:token|secret|password|api[ _-]?key)\s*[:=]/iu,
  /(?:\bat\s+\S+\s*\(|(?:Error|Exception):|\.[cm]?[jt]sx?:\d+(?::\d+)?|\.py:\d+)/u,
  /^\[?\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/u,
]

function row(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`)
  }
  return value as Record<string, unknown>
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], name: string): void {
  const extras = Object.keys(value).filter(key => !allowed.includes(key))
  if (extras.length > 0) throw new TypeError(`${name} contains unsupported fields`)
}

function string(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${name} is invalid`)
  return value
}

function fixedSummary(
  moduleName: string,
  version: string | undefined,
  health: HealthStatus,
  experience: ExperienceVerdict,
  category: FeedbackCategory,
): string {
  const coordinate = `${moduleName}${version === undefined ? '' : `#${version}`}`
  return `${coordinate} 在“${CATEGORY_TEXT[category]}”方面：${HEALTH_TEXT[health]}，用户体验为“${EXPERIENCE_TEXT[experience]}”。`
}

function summary(value: unknown): string {
  const normalized = string(value, 'summary').normalize('NFC').trim().replace(/[\t ]+/gu, ' ')
  if (normalized.length === 0 || normalized.length > MAX_SUMMARY) throw new TypeError('summary is invalid')
  if (SUMMARY_GUARDS.some(pattern => pattern.test(normalized))) throw new TypeError('summary is unsafe')
  if (normalized !== value) throw new TypeError('summary must be normalized')
  return normalized
}

/** Reject, rather than strip, every field outside the selected protocol alphabet. */
export function acceptEvent(value: unknown): AcceptedEvent {
  const root = row(value, 'event')
  const schemaVersion = root.schemaVersion
  if (schemaVersion !== 3 && schemaVersion !== 4) throw new TypeError('unsupported event schema')
  exactKeys(root, schemaVersion === 4 ? [
    'schemaVersion', 'type', 'eventId', 'plugin', 'health', 'experience', 'category',
    'summary', 'summarySource', 'source', 'retestOfReceiptId',
  ] : [
    'schemaVersion', 'type', 'eventId', 'plugin', 'health', 'experience', 'category',
    'source', 'retestOfReceiptId',
  ], 'event')
  if (root.type !== 'feedback.signal') {
    throw new TypeError('unsupported event schema')
  }
  const eventId = string(root.eventId, 'eventId')
  if (!UUID.test(eventId)) throw new TypeError('eventId is invalid')

  const plugin = row(root.plugin, 'plugin')
  exactKeys(plugin, ['moduleName', 'version'], 'plugin')
  const moduleName = string(plugin.moduleName, 'plugin.moduleName')
  if (moduleName.length > 214 || !MODULE.test(moduleName)) throw new TypeError('plugin.moduleName is invalid')
  const version = plugin.version === undefined ? undefined : string(plugin.version, 'plugin.version')
  if (version !== undefined && !VERSION.test(version)) throw new TypeError('plugin.version is invalid')

  if (!HEALTH.has(root.health as HealthStatus)) throw new TypeError('health is invalid')
  if (!EXPERIENCE.has(root.experience as ExperienceVerdict)) throw new TypeError('experience is invalid')
  if (!CATEGORY.has(root.category as FeedbackCategory)) throw new TypeError('category is invalid')
  if (root.source !== 'user_confirmed') throw new TypeError('source is invalid')
  const health = root.health as HealthStatus
  const experience = root.experience as ExperienceVerdict
  const category = root.category as FeedbackCategory
  const template = fixedSummary(moduleName, version, health, experience, category)
  const acceptedSummary = schemaVersion === 4 ? summary(root.summary) : template
  const summarySource = schemaVersion === 4 ? string(root.summarySource, 'summarySource') : 'template'
  if (!SUMMARY_SOURCE.has(summarySource)) throw new TypeError('summarySource is invalid')
  if (summarySource === 'template' && acceptedSummary !== template) {
    throw new TypeError('template summary does not match finite fields')
  }
  const retestOfReceiptId = root.retestOfReceiptId === undefined
    ? undefined
    : string(root.retestOfReceiptId, 'retestOfReceiptId')
  if (retestOfReceiptId !== undefined && !UUID.test(retestOfReceiptId)) {
    throw new TypeError('retestOfReceiptId is invalid')
  }

  return {
    schemaVersion,
    eventId,
    pluginModule: moduleName,
    ...version === undefined ? {} : { pluginVersion: version },
    health,
    experience,
    category,
    summary: acceptedSummary,
    summarySource: summarySource as 'template' | 'user_edited',
    source: 'user_confirmed',
    ...retestOfReceiptId === undefined ? {} : { retestOfReceiptId },
  }
}
