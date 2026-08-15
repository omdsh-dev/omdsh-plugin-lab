// @vitest-environment jsdom
import { useSyncExternalStore } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PluginLabButton, type PluginLabButtonProps } from '../src/client/PluginLabButton.js'
import { LabController, type PluginLabRemote } from '../src/client/controller.js'

afterEach(cleanup)

const SESSION = 'session' as SessionId
const success = <T,>(value: T) => Promise.resolve({ ok: true as const, value })

function remote(overrides: Partial<PluginLabRemote> = {}): PluginLabRemote {
  return {
    probe: async () => success({ active: false, health: 'unknown' as const, text: '未选择试用插件' }),
    record: async () => success({ ok: true, text: '待确认' }),
    join: async () => success({ ok: true, text: '已提交' }),
    inbox: async () => success('暂无新进展'),
    ...overrides,
  } as PluginLabRemote
}

function propsFor(controller: LabController): PluginLabButtonProps {
  const usePluginLab = <T,>(selector: (view: ReturnType<LabController['getSnapshot']>) => T): T => {
    const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
    return selector(view)
  }
  return {
    usePluginLab,
    record: (verdict, category) => controller.record(verdict, category),
    join: () => controller.join(),
    dismiss: () => { controller.dismiss() },
    checkHealth: () => controller.probe(),
    checkInbox: () => controller.inbox(),
  } as PluginLabButtonProps
}

describe('rc.6 lightweight client entry', () => {
  it('stays hidden when there is no trial or the selected plugin is healthy', async () => {
    const controller = new LabController(remote({
      probe: async () => success({ active: true, health: 'ok', text: '插件运行正常' }),
    }), SESSION)
    render(<PluginLabButton {...propsFor(controller)} />)
    expect(screen.queryByRole('button', { name: '让 Agent 帮我反馈' })).toBeNull()

    controller.setTrialActive(true)
    await controller.probe()
    expect(screen.queryByRole('button', { name: '让 Agent 帮我反馈' })).toBeNull()
  })

  it('appears only for a structured plugin failure and probes without a model call', async () => {
    const probe: PluginLabRemote['probe'] = vi.fn(async () => success({
      active: true, health: 'error' as const, text: '@example/plugin · 当前运行报错',
    }))
    const controller = new LabController(remote({ probe }), SESSION)
    controller.setTrialActive(true)
    await controller.probe()
    render(<PluginLabButton {...propsFor(controller)} />)

    expect(screen.getByText('当前插件运行报错')).toBeDefined()
    expect(screen.getByText('只基于 Host 状态，不读取对话或日志')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: '让 Agent 帮我反馈' }))
    await screen.findByText('@example/plugin · 当前运行报错')
    expect(probe).toHaveBeenCalledWith(SESSION)
  })

  it('collects experience and category, previews locally, then submits separately', async () => {
    const probe: PluginLabRemote['probe'] = vi.fn(async () => success({ active: true, health: 'unavailable' as const, text: '@example/plugin · 当前暂不可用' }))
    const record: PluginLabRemote['record'] = vi.fn(async () => success({
      ok: true,
      text: '待发送：稳定性 · 不好用\n不会附带本地任务、对话、Prompt、回复、日志或文件；点击“确认发送这条反馈”前不会发送。',
    }))
    const join: PluginLabRemote['join'] = vi.fn(async () => success({ ok: true, text: '已提交 · 同类 2 条 · clustered' }))
    const controller = new LabController(remote({ probe, record, join }), SESSION)
    controller.setTrialActive(true)
    await controller.probe()
    render(<PluginLabButton {...propsFor(controller)} />)

    fireEvent.click(screen.getByRole('button', { name: '让 Agent 帮我反馈' }))
    await screen.findByText('@example/plugin · 当前暂不可用')
    expect((screen.getByRole('dialog', { name: '让 Agent 帮我反馈' }) as HTMLSpanElement).style.background).not.toBe('transparent')
    expect((screen.getByRole('button', { name: '好用' }) as HTMLButtonElement).style.background).not.toBe('transparent')
    fireEvent.click(screen.getByRole('button', { name: '不好用' }))
    fireEvent.click(screen.getByRole('button', { name: '稳定性' }))
    await screen.findByText(/待发送：稳定性/)
    expect(record).toHaveBeenLastCalledWith(SESSION, 'bad', 'reliability')

    expect(screen.getByText(/不会附带当前任务、本地对话/)).toBeDefined()
    expect((screen.getByRole('button', { name: '确认发送这条反馈' }) as HTMLButtonElement).style.background).not.toBe('transparent')
    fireEvent.click(screen.getByRole('button', { name: '确认发送这条反馈' }))
    await screen.findByText('已提交 · 同类 2 条 · clustered')
    expect(join).toHaveBeenLastCalledWith(SESSION)
    expect(screen.getByRole('button', { name: '完成' })).toBeDefined()
  })

  it('keeps progress as a secondary action inside the same panel', async () => {
    const inbox: PluginLabRemote['inbox'] = vi.fn(async () => success('暂无新进展'))
    const controller = new LabController(remote({
      inbox,
      probe: async () => success({ active: true, health: 'unavailable', text: '插件暂不可用' }),
    }), SESSION)
    controller.setTrialActive(true)
    await controller.probe()
    render(<PluginLabButton {...propsFor(controller)} />)
    fireEvent.click(screen.getByRole('button', { name: '让 Agent 帮我反馈' }))
    await screen.findByText('插件暂不可用')
    fireEvent.click(screen.getByRole('button', { name: '查看进展' }))
    await waitFor(() => { expect(screen.getByText('暂无新进展')).toBeDefined() })
    expect(inbox).toHaveBeenLastCalledWith(SESSION)
    expect(screen.queryByRole('button', { name: '插件探活' })).toBeNull()
    expect(screen.queryByRole('button', { name: '反馈进展' })).toBeNull()
  })
})
