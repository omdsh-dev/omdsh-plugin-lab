import { describe, expect, it } from 'vitest'
import { parseJoinTarget, parseReceiptId, parseStartInput, parseVerdict } from '../src/input.js'

describe('closed command inputs', () => {
  it('accepts only a public module and optional bounded version', () => {
    expect(parseStartInput(' @example/dsh-plugin#0.3.0 ')).toEqual({
      plugin: { moduleName: '@example/dsh-plugin', version: '0.3.0' },
    })
    expect(parseStartInput('plugin')).toEqual({ plugin: { moduleName: 'plugin' } })
  })

  it('rejects task labels, paths, urls and whitespace-bearing metadata', () => {
    expect(() => parseStartInput('plugin private-task')).toThrow('/omdsh-start')
    expect(() => parseStartInput('/Users/alice/plugin')).toThrow('/omdsh-start')
    expect(() => parseStartInput('https://example.test/plugin')).toThrow('/omdsh-start')
    expect(() => parseStartInput(' ')).toThrow('/omdsh-start')
  })

  it('accepts only finite user-confirmed verdicts with no notes or flags', () => {
    expect(parseVerdict('good')).toBe('good')
    expect(parseVerdict('mixed')).toBe('mixed')
    expect(parseVerdict('bad')).toBe('bad')
    expect(() => parseVerdict('bad secret-note')).toThrow('/omdsh-result')
    expect(() => parseVerdict('worked')).toThrow('/omdsh-result')
  })

  it('accepts one join target and rejects extra arguments', () => {
    expect(parseJoinTarget('latest')).toBe('latest')
    expect(parseJoinTarget('00000000-0000-4000-8000-000000000001')).toContain('4000')
    expect(() => parseJoinTarget('latest --share-note')).toThrow('/omdsh-join')
    expect(() => parseJoinTarget('private-receipt-label')).toThrow('/omdsh-join')
    expect(parseReceiptId('00000000-0000-4000-8000-000000000001')).toContain('4000')
    expect(() => parseReceiptId('private-receipt-label')).toThrow('/omdsh-retest')
  })
})
