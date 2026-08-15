import type { AcceptedEvent, ExperienceVerdict, HealthStatus } from './types.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const MODULE = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u
const VERSION = /^[0-9A-Za-z][0-9A-Za-z.+_-]{0,63}$/u
const HEALTH = new Set<HealthStatus>(['ok', 'unavailable', 'error', 'unknown'])
const EXPERIENCE = new Set<ExperienceVerdict>(['good', 'mixed', 'bad'])

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

/** Reject, rather than strip, every field outside the strict v2 alphabet. */
export function acceptEvent(value: unknown): AcceptedEvent {
  const root = row(value, 'event')
  exactKeys(root, [
    'schemaVersion', 'type', 'eventId', 'plugin', 'health', 'experience', 'source', 'retestOfReceiptId',
  ], 'event')
  if (root.schemaVersion !== 2 || root.type !== 'feedback.signal') {
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
  if (root.source !== 'user_confirmed') throw new TypeError('source is invalid')
  const retestOfReceiptId = root.retestOfReceiptId === undefined
    ? undefined
    : string(root.retestOfReceiptId, 'retestOfReceiptId')
  if (retestOfReceiptId !== undefined && !UUID.test(retestOfReceiptId)) {
    throw new TypeError('retestOfReceiptId is invalid')
  }

  return {
    eventId,
    pluginModule: moduleName,
    ...version === undefined ? {} : { pluginVersion: version },
    health: root.health as HealthStatus,
    experience: root.experience as ExperienceVerdict,
    source: 'user_confirmed',
    ...retestOfReceiptId === undefined ? {} : { retestOfReceiptId },
  }
}
