// @vitest-environment jsdom
import { useSyncExternalStore } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { MessageId } from '@deepseek-ai/dsh-client-connection/client'
import type { ConversationSnapshot, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ExperienceVerdict, FeedbackCategory } from '../src/protocol.js'
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
    record: async () => success({ ok: true, text: '待确认' }),
    join: async () => success({ ok: true, text: '已提交' }),
    inbox: async () => success('回执箱为空'),
    ...overrides,
  } as PluginLabRemote
}

function propsFor(controller: LabController, nodes: ConversationSnapshot['nodes'] = []): PluginLabButtonProps {
  const usePluginLab = <T,>(selector: (view: ReturnType<LabController['getSnapshot']>) => T): T => {
    const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
    return selector(view)
  }
  return {
    usePluginLab,
    useSession: <T,>(selector: (snapshot: ConversationSnapshot) => T): T => selector({ nodes } as ConversationSnapshot),
    record: (verdict: ExperienceVerdict, category: FeedbackCategory) => controller.record(verdict, category),
    join: () => controller.join(),
    dismiss: () => { controller.dismiss() },
  } as unknown as PluginLabButtonProps
}

function replyProps(
  controller: LabController,
  nodes: ConversationSnapshot['nodes'],
): ExperienceResultCardProps {
  return {
    ...propsFor(controller, nodes),
    messageId: MESSAGE,
  } as unknown as ExperienceResultCardProps
}

describe('rc.6 lightweight experience receipt', () => {
  it('stays hidden when there is no failed trial or the selected plugin is healthy', async () => {
    const controller = new LabController(remote({
      probe: async () => success({ active: true, health: 'ok', suggestedCategory: 'general', text: '插件运行正常' }),
    }), SESSION)
    render(<PluginLabButton {...propsFor(controller)} />)
    expect(screen.queryByRole('button', { name: '好用' })).toBeNull()

    controller.setTrialActive(true)
    await controller.probe()
    expect(screen.queryByRole('button', { name: '好用' })).toBeNull()
  })

  it('uses tiny thumbs as the no-reply failure fallback and previews before sending', async () => {
    const record: PluginLabRemote['record'] = vi.fn(async () => success({
      ok: true,
      text: '脱敏 Summary：@example/plugin#1.0.0 在“启动”方面：当前不可用，用户体验为“不好用”。',
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

    expect(screen.getByRole('group', { name: '@example/plugin#1.0.0 体验反馈' })).toBeDefined()
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '不好用' }))
    await screen.findByRole('region', { name: '体验回执' })
    expect(record).toHaveBeenLastCalledWith(SESSION, 'bad', 'startup')
    expect(screen.getByText('Agent 分类：启动')).toBeDefined()
    expect(screen.getByText(/脱敏 Summary/)).toBeDefined()
    expect(screen.getByText(/未读取或附带任务、对话正文/)).toBeDefined()

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
    await screen.findByRole('region', { name: '体验回执' })
    expect(record).toHaveBeenLastCalledWith(SESSION, 'good', 'general')
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
