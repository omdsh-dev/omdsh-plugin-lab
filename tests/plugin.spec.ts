import { mkdtempSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import SessionStore from '@deepseek-ai/dsh-session'
import { describe, expect, it } from 'vitest'
import plugin from '../src/index.js'

describe('DSH plugin integration', () => {
  it('registers the consent-first command flow and records no transcript content', async () => {
    const root = mkdtempSync(join(tmpdir(), 'omdsh-plugin-lab-'))
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(CommandRuntime)
    const pluginFiber = await ctx.plugin(plugin, { dataDir: join(root, 'data'), profileLabel: 'test' })
    const session = ctx.sessions.create()
    const agent = { id: session.id, session } as Agent
    const signal = new AbortController().signal

    const start = await ctx.commands.execute(
      agent,
      '/omdsh-start @example/plugin#1.0.0 task-v1',
      signal,
    )
    expect(start?.result.text).toContain('Trial 已开始')
    session.append('turn/start', { turn: 1 })
    session.append('turn/end', { turn: 1, reason: { kind: 'interrupted' } })

    const feedback = await ctx.commands.execute(
      agent,
      '/omdsh-feedback partial unsure 本地备注',
      signal,
    )
    expect(feedback?.result.text).toContain('只保存在本机')
    expect(feedback?.result.text).toContain('不包含 Prompt')
    const custom = session.events.filter(event => event.type.startsWith('omdsh/'))
    expect(custom.map(event => event.type)).toEqual(['omdsh/trial-started', 'omdsh/feedback-recorded'])
    expect(JSON.stringify(custom)).not.toContain('本地备注')

    const status = await ctx.commands.execute(agent, '/omdsh-status', signal)
    expect(status?.result.text).toContain('当前没有进行中的 Trial')
    await pluginFiber.dispose()
  })

  it('does not treat deployment permission as per-event consent', async () => {
    const root = mkdtempSync(join(tmpdir(), 'omdsh-plugin-lab-'))
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(CommandRuntime)
    const pluginFiber = await ctx.plugin(plugin, {
      dataDir: join(root, 'data'),
      allowAnonymousShare: true,
      ingestUrl: 'http://127.0.0.1:9/events',
      retryIntervalMs: 60_000,
    })
    const session = ctx.sessions.create()
    const agent = { id: session.id, session } as Agent
    const signal = new AbortController().signal
    await ctx.commands.execute(agent, '/omdsh-start plugin', signal)
    const feedback = await ctx.commands.execute(agent, '/omdsh-feedback worked keep', signal)
    expect(feedback?.result.text).toContain('只保存在本机')
    await pluginFiber.dispose()
  })

  it('records locally before the user explicitly joins a follow-up case', async () => {
    let posts = 0
    const server = createServer((request, response) => {
      request.resume()
      request.on('end', () => {
        posts += 1
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({
          receiptId: 'receipt-1', caseId: 'PL-ABCD1234', status: 'received', similarReports: 1,
        }))
      })
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('missing address')
    const root = mkdtempSync(join(tmpdir(), 'omdsh-plugin-lab-'))
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(CommandRuntime)
    const pluginFiber = await ctx.plugin(plugin, {
      dataDir: join(root, 'data'), allowAnonymousShare: true,
      ingestUrl: `http://127.0.0.1:${address.port}/v1/experience-events`, retryIntervalMs: 60_000,
    })
    const session = ctx.sessions.create()
    const agent = { id: session.id, session } as Agent
    const signal = new AbortController().signal
    await ctx.commands.execute(agent, '/omdsh-start plugin', signal)
    const local = await ctx.commands.execute(agent, '/omdsh-result failed', signal)
    expect(local?.result.text).toContain('只保存在本机')
    expect(posts).toBe(0)
    const joined = await ctx.commands.execute(agent, '/omdsh-join latest', signal)
    expect(joined?.result.text).toContain('PL-ABCD1234')
    expect(posts).toBe(1)
    await pluginFiber.dispose()
    await new Promise<void>(resolve => server.close(() => resolve()))
  })

  it('rehydrates an active Trial and all commands across a Host plugin reload', async () => {
    const root = mkdtempSync(join(tmpdir(), 'omdsh-plugin-lab-'))
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(CommandRuntime)
    const config = { dataDir: join(root, 'data'), profileLabel: 'reload-test' }
    const first = await ctx.plugin(plugin, config)
    const session = ctx.sessions.create()
    const agent = { id: session.id, session } as Agent
    const signal = new AbortController().signal
    const commandNames = (await ctx.commands.list(agent)).map(command => command.name)
    expect(commandNames).toEqual(expect.arrayContaining([
      'omdsh-start', 'omdsh-feedback', 'omdsh-result', 'omdsh-join', 'omdsh-inbox',
      'omdsh-retest', 'omdsh-status', 'omdsh-privacy', 'omdsh-reset-id',
    ]))

    await ctx.commands.execute(agent, '/omdsh-start @example/reload#1.0.0 task-reload', signal)
    await first.dispose()
    const second = await ctx.plugin(plugin, config)

    const restored = await ctx.commands.execute(agent, '/omdsh-status', signal)
    expect(restored?.result.text).toContain('Trial：@example/reload#1.0.0')
    const settled = await ctx.commands.execute(agent, '/omdsh-result worked', signal)
    expect(settled?.result.text).toContain('只保存在本机')
    await second.dispose()
  })

  it('records a sanitized process crash without intercepting it and restores it after reload', async () => {
    const root = mkdtempSync(join(tmpdir(), 'omdsh-plugin-lab-'))
    const dataDir = join(root, 'data')
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(CommandRuntime)
    const before = new Set(process.listeners('uncaughtExceptionMonitor'))
    const first = await ctx.plugin(plugin, { dataDir, profileLabel: 'crash-test' })
    const monitor = process.listeners('uncaughtExceptionMonitor').find(listener => !before.has(listener))
    expect(monitor).toBeDefined()
    const session = ctx.sessions.create()
    const agent = { id: session.id, session } as Agent
    const signal = new AbortController().signal
    await ctx.commands.execute(agent, '/omdsh-start @example/crasher#1.0.0 crash-task', signal)

    const crash = Object.assign(new TypeError('secret customer payload'), { code: 'ERR_PLUGIN_CRASH' })
    crash.stack = 'TypeError: secret customer payload\n    at privateFn (file:///Users/private/app/node_modules/@example/crasher/dist/index.js:12:4)'
    ;(monitor as NodeJS.UncaughtExceptionListener)(crash, 'uncaughtException')
    const status = await ctx.commands.execute(agent, '/omdsh-status', signal)
    expect(status?.result.text).toContain('进程崩溃：1 次（TypeError /')
    const journal = readFileSync(join(dataDir, 'crashes.ndjson'), 'utf8')
    expect(journal).toContain('ERR_PLUGIN_CRASH')
    expect(journal).not.toContain('secret customer payload')
    expect(journal).not.toContain('/Users/private')
    expect(journal).not.toContain('privateFn')

    await first.dispose()
    expect(process.listeners('uncaughtExceptionMonitor')).toEqual([...before])
    const second = await ctx.plugin(plugin, { dataDir, profileLabel: 'crash-test' })
    const settled = await ctx.commands.execute(agent, '/omdsh-result failed', signal)
    expect(settled?.result.text).toContain('进程崩溃')
    await second.dispose()

    const stored = readFileSync(join(dataDir, 'events.ndjson'), 'utf8')
    const record = JSON.parse(stored.trim()) as { event: { signals: Record<string, unknown> } }
    expect(record.event.signals).toMatchObject({
      processCrashes: 1,
      crashes: [{
        name: 'TypeError', code: 'ERR_PLUGIN_CRASH',
        frame: 'node_modules/@example/crasher/dist/index.js:12:4',
      }],
    })
    expect(stored).not.toContain('secret customer payload')
    expect(stored).not.toContain('/Users/private')
    expect(stored).not.toContain('privateFn')
  })
})
