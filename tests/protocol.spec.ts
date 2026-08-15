import { describe, expect, it } from 'vitest'
import { uploadPayload, type ExperienceEventV1, type LocalExperienceRecord } from '../src/protocol.js'

function event(): ExperienceEventV1 {
  return {
    schemaVersion: 1,
    type: 'feedback.submitted',
    eventId: 'event-1',
    occurredAt: 2,
    participantId: 'participant',
    trial: {
      id: 'trial-1',
      plugin: { moduleName: '@example/plugin', version: '1.0.0' },
      startedAt: 1,
      durationMs: 1,
    },
    environment: {
      dshVersion: '0.1.0',
      nodeVersion: 'v24',
      platform: 'darwin',
      arch: 'arm64',
      locale: 'zh-CN',
      profileLabel: 'test',
    },
    signals: {
      loaderHealth: 'active',
      assistantMessages: 1,
      turnsStarted: 1,
      turnsCompleted: 1,
      toolCalls: 2,
      toolErrors: 0,
      agentErrors: 0,
      processCrashes: 0,
      firstReplyMs: 100,
    },
    feedback: { outcome: 'worked', retention: 'keep', note: 'local note' },
    sharing: { transcript: 'none', noteIncluded: false },
  }
}

describe('uploadPayload()', () => {
  it('removes the local note from ordinary anonymous sharing', () => {
    const record: LocalExperienceRecord = { event: event(), requestedShare: true, shareNote: false }
    const payload = uploadPayload(record)
    expect(payload.feedback).toEqual({ outcome: 'worked', retention: 'keep' })
    expect(payload.sharing).toEqual({ transcript: 'none', noteIncluded: false })
  })

  it('keeps the note only when explicitly requested', () => {
    const record: LocalExperienceRecord = { event: event(), requestedShare: true, shareNote: true }
    expect(uploadPayload(record).feedback.note).toBe('local note')
  })
})
