import type { Agent } from '@deepseek-ai/dsh-agent'
import { describe, expect, it } from 'vitest'
import { createAgentAssessmentTool, createAgentPrepareTool, createAgentPreviewTool } from '../src/agent-tool.js'
import { latestAssistantAnchor } from '../src/client/message-anchor.js'
import { probeLoaderHealth } from '../src/health.js'
import {
  FEEDBACK_CATEGORIES, uploadPayload, type FeedbackEventV3, type LocalFeedbackRecord,
} from '../src/protocol.js'
import { fixedSummary, suggestedCategory } from '../src/summary.js'

function event(eventId = crypto.randomUUID()): FeedbackEventV3 {
  return {
    schemaVersion: 3,
    type: 'feedback.signal',
    eventId,
    plugin: { moduleName: '@example/plugin', version: '1.0.0' },
    health: 'ok',
    experience: 'good',
    category: 'general',
    source: 'user_confirmed',
  }
}

describe('task-agnostic summary privacy invariants', () => {
  it('uses the local packet byte-for-byte as the upload packet', () => {
    const packet = event()
    const record: LocalFeedbackRecord = { event: packet, requestedShare: true }
    expect(uploadPayload(record)).toBe(packet)
    expect(Object.keys(uploadPayload(record)).sort()).toEqual([
      'category', 'eventId', 'experience', 'health', 'plugin', 'schemaVersion', 'source', 'type',
    ])
  })

  it('maps Host lifecycle states without reading plugin content', () => {
    const loader = (state: number) => ({
      entries: () => [{ options: { name: '@example/plugin' }, fiber: { state } }],
    })
    expect(probeLoaderHealth(loader(2), '@example/plugin')).toBe('ok')
    expect(probeLoaderHealth(loader(3), '@example/plugin')).toBe('error')
    expect(probeLoaderHealth(loader(1), '@example/plugin')).toBe('unavailable')
    expect(probeLoaderHealth(undefined, '@example/plugin')).toBe('unknown')
    expect(probeLoaderHealth({ entries: () => [] }, '@example/plugin')).toBe('unavailable')
    expect(probeLoaderHealth({ entries: () => { throw new Error('CANARY_SECRET') } }, '@example/plugin'))
      .toBe('unknown')
  })

  it('gives the Agent a closed zero-argument and closed enum-only contract', async () => {
    const tool = createAgentAssessmentTool(() => ({
      plugin: { moduleName: '@example/plugin', version: '1.0.0' },
      health: 'ok', experience: 'unknown', feedbackCategories: FEEDBACK_CATEGORIES,
      suggestedCategory: 'general', analysisScope: 'plugin_identity_and_host_state_only',
      summaryIsTemplateOnly: true, userConfirmationRequired: true,
    }))
    expect(tool.parameters).toEqual({
      type: 'object', properties: {}, required: [], additionalProperties: false,
    })
    expect(tool.output.schema).toMatchObject({ type: 'object', additionalProperties: false })
    const result = await tool.execute({}, {
      agent: undefined,
      arguments: {},
    } as never)
    expect(result).toEqual({
      plugin: { moduleName: '@example/plugin', version: '1.0.0' },
      health: 'ok', experience: 'unknown', feedbackCategories: FEEDBACK_CATEGORIES,
      suggestedCategory: 'general', analysisScope: 'plugin_identity_and_host_state_only',
      summaryIsTemplateOnly: true, userConfirmationRequired: true,
    })
    await expect(tool.execute({ reason: 'CANARY_SECRET' }, {
      agent: undefined,
      arguments: { reason: 'CANARY_SECRET' },
    } as never)).rejects.toThrow('accepts no arguments')
  })

  it('cannot derive subjective experience when no user verdict exists', () => {
    const tool = createAgentAssessmentTool((_agent: Agent | undefined) => ({
      health: 'error', experience: 'unknown', feedbackCategories: FEEDBACK_CATEGORIES,
      suggestedCategory: 'reliability', analysisScope: 'plugin_identity_and_host_state_only',
      summaryIsTemplateOnly: true, userConfirmationRequired: true,
    }))
    expect(JSON.stringify(tool.output.schema)).not.toContain('good')
    expect(JSON.stringify(tool.output.schema)).not.toContain('bad')
  })

  it('lets the Agent suggest a category from Host status only', () => {
    expect(suggestedCategory('unavailable')).toBe('startup')
    expect(suggestedCategory('error')).toBe('reliability')
    expect(suggestedCategory('ok')).toBe('general')
    expect(suggestedCategory('unknown')).toBe('general')
  })

  it('anchors the lightweight UI without returning Assistant content', () => {
    const base = {
      kind: 'assistant' as const,
      seq: 9,
      time: 1234,
      turn: 2,
      step: 1,
      messageId: 'reply-id',
    }
    const first = latestAssistantAnchor([{
      ...base,
      blocks: [{ kind: 'text', text: 'CANARY_PRIVATE_PROMPT' }],
    }] as never)
    const second = latestAssistantAnchor([{
      ...base,
      blocks: [{ kind: 'tool-call', callId: 'secret', name: 'private_tool', argsRaw: 'TOKEN' }],
    }] as never)
    expect(first).toEqual({ messageId: 'reply-id', time: 1234 })
    expect(second).toEqual(first)
    expect(JSON.stringify(first)).not.toContain('CANARY')
    expect(JSON.stringify(second)).not.toContain('TOKEN')
  })

  it('lets the Agent preview finite categories without accepting or uploading task text', async () => {
    const plugin = { moduleName: '@example/plugin', version: '1.0.0' }
    const tool = createAgentPreviewTool((_agent, experience, category) => ({
      plugin,
      health: 'error',
      experience,
      category,
      summary: fixedSummary(plugin, 'error', experience, category),
      willUpload: false,
      userConfirmationRequired: true,
    }))
    const result = await tool.execute({ experience: 'bad', category: 'reliability' }, {
      agent: undefined, arguments: {},
    } as never)
    expect(result).toMatchObject({
      category: 'reliability', willUpload: false, userConfirmationRequired: true,
    })
    await expect(tool.execute({
      experience: 'bad', category: 'reliability', summary: 'CANARY_PRIVATE_TASK',
    }, { agent: undefined, arguments: {} } as never)).rejects.toThrow('finite enums only')
  })

  it('lets the Agent prepare only a finite local verdict and never grants upload capability', async () => {
    let prepared: string | undefined
    const plugin = { moduleName: '@example/plugin' }
    const tool = createAgentPrepareTool((_agent, experience) => {
      prepared = experience
      return {
        plugin,
        health: 'error',
        experience,
        category: 'reliability',
        summary: fixedSummary(plugin, 'error', experience, 'reliability'),
        willUpload: false,
        userConfirmationRequired: true,
      }
    })
    expect(tool.parameters).toMatchObject({
      properties: { experience: { enum: ['good', 'mixed', 'bad'] } },
      required: ['experience'],
      additionalProperties: false,
    })
    const result = await tool.execute({ experience: 'bad' }, { agent: undefined, arguments: {} } as never)
    expect(prepared).toBe('bad')
    expect(result).toMatchObject({ willUpload: false, userConfirmationRequired: true })
    await expect(tool.execute({ experience: 'bad', summary: 'CANARY_PRIVATE_TASK' }, {
      agent: undefined, arguments: {},
    } as never)).rejects.toThrow('one finite verdict only')
    expect(JSON.stringify(result)).not.toContain('CANARY_PRIVATE_TASK')
  })

  it('satisfies content non-interference for arbitrary private canaries', () => {
    const firstPrivateWorld = 'prompt=ALICE_SECRET; stack=/Users/alice/private.ts'
    const secondPrivateWorld = 'prompt=BOB_SECRET; token=sk-private'
    const first = JSON.stringify(event('00000000-0000-4000-8000-000000000001'))
    const second = JSON.stringify(event('00000000-0000-4000-8000-000000000001'))
    expect(first).toBe(second)
    expect(first).not.toContain(firstPrivateWorld)
    expect(second).not.toContain(secondPrivateWorld)
  })
})
