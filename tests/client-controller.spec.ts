import { describe, expect, it, vi } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { LabController, type PluginLabRemote } from '../src/client/controller.js'

const SESSION = 'session' as SessionId
const success = <T,>(value: T) => Promise.resolve({ ok: true as const, value })

function remote(overrides: Partial<PluginLabRemote> = {}): PluginLabRemote {
  return {
    probe: async () => success({ active: true, health: 'ok' as const, suggestedCategory: 'general' as const, text: '插件运行正常' }),
    select: async () => success({ ok: true, text: '已选择插件' }),
    record: async () => success({ ok: true, text: '已只保存在本机' }),
    revise: async (_sessionId, summary) => success({ ok: true, text: '已修改本地摘要', summary }),
    join: async () => success({ ok: true, text: '问题回执：PL-1234' }),
    cancel: async () => success({ ok: true, text: '已取消' }),
    discard: async (_sessionId, eventId) => success({ ok: true, text: '已移除', eventId }),
    receipts: async () => success({ items: [], unreadCount: 0 }),
    inbox: async () => success('暂无新进展'),
    ...overrides,
  } as PluginLabRemote
}

describe('silent panel controller', () => {
  it('keeps local preview and network sharing as separate RPC actions', async () => {
    const record: PluginLabRemote['record'] = vi.fn(async () => success({ ok: true, text: '已只保存在本机' }))
    const revise: PluginLabRemote['revise'] = vi.fn(async (_sessionId, summary) => success({
      ok: true, text: `脱敏 Summary：${summary}`, summary,
    }))
    const join: PluginLabRemote['join'] = vi.fn(async () => success({ ok: true, text: '问题回执：PL-1234' }))
    const probe: PluginLabRemote['probe'] = vi.fn(async () => success({ active: false, health: 'unknown' as const, suggestedCategory: 'general' as const, text: '未选择试用插件' }))
    const controller = new LabController(remote({ record, revise, join, probe }), SESSION)
    controller.setTrialActive(true)

    await controller.record('bad', 'reliability')
    expect(record).toHaveBeenLastCalledWith(SESSION, 'bad', 'reliability')
    expect(controller.getSnapshot()).toMatchObject({
      active: true,
      pending: { verdict: 'bad', category: 'reliability', phase: 'local' },
    })
    expect(controller.getSnapshot().pending).not.toHaveProperty('messageId')

    await controller.revise('插件启动偏慢，但交互仍然清楚。')
    expect(revise).toHaveBeenLastCalledWith(SESSION, '插件启动偏慢，但交互仍然清楚。')
    expect(controller.getSnapshot().pending).toMatchObject({
      phase: 'local', summary: '插件启动偏慢，但交互仍然清楚。',
    })

    await controller.join()
    expect(join).toHaveBeenLastCalledWith(SESSION)
    expect(controller.getSnapshot().pending).toMatchObject({ phase: 'joined', text: '问题回执：PL-1234' })
    await expect(controller.probe()).resolves.toBe('未选择试用插件')
    expect(controller.getSnapshot().active).toBe(false)
    expect(controller.getSnapshot().health).toBe('unknown')
    expect(controller.getSnapshot().suggestedCategory).toBe('general')
  })

  it('selects a plugin without a command and keeps a local progress box', async () => {
    const select: PluginLabRemote['select'] = vi.fn(async () => success({ ok: true, text: '已选择 @example/plugin' }))
    const receipts: PluginLabRemote['receipts'] = vi.fn(async () => success({
      items: [{
        eventId: '00000000-0000-4000-8000-000000000001',
        plugin: { moduleName: '@example/plugin' },
        summary: '固定模板摘要',
        localState: 'submitted' as const,
        status: 'clustered' as const,
        unread: true,
      }],
      unreadCount: 1,
    }))
    const controller = new LabController(remote({ select, receipts }), SESSION)

    await controller.selectPlugin({ moduleName: '@example/plugin' })
    expect(select).toHaveBeenCalledWith(SESSION, { moduleName: '@example/plugin' })
    expect(controller.getSnapshot()).toMatchObject({
      active: true,
      manualSelection: true,
      plugin: { moduleName: '@example/plugin' },
    })

    await expect(controller.receipts(false)).resolves.toMatchObject({ unreadCount: 1 })
    expect(controller.getSnapshot().receiptBox?.items).toHaveLength(1)
  })

  it('cancels the current local draft and clears selection state', async () => {
    const controller = new LabController(remote(), SESSION)
    await controller.selectPlugin({ moduleName: '@example/plugin' })
    await controller.record('bad', 'general')
    await controller.cancel()
    expect(controller.getSnapshot()).toEqual({
      active: false,
      receiptBox: { items: [], unreadCount: 0 },
    })
  })

  it('surfaces transport and closed action failures', async () => {
    const disconnected: PluginLabRemote['record'] = vi.fn(async () => ({
      ok: false as const,
      error: { code: 'disconnected', message: '连接已断开' } as never,
    }))
    const controller = new LabController(remote({ record: disconnected }), SESSION)
    controller.setTrialActive(true)
    await controller.record('mixed', 'performance')
    expect(controller.getSnapshot().pending).toMatchObject({
      phase: 'error', text: '连接已断开 (disconnected)',
    })

    const rejected: PluginLabRemote['record'] = vi.fn(async () => success({ ok: false, text: '没有进行中的插件试用。' }))
    const second = new LabController(remote({ record: rejected }), SESSION)
    second.setTrialActive(true)
    await second.record('bad', 'general')
    expect(second.getSnapshot().pending).toMatchObject({
      phase: 'error', text: '没有进行中的插件试用。',
    })
  })
})
