import { describe, expect, it, vi } from 'vitest'
import type { MessageId } from '@deepseek-ai/dsh-client-connection/client'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { LabController, type PluginLabRemote } from '../src/client/controller.js'

const SESSION = 'session' as SessionId
const success = <T,>(value: T) => Promise.resolve({ ok: true as const, value })

function remote(overrides: Partial<PluginLabRemote> = {}): PluginLabRemote {
  return {
    probe: async () => success({ active: true, text: '插件运行正常' }),
    record: async () => success({ ok: true, text: '已只保存在本机' }),
    join: async () => success({ ok: true, text: '问题回执：PL-1234' }),
    inbox: async () => success('暂无新进展'),
    ...overrides,
  } as PluginLabRemote
}

describe('silent panel controller', () => {
  it('keeps local preview and network sharing as separate RPC actions', async () => {
    const record: PluginLabRemote['record'] = vi.fn(async () => success({ ok: true, text: '已只保存在本机' }))
    const join: PluginLabRemote['join'] = vi.fn(async () => success({ ok: true, text: '问题回执：PL-1234' }))
    const probe: PluginLabRemote['probe'] = vi.fn(async () => success({ active: false, text: '未选择试用插件' }))
    const controller = new LabController(remote({ record, join, probe }), SESSION)
    controller.setTrialActive(true)

    await controller.record('latest' as MessageId, 'bad', 'reliability')
    expect(record).toHaveBeenLastCalledWith(SESSION, 'bad', 'reliability')
    expect(controller.getSnapshot()).toMatchObject({
      active: false,
      pending: { verdict: 'bad', category: 'reliability', phase: 'local' },
    })

    await controller.join()
    expect(join).toHaveBeenLastCalledWith(SESSION)
    expect(controller.getSnapshot().pending).toMatchObject({ phase: 'joined', text: '问题回执：PL-1234' })
    await expect(controller.probe()).resolves.toBe('未选择试用插件')
    expect(controller.getSnapshot().active).toBe(false)
  })

  it('surfaces transport and closed action failures', async () => {
    const disconnected: PluginLabRemote['record'] = vi.fn(async () => ({
      ok: false as const,
      error: { code: 'disconnected', message: '连接已断开' } as never,
    }))
    const controller = new LabController(remote({ record: disconnected }), SESSION)
    controller.setTrialActive(true)
    await controller.record('message' as MessageId, 'mixed', 'performance')
    expect(controller.getSnapshot().pending).toMatchObject({
      phase: 'error', text: '连接已断开 (disconnected)',
    })

    const rejected: PluginLabRemote['record'] = vi.fn(async () => success({ ok: false, text: '没有进行中的插件试用。' }))
    const second = new LabController(remote({ record: rejected }), SESSION)
    second.setTrialActive(true)
    await second.record('message' as MessageId, 'bad', 'general')
    expect(second.getSnapshot().pending).toMatchObject({
      phase: 'error', text: '没有进行中的插件试用。',
    })
  })
})
