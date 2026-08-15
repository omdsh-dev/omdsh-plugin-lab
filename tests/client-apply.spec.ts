import { Context, Service } from '@deepseek-ai/cordis'
import type { CommandResult } from '@deepseek-ai/dsh-commands/types'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { SlotCore, type StoredEntry } from '@deepseek-ai/dsh-client-ui-slots'
import { describe, expect, it, vi } from 'vitest'
import type { LabInjected } from '../src/client/ExperienceResultCard.js'
import type { InboxInjected } from '../src/client/InboxButton.js'
import { apply, inject } from '../src/client/index.js'
import type { CommandsRemote } from '../src/client/controller.js'

const sid = (value: string): SessionId => value as SessionId

/** Published rc.6 exposes SlotCore as ordinary ESM; this thin service adds Cordis fiber ownership. */
class TestSlotRegistry extends Service {
  readonly core = new SlotCore()

  constructor(ctx: Context) { super(ctx, 'slots') }

  register(options: never, component: never): () => void {
    const dispose = this.core.register(options, component)
    this.ctx.effect(() => dispose, 'test slots: registration')
    return dispose
  }

  inject(key: string, callback: () => (() => void) | Iterable<() => void>): () => void {
    let active: (() => void) | undefined
    const reconcile = (): void => {
      const declared = this.core.spec(key as never) !== undefined
      if (declared && active === undefined) {
        const installed = callback()
        if (typeof installed === 'function') active = installed
        else {
          const disposers = [...installed]
          active = () => { for (const dispose of disposers.reverse()) dispose() }
        }
      } else if (!declared && active !== undefined) {
        active()
        active = undefined
      }
    }
    const unsubscribe = this.core.subscribeDeclaration(key, reconcile)
    reconcile()
    const dispose = (): void => {
      unsubscribe()
      active?.()
      active = undefined
    }
    this.ctx.effect(() => dispose, 'test slots: injection')
    return dispose
  }

  entries(key: string): readonly StoredEntry[] { return this.core.entries(key) }
}

function declare(slots: TestSlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: {
      'conversation.chat.assistant-actions': { kind: 'list', scope: 'session' },
      'conversation.input.left': { kind: 'list', scope: 'session' },
    },
  } as never, (() => null) as never)
}

async function bench() {
  const ctx = new Context()
  const calls: Array<{ sessionId: SessionId; line: string }> = []
  const execute: CommandsRemote['execute'] = vi.fn(async (sessionId, line) => {
    calls.push({ sessionId, line })
    const result: CommandResult = {
      kind: 'success',
      text: line === '/omdsh-inbox' ? 'Plugin Lab 暂无新的处理进展。' : '完成。',
    }
    return { ok: true as const, value: { commandId: 'command' as never, result } }
  })
  class RemoteService extends Service {
    constructor(serviceCtx: Context) { super(serviceCtx, 'remote') }
  }
  new RemoteService(ctx)
  ctx.provide('remote.commands', { execute })
  const slots = new TestSlotRegistry(ctx)
  const declaration = declare(slots)
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  const resultEntry = () => slots.entries('conversation.chat.assistant-actions')[0]
  const inboxEntry = () => slots.entries('conversation.input.left')[0]
  return { ctx, slots, calls, declaration, fiber, resultEntry, inboxEntry }
}

function resultFace(entry: ReturnType<Awaited<ReturnType<typeof bench>>['resultEntry']>, sessionId: SessionId): LabInjected {
  return (entry?.inject as unknown as (id: SessionId) => LabInjected)(sessionId)
}

function inboxFace(entry: ReturnType<Awaited<ReturnType<typeof bench>>['inboxEntry']>, sessionId: SessionId): InboxInjected {
  return (entry?.inject as unknown as (id: SessionId) => InboxInjected)(sessionId)
}

describe('rc.6 client plugin contract', () => {
  it('registers both documented Slot entries over a real rc.6 SlotRegistry', async () => {
    const b = await bench()
    expect(inject).toEqual(['slots', 'remote', 'remote.commands'])
    expect(b.resultEntry()?.options).toMatchObject({ id: 'omdsh-plugin-lab', order: 20 })
    expect(b.inboxEntry()?.options).toMatchObject({ id: 'omdsh-plugin-lab-inbox', order: 40 })
    await b.fiber.dispose()
  })

  it('activates only after successful start/retest acknowledgements', async () => {
    const b = await bench()
    const first = resultFace(b.resultEntry(), sid('s1'))
    b.ctx.emit('command/executed', sid('s1'), 'omdsh-start', { kind: 'error', text: 'bad input' })
    expect(first.hooks.pluginLab.getSnapshot().active).toBe(false)

    b.ctx.emit('command/executed', sid('s1'), 'omdsh-start', { kind: 'success' })
    expect(first.hooks.pluginLab.getSnapshot().active).toBe(true)
    b.ctx.emit('command/executed', sid('s1'), 'omdsh-result', { kind: 'error', text: 'not saved' })
    expect(first.hooks.pluginLab.getSnapshot().active).toBe(true)
    b.ctx.emit('command/executed', sid('s1'), 'omdsh-result', { kind: 'success' })
    expect(first.hooks.pluginLab.getSnapshot().active).toBe(false)

    b.ctx.emit('command/executed', sid('s2'), 'omdsh-retest', { kind: 'success' })
    expect(resultFace(b.resultEntry(), sid('s2')).hooks.pluginLab.getSnapshot().active).toBe(true)
    await b.fiber.dispose()
  })

  it('shares one controller across the two Slot faces in a Session', async () => {
    const b = await bench()
    const result = resultFace(b.resultEntry(), sid('same'))
    const inbox = inboxFace(b.inboxEntry(), sid('same'))
    b.ctx.emit('command/executed', sid('same'), 'omdsh-start', { kind: 'success' })
    expect(result.hooks.pluginLab.getSnapshot().active).toBe(true)
    await inbox.checkInbox()
    expect(b.calls.at(-1)).toEqual({ sessionId: 'same', line: '/omdsh-inbox' })
    await b.fiber.dispose()
  })

  it('withdraws and re-registers cleanly across Slot collapse and HMR reload', async () => {
    const b = await bench()
    b.declaration()
    expect(b.resultEntry()).toBeUndefined()
    expect(b.inboxEntry()).toBeUndefined()

    const redeclare = declare(b.slots)
    await Promise.resolve()
    expect(b.resultEntry()).toBeDefined()
    expect(b.inboxEntry()).toBeDefined()

    await b.fiber.dispose()
    expect(b.resultEntry()).toBeUndefined()
    expect(b.inboxEntry()).toBeUndefined()
    const reloaded = b.ctx.plugin({ inject: [...inject], apply })
    await reloaded.await()
    expect(b.resultEntry()).toBeDefined()
    expect(b.inboxEntry()).toBeDefined()
    await reloaded.dispose()
    redeclare()
  })
})
