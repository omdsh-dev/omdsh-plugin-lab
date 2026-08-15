import { mkdtempSync } from 'node:fs'
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
})
