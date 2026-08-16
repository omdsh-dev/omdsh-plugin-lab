// @vitest-environment jsdom
import { useSyncExternalStore } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { MessageId } from '@deepseek-ai/dsh-client-connection/client'
import type { ConversationSnapshot, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ExperienceVerdict, FeedbackCategory, TrialPluginRef } from '../src/protocol.js'
import { ExperienceResultCard, type ExperienceResultCardProps } from '../src/client/ExperienceResultCard.js'
import { PluginLabButton, type PluginLabButtonProps } from '../src/client/PluginLabButton.js'
import { LabController, type PluginLabRemote } from '../src/client/controller.js'

afterEach(cleanup)

const SESSION = 'session' as SessionId
const MESSAGE = 'reply-1' as MessageId
const success = <T,>(value: T) => Promise.resolve({ ok: true as const, value })

function remote(overrides: Partial<PluginLabRemote> = {}): PluginLabRemote {
  return {
    probe: async () => success({ active: false, health: 'unknown' as const, suggestedCategory: 'general' as const, text: '未选择试用插件' }),
    select: async () => success({ ok: true, text: '已选择插件' }),
    record: async () => success({ ok: true, text: '待确认' }),
    join: async () => success({ ok: true, text: '已提交' }),
    cancel: async () => success({ ok: true, text: '已取消' }),
    discard: async (_sessionId, eventId) => success({ ok: true, text: '已移除', eventId }),
    receipts: async () => success({ items: [], unreadCount: 0 }),
    inbox: async () => success('回执箱为空'),
    ...overrides,
  } as PluginLabRemote
}

function propsFor(
  controller: LabController,
  nodes: ConversationSnapshot['nodes'] = [],
  overrides: Partial<PluginLabButtonProps> = {},
): PluginLabButtonProps {
  const usePluginLab = <T,>(selector: (view: ReturnType<LabController['getSnapshot']>) => T): T => {
    const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
    return selector(view)
  }
  return {
    usePluginLab,
    useSession: <T,>(selector: (snapshot: ConversationSnapshot) => T): T => selector({ nodes } as ConversationSnapshot),
    record: (verdict: ExperienceVerdict, category: FeedbackCategory) => controller.record(verdict, category),
    join: () => controller.join(),
    cancel: () => controller.cancel().then(() => undefined),
    dismiss: () => { controller.dismiss() },
    selectPlugin: (plugin: TrialPluginRef) => controller.selectPlugin(plugin),
    listPlugins: async () => [],
    loadReceipts: (markRead: boolean) => controller.receipts(markRead),
    discardReceipt: (eventId: string) => controller.discard(eventId),
    ...overrides,
  } as unknown as PluginLabButtonProps
}

function replyProps(
  controller: LabController,
  nodes: ConversationSnapshot['nodes'],
): ExperienceResultCardProps {
  return {
    ...propsFor(controller, nodes),
    messageId: MESSAGE,
    refresh: () => controller.probe(),
  } as unknown as ExperienceResultCardProps
}

describe('rc.6 lightweight experience receipt', () => {
  it('keeps one quiet entry while hiding contextual thumbs without a relevant trial', async () => {
    const controller = new LabController(remote({
      probe: async () => success({ active: true, health: 'ok', suggestedCategory: 'general', text: '插件运行正常' }),
    }), SESSION)
    render(<PluginLabButton {...propsFor(controller)} />)
    expect(screen.getByRole('button', { name: '体验回执' })).toBeDefined()
    expect(screen.queryByText('＋ 反馈插件')).toBeNull()
    expect(screen.queryByRole('button', { name: '好用' })).toBeNull()

    controller.setTrialActive(true)
    await controller.probe()
    expect(screen.getByRole('button', { name: '体验回执' })).toBeDefined()
    expect(screen.queryByRole('button', { name: '好用' })).toBeNull()
  })

  it('uses tiny thumbs as the no-reply failure fallback and previews before sending', async () => {
    const record: PluginLabRemote['record'] = vi.fn(async (_sessionId, verdict, category) => success({
      ok: true,
      text: `脱敏 Summary：@example/plugin#1.0.0 · ${verdict} · ${category}`,
    }))
    const join: PluginLabRemote['join'] = vi.fn(async () => success({ ok: true, text: '已提交 · clustered' }))
    const controller = new LabController(remote({
      probe: async () => success({
        active: true,
        plugin: { moduleName: '@example/plugin', version: '1.0.0' },
        health: 'unavailable',
        suggestedCategory: 'startup',
        text: '@example/plugin · 当前暂不可用',
      }),
      record,
      join,
    }), SESSION)
    controller.setTrialActive(true)
    await controller.probe()
    render(<PluginLabButton {...propsFor(controller)} />)

    expect(screen.queryByRole('group', { name: '@example/plugin#1.0.0 体验反馈' })).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /体验回执 · 待反馈/ }))
    expect(screen.getByRole('group', { name: '@example/plugin#1.0.0 体验反馈' })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: '不好用' }))
    await screen.findByRole('region', { name: '体验回执预览' })
    expect(record).toHaveBeenLastCalledWith(SESSION, 'bad', 'startup')
    expect(screen.getByText('反馈大类：启动')).toBeDefined()
    expect(screen.getByText(/脱敏 Summary/)).toBeDefined()
    expect(screen.getByText(/未读取或附带任务、对话正文/)).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: '修改' }))
    expect(screen.queryByRole('button', { name: '确认发送' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /一般/ }))
    fireEvent.change(screen.getByRole('combobox', { name: '问题大类' }), {
      target: { value: 'compatibility' },
    })
    expect(screen.getByText(/在“兼容性”方面/)).toBeDefined()
    expect(screen.getByText(/用户体验为“一般”/)).toBeDefined()
    expect(record).toHaveBeenCalledTimes(1)
    expect(join).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '应用修改' }))
    await screen.findByText('反馈大类：兼容性')
    expect(record).toHaveBeenLastCalledWith(SESSION, 'mixed', 'compatibility')
    expect(record).toHaveBeenCalledTimes(2)
    expect(join).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '确认发送' }))
    await screen.findByText('已提交 · clustered')
    expect(join).toHaveBeenLastCalledWith(SESSION)
  })

  it('moves the same controls onto the first finalized reply after activation', async () => {
    const record: PluginLabRemote['record'] = vi.fn(async () => success({ ok: true, text: '脱敏 Summary：好用' }))
    const controller = new LabController(remote({
      probe: async () => success({
        active: true,
        plugin: { moduleName: '@example/plugin' },
        health: 'ok',
        suggestedCategory: 'general',
        text: '@example/plugin · 运行正常',
      }),
      record,
    }), SESSION)
    controller.setTrialActive(true)
    const activatedAt = controller.getSnapshot().activatedAt ?? 0
    await controller.probe()
    const nodes = [{
      kind: 'assistant' as const,
      seq: 7,
      time: activatedAt + 1,
      turn: 1,
      step: 1,
      messageId: MESSAGE,
      blocks: [],
    }]

    const { rerender } = render(<PluginLabButton {...propsFor(controller, nodes)} />)
    expect(screen.queryByRole('button', { name: '好用' })).toBeNull()
    rerender(<ExperienceResultCard {...replyProps(controller, nodes)} />)
    expect(screen.getByRole('group', { name: '@example/plugin 体验反馈' })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: '好用' }))
    await screen.findByRole('region', { name: '体验回执预览' })
    expect(record).toHaveBeenLastCalledWith(SESSION, 'good', 'general')
  })

  it('selects a plugin and shows progress inside the same receipt sheet', async () => {
    const select: PluginLabRemote['select'] = vi.fn(async () => success({ ok: true, text: '已选择 @example/plugin' }))
    const controller = new LabController(remote({
      select,
      probe: async () => success({
        active: true,
        plugin: { moduleName: '@example/plugin' },
        health: 'error',
        suggestedCategory: 'reliability',
        text: '运行失败',
      }),
    }), SESSION)
    const item = {
      eventId: '00000000-0000-4000-8000-000000000001',
      plugin: { moduleName: '@example/older', version: '1.0.0' },
      summary: '@example/older 的固定模板摘要。',
      localState: 'submitted' as const,
      status: 'clustered' as const,
      similarReports: 3,
      unread: false,
    }
    render(<PluginLabButton {...propsFor(controller, [], {
      listPlugins: async () => [{ moduleName: '@example/plugin', enabled: true, fiberPhase: 'failed' }],
      loadReceipts: async markRead => ({ items: [item], unreadCount: markRead ? 0 : 1 }),
    })} />)

    await screen.findByRole('button', { name: '体验回执 · 1 · 1 新' })
    fireEvent.click(screen.getByRole('button', { name: '体验回执 · 1 · 1 新' }))
    expect(await screen.findByRole('region', { name: '体验回执' })).toBeDefined()
    expect(screen.getByText('@example/older#1.0.0')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /选择插件/ }))
    fireEvent.click(await screen.findByRole('button', { name: /@example\/plugin运行失败/ }))
    expect(select).toHaveBeenCalledWith(SESSION, { moduleName: '@example/plugin' })
    expect(await screen.findByRole('group', { name: '@example/plugin 体验反馈' })).toBeDefined()
    expect(screen.queryByText('＋ 反馈插件')).toBeNull()
  })

  it('keeps the receipt sheet compact until the user asks for detail or all history', async () => {
    const controller = new LabController(remote(), SESSION)
    const items = [1, 2, 3, 4].map(index => ({
      eventId: `00000000-0000-4000-8000-00000000000${index}`,
      plugin: { moduleName: `@example/plugin-${index}` },
      summary: `只在展开后显示的摘要 ${index}`,
      localState: 'submitted' as const,
      status: 'received' as const,
      unread: false,
    }))
    render(<PluginLabButton {...propsFor(controller, [], {
      loadReceipts: async () => ({ items, unreadCount: 0 }),
    })} />)

    fireEvent.click(await screen.findByRole('button', { name: '体验回执 · 4' }))
    expect(await screen.findByText('@example/plugin-1')).toBeDefined()
    expect(screen.getByText('@example/plugin-3')).toBeDefined()
    expect(screen.queryByText('@example/plugin-4')).toBeNull()
    expect(screen.queryByText('只在展开后显示的摘要 1')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '查看 @example/plugin-1 回执详情' }))
    expect(screen.getByText('只在展开后显示的摘要 1')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: '查看全部 4' }))
    expect(screen.getByText('@example/plugin-4')).toBeDefined()
  })

  it('does not attach controls to a reply from before trial activation', async () => {
    const controller = new LabController(remote(), SESSION)
    controller.setTrialActive(true)
    const activatedAt = controller.getSnapshot().activatedAt ?? 0
    const nodes = [{
      kind: 'assistant' as const,
      seq: 1,
      time: activatedAt - 1,
      turn: 1,
      step: 1,
      messageId: MESSAGE,
      blocks: [{ kind: 'text' as const, text: 'PRIVATE_CANARY' }],
    }]
    render(<ExperienceResultCard {...replyProps(controller, nodes)} />)
    expect(screen.queryByRole('button', { name: '好用' })).toBeNull()
    expect(document.body.textContent).not.toContain('PRIVATE_CANARY')
  })
})
