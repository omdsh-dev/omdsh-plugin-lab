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
import type { PluginLabPanelService } from '../src/panel-service.js'

async function runtime(config: Parameters<typeof plugin.apply>[1]) {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(CommandRuntime)
  const fiber = await ctx.plugin(plugin, config)
  const session = ctx.sessions.create()
  const agent = { id: session.id, session } as Agent
  return { ctx, fiber, session, agent, signal: new AbortController().signal }
}

describe('DSH strict feedback integration', () => {
  it('registers one-click health and records only the closed v3 category packet', async () => {
    const root = mkdtempSync(join(tmpdir(), 'omdsh-plugin-lab-'))
    const dataDir = join(root, 'data')
    const { ctx, fiber, agent, signal } = await runtime({ dataDir })

    const commandNames = (await ctx.commands.list(agent)).map(command => command.name)
    expect(commandNames).toEqual(expect.arrayContaining([
      'omdsh-start', 'omdsh-probe', 'omdsh-result', 'omdsh-join',
      'omdsh-inbox', 'omdsh-retest', 'omdsh-status', 'omdsh-privacy',
    ]))
    expect(commandNames).not.toContain('omdsh-reset-id')

    await ctx.commands.execute(agent, '/omdsh-start @example/plugin#1.0.0', signal)
    const health = await ctx.commands.execute(agent, '/omdsh-probe', signal)
    expect(health?.result.text).toContain('暂时无法判断')
    expect(health?.result.text).toBe('@example/plugin · 暂时无法判断')

    const feedback = await ctx.commands.execute(agent, '/omdsh-result bad reliability', signal)
    expect(feedback?.result.text).toContain('稳定性')
    expect(feedback?.result.text).toContain('不好用')
    expect(feedback?.result.text).toContain('不含当前任务、对话或日志')
    expect(feedback?.result.text).not.toContain(dataDir)
    const stored = JSON.parse(readFileSync(join(dataDir, 'feedback-v3.ndjson'), 'utf8').trim())
    expect(stored).toEqual({
      event: {
        schemaVersion: 3,
        type: 'feedback.signal',
        eventId: expect.any(String),
        plugin: { moduleName: '@example/plugin', version: '1.0.0' },
        health: 'unknown',
        experience: 'bad',
        category: 'reliability',
        source: 'user_confirmed',
      },
      requestedShare: false,
    })
    const forbidden = [
      'participantId', 'occurredAt', 'taskId', 'environment', 'signals', 'note', 'summary',
      'message', 'stack', 'crash', 'session', 'locale', 'platform', 'path',
    ]
    for (const key of forbidden) expect(stored.event).not.toHaveProperty(key)
    await fiber.dispose()
  })

  it('does not treat deployment permission as per-event consent', async () => {
    const root = mkdtempSync(join(tmpdir(), 'omdsh-plugin-lab-'))
    const { ctx, fiber, agent, signal } = await runtime({
      dataDir: join(root, 'data'),
      allowShare: true,
      ingestUrl: 'http://127.0.0.1:9/events',
      retryIntervalMs: 60_000,
    })
    await ctx.commands.execute(agent, '/omdsh-start plugin', signal)
    const feedback = await ctx.commands.execute(agent, '/omdsh-result good general', signal)
    expect(feedback?.result.text).toContain('确认提交后才会发送')
    await fiber.dispose()
  })

  it('uploads only after a separate explicit action and sends exact finite fields', async () => {
    let posts = 0
    let body = ''
    const server = createServer((request, response) => {
      request.setEncoding('utf8')
      request.on('data', chunk => { body += chunk })
      request.on('end', () => {
        posts += 1
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ receiptId: crypto.randomUUID(), caseId: 'PL-STRICT', status: 'received' }))
      })
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('missing address')
    const root = mkdtempSync(join(tmpdir(), 'omdsh-plugin-lab-'))
    const { ctx, fiber, agent, signal } = await runtime({
      dataDir: join(root, 'data'),
      allowShare: true,
      ingestUrl: `http://127.0.0.1:${address.port}/v1/experience-events`,
      retryIntervalMs: 60_000,
    })
    await ctx.commands.execute(agent, '/omdsh-start plugin#1.0.0', signal)
    const panel = ctx.get('pluginLab') as PluginLabPanelService
    const commandRowsBefore = agent.session.events.filter(event => event.type === 'command/run').length
    expect(panel.record(agent, 'mixed', 'compatibility')).toMatchObject({ ok: true })
    expect(agent.session.events.filter(event => event.type === 'command/run')).toHaveLength(commandRowsBefore)
    expect(posts).toBe(0)
    const joined = await panel.join(agent)
    expect(joined.text).toContain('PL-STRICT')
    expect(posts).toBe(1)
    const commandRows = agent.session.events.filter(event => event.type === 'command/run')
    expect(commandRows).toHaveLength(commandRowsBefore + 1)
    expect(commandRows.at(-1)?.data).toMatchObject({ name: 'omdsh-history' })
    const packet = JSON.parse(body) as Record<string, unknown>
    expect(Object.keys(packet).sort()).toEqual([
      'category', 'eventId', 'experience', 'health', 'plugin', 'schemaVersion', 'source', 'type',
    ])
    expect(packet).toMatchObject({
      schemaVersion: 3,
      type: 'feedback.signal',
      plugin: { moduleName: 'plugin', version: '1.0.0' },
      health: 'unknown',
      experience: 'mixed',
      category: 'compatibility',
      source: 'user_confirmed',
    })
    await fiber.dispose()
    await new Promise<void>(resolve => server.close(() => resolve()))
  })

  it('rejects free-text trial and verdict inputs instead of storing them', async () => {
    const root = mkdtempSync(join(tmpdir(), 'omdsh-plugin-lab-'))
    const { ctx, fiber, agent, signal } = await runtime({ dataDir: join(root, 'data') })
    const start = await ctx.commands.execute(agent, '/omdsh-start plugin private-task-label', signal)
    expect(start?.result.kind).toBe('error')
    await ctx.commands.execute(agent, '/omdsh-start plugin', signal)
    const result = await ctx.commands.execute(agent, '/omdsh-result bad reliability secret-note', signal)
    expect(result?.result.kind).toBe('error')
    await fiber.dispose()
  })

  it('does not register a crash monitor or inspect private Session events', async () => {
    const before = [...process.listeners('uncaughtExceptionMonitor')]
    const root = mkdtempSync(join(tmpdir(), 'omdsh-plugin-lab-'))
    const { ctx, fiber, session, agent, signal } = await runtime({ dataDir: join(root, 'data') })
    expect(process.listeners('uncaughtExceptionMonitor')).toEqual(before)
    await ctx.commands.execute(agent, '/omdsh-start plugin', signal)
    session.append('assistant/message', {
      turn: 1,
      step: 1,
      message: { role: 'assistant', content: [{ type: 'text', text: 'CANARY_SECRET_TOKEN' }] } as never,
    }, { surfaceOp: 'append' })
    await ctx.commands.execute(agent, '/omdsh-result good result_quality', signal)
    const stored = readFileSync(join(root, 'data', 'feedback-v3.ndjson'), 'utf8')
    expect(stored).not.toContain('CANARY_SECRET_TOKEN')
    await fiber.dispose()
    expect(process.listeners('uncaughtExceptionMonitor')).toEqual(before)
  })
})
