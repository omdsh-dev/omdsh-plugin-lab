import type { AcceptedEvent } from './types.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

function row(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError(`${name} must be an object`)
  return value as Record<string, unknown>
}

function text(value: unknown, name: string, max = 256): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) throw new TypeError(`${name} must be a non-empty string up to ${max} characters`)
  return value
}

function optionalText(value: unknown, name: string, max = 256): string | undefined {
  return value === undefined ? undefined : text(value, name, max)
}

function count(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer`)
  return value
}

export function acceptEvent(value: unknown): AcceptedEvent {
  const root = row(value, 'event')
  if (root.schemaVersion !== 1 || root.type !== 'feedback.submitted') throw new TypeError('unsupported event schema')
  const eventId = text(root.eventId, 'eventId', 64)
  const participantId = text(root.participantId, 'participantId', 64)
  if (!UUID.test(eventId) || !UUID.test(participantId)) throw new TypeError('eventId and participantId must be UUIDs')
  const trial = row(root.trial, 'trial')
  const plugin = row(trial.plugin, 'trial.plugin')
  const environment = row(root.environment, 'environment')
  const signals = row(root.signals, 'signals')
  const feedback = row(root.feedback, 'feedback')
  const sharing = row(root.sharing, 'sharing')
  if (sharing.transcript !== 'none') throw new TypeError('transcript sharing is not accepted')
  const outcome = feedback.outcome
  const retention = feedback.retention
  if (outcome !== 'worked' && outcome !== 'partial' && outcome !== 'failed') throw new TypeError('invalid outcome')
  if (retention !== 'keep' && retention !== 'unsure' && retention !== 'remove') throw new TypeError('invalid retention')
  const note = sharing.noteIncluded === true ? optionalText(feedback.note, 'feedback.note', 2_000) : undefined
  const pluginVersion = optionalText(plugin.version, 'trial.plugin.version', 64)
  const taskId = optionalText(trial.taskId, 'trial.taskId', 128)
  const retestOfReceiptId = optionalText(trial.retestOfReceiptId, 'trial.retestOfReceiptId', 128)
  return {
    eventId,
    participantId,
    occurredAt: count(root.occurredAt, 'occurredAt'),
    trialId: text(trial.id, 'trial.id', 128),
    pluginModule: text(plugin.moduleName, 'trial.plugin.moduleName', 214),
    ...pluginVersion === undefined ? {} : { pluginVersion },
    ...taskId === undefined ? {} : { taskId },
    ...retestOfReceiptId === undefined ? {} : { retestOfReceiptId },
    dshVersion: text(environment.dshVersion, 'environment.dshVersion', 64),
    outcome,
    retention,
    loaderHealth: text(signals.loaderHealth, 'signals.loaderHealth', 32),
    assistantMessages: count(signals.assistantMessages, 'signals.assistantMessages'),
    toolErrors: count(signals.toolErrors, 'signals.toolErrors'),
    agentErrors: count(signals.agentErrors, 'signals.agentErrors'),
    durationMs: count(trial.durationMs, 'trial.durationMs'),
    ...signals.firstReplyMs === undefined ? {} : { firstReplyMs: count(signals.firstReplyMs, 'signals.firstReplyMs') },
    ...note === undefined ? {} : { note },
  }
}
