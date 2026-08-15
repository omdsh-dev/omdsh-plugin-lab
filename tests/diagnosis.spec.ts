import { describe, expect, it } from 'vitest'
import { diagnoseExperience } from '../src/diagnosis.js'
import type { ExperienceEventV1 } from '../src/protocol.js'

function event(loaderHealth: ExperienceEventV1['signals']['loaderHealth']): ExperienceEventV1 {
  return {
    schemaVersion: 1,
    type: 'feedback.submitted',
    eventId: 'e',
    occurredAt: 2,
    participantId: 'p',
    trial: { id: 't', plugin: { moduleName: 'plugin' }, startedAt: 1, durationMs: 1 },
    environment: {
      dshVersion: 'v', nodeVersion: 'n', platform: 'darwin', arch: 'arm64', locale: 'zh', profileLabel: 'p',
    },
    signals: {
      loaderHealth,
      assistantMessages: 0,
      turnsStarted: 0,
      turnsCompleted: 0,
      toolCalls: 0,
      toolErrors: 0,
      agentErrors: 0,
      processCrashes: 0,
    },
    feedback: { outcome: 'failed', retention: 'remove' },
    sharing: { transcript: 'none', noteIncluded: false },
  }
}

describe('diagnoseExperience()', () => {
  it('turns missing Loader attribution into an actionable result', () => {
    expect(diagnoseExperience(event('missing'), 'failed', 'remove')).toEqual({
      headline: '目标插件没有出现在当前 DSH Loader 中。',
      actions: ['检查它是否已安装进当前 Profile，以及 Bundle patch 是否插入了插件行。'],
    })
  })

  it('does not overclaim causality when a trial is only partial', () => {
    const diagnosis = diagnoseExperience(event('active'), 'partial', 'unsure')
    expect(diagnosis.headline).toContain('证据还不足')
    expect(diagnosis.actions.join(' ')).toContain('没有产生完整 Assistant 回复')
  })
})
