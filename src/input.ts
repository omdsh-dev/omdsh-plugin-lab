import type { RetentionIntent, TrialOutcome, TrialPluginRef } from './protocol.js'

export interface StartInput {
  readonly plugin: TrialPluginRef
  readonly taskId?: string
}

export interface FeedbackInput {
  readonly outcome: TrialOutcome
  readonly retention: RetentionIntent
  readonly note?: string
  readonly share: boolean
  readonly shareNote: boolean
  readonly dryRun: boolean
}

export interface ResultInput {
  readonly outcome: TrialOutcome
  readonly note?: string
}

const OUTCOMES = new Set<TrialOutcome>(['worked', 'partial', 'failed'])
const RETENTION = new Set<RetentionIntent>(['keep', 'unsure', 'remove'])

export const START_USAGE = 'Usage: /omdsh-start <module-name>[#version] [task-id]'
export const FEEDBACK_USAGE = 'Usage: /omdsh-feedback <worked|partial|failed> <keep|unsure|remove> [--share] [--share-note] [--dry-run] [note]'
export const RESULT_USAGE = 'Usage: /omdsh-result <worked|partial|failed> [note]'
export const JOIN_USAGE = 'Usage: /omdsh-join <latest|event-id> [--share-note]'
export const RETEST_USAGE = 'Usage: /omdsh-retest <receipt-id> <module-name>[#version] [task-id]'

export function parseStartInput(rawInput: string): StartInput {
  const parts = rawInput.trim().split(/\s+/u).filter(Boolean)
  const pluginSpec = parts[0]
  if (pluginSpec === undefined) throw new TypeError(START_USAGE)
  const hash = pluginSpec.lastIndexOf('#')
  const moduleName = hash > 0 ? pluginSpec.slice(0, hash) : pluginSpec
  const version = hash > 0 ? pluginSpec.slice(hash + 1) : undefined
  if (moduleName.length === 0 || version === '') throw new TypeError(START_USAGE)
  const taskId = parts[1]
  if (parts.length > 2) throw new TypeError(`${START_USAGE}. task-id must not contain spaces.`)
  return {
    plugin: { moduleName, ...version === undefined ? {} : { version } },
    ...taskId === undefined ? {} : { taskId },
  }
}

export function parseFeedbackInput(rawInput: string): FeedbackInput {
  const parts = rawInput.trim().split(/\s+/u).filter(Boolean)
  const outcome = parts.shift()
  const retention = parts.shift()
  if (!OUTCOMES.has(outcome as TrialOutcome) || !RETENTION.has(retention as RetentionIntent)) {
    throw new TypeError(FEEDBACK_USAGE)
  }
  let share = false
  let shareNote = false
  let dryRun = false
  const noteParts: string[] = []
  for (const part of parts) {
    if (part === '--share') share = true
    else if (part === '--share-note') {
      share = true
      shareNote = true
    } else if (part === '--dry-run') dryRun = true
    else noteParts.push(part)
  }
  const note = noteParts.join(' ').trim()
  if (shareNote && note.length === 0) {
    throw new TypeError('--share-note requires a non-empty note')
  }
  return {
    outcome: outcome as TrialOutcome,
    retention: retention as RetentionIntent,
    ...note.length === 0 ? {} : { note },
    share,
    shareNote,
    dryRun,
  }
}

export function parseResultInput(rawInput: string): ResultInput {
  const parts = rawInput.trim().split(/\s+/u).filter(Boolean)
  const outcome = parts.shift()
  if (!OUTCOMES.has(outcome as TrialOutcome)) throw new TypeError(RESULT_USAGE)
  const note = parts.join(' ').trim()
  return {
    outcome: outcome as TrialOutcome,
    ...note.length === 0 ? {} : { note },
  }
}

export function retentionForOutcome(outcome: TrialOutcome): RetentionIntent {
  if (outcome === 'worked') return 'keep'
  if (outcome === 'partial') return 'unsure'
  return 'remove'
}
