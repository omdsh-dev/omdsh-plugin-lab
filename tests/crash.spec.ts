import { describe, expect, it } from 'vitest'
import { runtimeCrashSignal, sanitizeCrashFrame } from '../src/crash.js'

describe('privacy-preserving crash signatures', () => {
  it('keeps a package-relative top frame and removes message, function and machine path', () => {
    const error = Object.assign(new TypeError('secret prompt and user content'), { code: 'ERR_PLUGIN_STATE' })
    error.stack = [
      'TypeError: secret prompt and user content',
      '    at privateCustomerFunction (file:///Users/alice/project/node_modules/@vendor/plugin/dist/index.js:42:7)',
      '    at /Users/alice/project/private-file.ts:9:1',
    ].join('\n')
    const signal = runtimeCrashSignal(error, 'uncaughtException')
    expect(signal).toMatchObject({
      name: 'TypeError', code: 'ERR_PLUGIN_STATE', origin: 'uncaughtException',
      frame: 'node_modules/@vendor/plugin/dist/index.js:42:7',
    })
    expect(signal.fingerprint).toMatch(/^[0-9a-f]{20}$/u)
    const encoded = JSON.stringify(signal)
    expect(encoded).not.toContain('secret prompt')
    expect(encoded).not.toContain('privateCustomerFunction')
    expect(encoded).not.toContain('/Users/alice')
  })

  it('normalizes application and Node built-in frames without exposing directories', () => {
    expect(sanitizeCrashFrame('Error\n    at run (file:///private/work/src/plugin.ts:8:3)'))
      .toBe('<app>/plugin.ts:8:3')
    expect(sanitizeCrashFrame('Error\n    at node:internal/process/task_queues:95:5'))
      .toBe('node:internal/process/task_queues:95:5')
  })

  it('produces a stable fingerprint for the same structural crash', () => {
    const first = new Error('one message')
    first.stack = 'Error: one message\n    at run (/tmp/a/node_modules/plugin/dist/index.js:1:2)'
    const second = new Error('different private message')
    second.stack = 'Error: different private message\n    at other (/different/root/node_modules/plugin/dist/index.js:1:2)'
    expect(runtimeCrashSignal(first, 'unhandledRejection').fingerprint)
      .toBe(runtimeCrashSignal(second, 'unhandledRejection').fingerprint)
  })

  it('drops free-form error names and codes instead of treating them as diagnostics', () => {
    const error = Object.assign(new Error('private'), {
      name: 'Customer 123 secret',
      code: 'raw customer value',
    })
    expect(runtimeCrashSignal(error, 'uncaughtException')).toMatchObject({ name: 'Error' })
    expect(runtimeCrashSignal(error, 'uncaughtException')).not.toHaveProperty('code')
  })
})
