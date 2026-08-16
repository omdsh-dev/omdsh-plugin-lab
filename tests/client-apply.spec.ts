import { Context, Service } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { SlotCore, type StoredEntry } from '@deepseek-ai/dsh-client-ui-slots'
import { describe, expect, it, vi } from 'vitest'
import type { LabInjected } from '../src/client/ExperienceResultCard.js'
import type { PluginLabInjected } from '../src/client/PluginLabButton.js'
import { apply, inject } from '../src/client/index.js'
import type { PluginLabRemote } from '../src/client/controller.js'

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
      'conversation.chat.commandview': { kind: 'keyed', scope: 'session' },
      'conversation.input.left': { kind: 'list', scope: 'session' },
      'conversation.input.dock': { kind: 'list', scope: 'session' },
    },
  } as never, (() => null) as never)
}

async function bench() {
  const ctx = new Context()
  const calls: Array<{ method: string; sessionId: SessionId }> = []
  const panelRemote: PluginLabRemote = {
    probe: async sessionId => {
      calls.push({ method: 'probe', sessionId })
      return { ok: true as const, value: {
        active: true,
        plugin: { moduleName: '@example/plugin', version: '1.0.0' },
        health: 'unavailable' as const,
        suggestedCategory: 'startup' as const,
        text: '暂不可用',
      } }
    },
    record: async (sessionId) => {
      calls.push({ method: 'record', sessionId })
      return { ok: true as const, value: { ok: true, text: '待确认' } }
    },
    join: async sessionId => {
      calls.push({ method: 'join', sessionId })
      return { ok: true as const, value: { ok: true, text: '已提交' } }
    },
    inbox: async sessionId => {
      calls.push({ method: 'inbox', sessionId })
      return { ok: true as const, value: '暂无新进展' }
    },
  }
  const mount = vi.fn()
  class RemoteService extends Service {
    readonly pluginLab = panelRemote
    readonly $mount = mount
    constructor(serviceCtx: Context) { super(serviceCtx, 'remote') }
  }
  new RemoteService(ctx)
  ctx.provide('remote.pluginLab', panelRemote)
  const slots = new TestSlotRegistry(ctx)
  const declaration = declare(slots)
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  const pluginLabEntry = () => slots.entries('conversation.input.dock')
    .find(entry => entry.options.id === 'omdsh-plugin-lab')
  const assistantEntry = () => slots.entries('conversation.chat.assistant-actions')
    .find(entry => entry.options.id === 'omdsh-experience-receipt')
  const historyEntry = () => slots.entries('conversation.chat.commandview')
    .find(entry => entry.options.key === 'omdsh-history')
  return { ctx, slots, calls, declaration, fiber, mount, pluginLabEntry, assistantEntry, historyEntry }
}

function pluginLabFace(
  entry: ReturnType<Awaited<ReturnType<typeof bench>>['pluginLabEntry']>,
  sessionId: SessionId,
): PluginLabInjected {
  return (entry?.inject as unknown as (id: SessionId) => PluginLabInjected)(sessionId)
}

function assistantFace(
  entry: ReturnType<Awaited<ReturnType<typeof bench>>['assistantEntry']>,
  sessionId: SessionId,
): LabInjected {
  return (entry?.inject as unknown as (id: SessionId) => LabInjected)(sessionId)
}

describe('rc.6 client plugin contract', () => {
  it('registers lightweight result and no-reply fallback entries over real rc.6 slots', async () => {
    const b = await bench()
    expect(inject).toEqual(['slots', 'remote'])
    expect(b.mount).toHaveBeenCalledOnce()
    expect(b.pluginLabEntry()?.options).toMatchObject({ id: 'omdsh-plugin-lab', order: 15 })
    expect(b.assistantEntry()?.options).toMatchObject({ id: 'omdsh-experience-receipt', order: 40 })
    expect(b.slots.entries('conversation.input.dock')).toHaveLength(1)
    expect(b.slots.entries('conversation.input.left')).toHaveLength(0)
    expect(b.slots.entries('conversation.chat.assistant-actions')).toHaveLength(1)
    expect(b.historyEntry()?.options).toMatchObject({ key: 'omdsh-history' })
    await b.fiber.dispose()
  })

  it('activates only after successful start/retest acknowledgements', async () => {
    const b = await bench()
    const first = pluginLabFace(b.pluginLabEntry(), sid('s1'))
    b.ctx.emit('command/executed', sid('s1'), 'omdsh-start', { kind: 'error', text: 'bad input' })
    expect(first.hooks.pluginLab.getSnapshot().active).toBe(false)

    b.ctx.emit('command/executed', sid('s1'), 'omdsh-start', { kind: 'success' })
    expect(first.hooks.pluginLab.getSnapshot().active).toBe(true)
    await vi.waitFor(() => { expect(first.hooks.pluginLab.getSnapshot().health).toBe('unavailable') })
    expect(first.hooks.pluginLab.getSnapshot().suggestedCategory).toBe('startup')
    b.ctx.emit('command/executed', sid('s1'), 'omdsh-result', { kind: 'error', text: 'not saved' })
    expect(first.hooks.pluginLab.getSnapshot().active).toBe(true)
    b.ctx.emit('command/executed', sid('s1'), 'omdsh-result', { kind: 'success' })
    expect(first.hooks.pluginLab.getSnapshot().active).toBe(false)

    b.ctx.emit('command/executed', sid('s2'), 'omdsh-retest', { kind: 'success' })
    const second = pluginLabFace(b.pluginLabEntry(), sid('s2'))
    expect(second.hooks.pluginLab.getSnapshot().active).toBe(true)
    await vi.waitFor(() => { expect(second.hooks.pluginLab.getSnapshot().health).toBe('unavailable') })
    await b.fiber.dispose()
  })

  it('shares one Session controller across result action and fallback surfaces', async () => {
    const b = await bench()
    const lab = pluginLabFace(b.pluginLabEntry(), sid('same'))
    const result = assistantFace(b.assistantEntry(), sid('same'))
    b.ctx.emit('command/executed', sid('same'), 'omdsh-start', { kind: 'success' })
    expect(lab.hooks.pluginLab.getSnapshot().active).toBe(true)
    expect(result.hooks.pluginLab).toBe(lab.hooks.pluginLab)
    await lab.hooks.pluginLab.inbox()
    expect(b.calls.at(-1)).toEqual({ method: 'inbox', sessionId: 'same' })
    await lab.hooks.pluginLab.probe()
    expect(b.calls.at(-1)).toEqual({ method: 'probe', sessionId: 'same' })
    await b.fiber.dispose()
  })

  it('withdraws and re-registers cleanly across Slot collapse and HMR reload', async () => {
    const b = await bench()
    b.declaration()
    expect(b.pluginLabEntry()).toBeUndefined()
    expect(b.assistantEntry()).toBeUndefined()
    expect(b.historyEntry()).toBeUndefined()

    const redeclare = declare(b.slots)
    await Promise.resolve()
    expect(b.pluginLabEntry()).toBeDefined()
    expect(b.assistantEntry()).toBeDefined()
    expect(b.historyEntry()).toBeDefined()

    await b.fiber.dispose()
    expect(b.pluginLabEntry()).toBeUndefined()
    expect(b.assistantEntry()).toBeUndefined()
    expect(b.historyEntry()).toBeUndefined()
    const reloaded = b.ctx.plugin({ inject: [...inject], apply })
    await reloaded.await()
    expect(b.pluginLabEntry()).toBeDefined()
    expect(b.assistantEntry()).toBeDefined()
    expect(b.historyEntry()).toBeDefined()
    await reloaded.dispose()
    redeclare()
  })
})
