import { describe, expect, it } from 'vitest'
import { parseFeedbackInput, parseStartInput } from '../src/input.js'

describe('trial command input', () => {
  it('parses a scoped module, version and task id', () => {
    expect(parseStartInput(' @example/dsh-plugin#0.3.1 repo-search-v1 ')).toEqual({
      plugin: { moduleName: '@example/dsh-plugin', version: '0.3.1' },
      taskId: 'repo-search-v1',
    })
  })

  it('rejects an absent target', () => {
    expect(() => parseStartInput(' ')).toThrow('/omdsh-start')
  })
})

describe('feedback command input', () => {
  it('keeps notes local unless explicitly shared', () => {
    expect(parseFeedbackInput('worked keep --share 很省时间')).toEqual({
      outcome: 'worked',
      retention: 'keep',
      note: '很省时间',
      share: true,
      shareNote: false,
      dryRun: false,
    })
  })

  it('makes --share-note imply sharing', () => {
    expect(parseFeedbackInput('partial unsure --share-note 排序不清楚')).toMatchObject({
      share: true,
      shareNote: true,
      note: '排序不清楚',
    })
  })

  it('requires a note when --share-note is chosen', () => {
    expect(() => parseFeedbackInput('failed remove --share-note')).toThrow('non-empty note')
  })

  it('rejects unknown structured choices', () => {
    expect(() => parseFeedbackInput('great maybe')).toThrow('/omdsh-feedback')
  })
})
