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
    probe: async () => success({ active: false, text: '未选择试用插件' }),
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
    record: (verdict, category) => controller.record(undefined, verdict, category),
    join: () => controller.join(),
    dismiss: () => { controller.dismiss() },
    checkHealth: () => controller.probe(),
    checkInbox: () => controller.inbox(),
  } as PluginLabButtonProps
}

describe('rc.6 lightweight client entry', () => {
  it('shows one entry and probes automatically without a model or command call', async () => {
    const probe: PluginLabRemote['probe'] = vi.fn(async () => success({ active: false, text: '未选择试用插件' }))
    render(<PluginLabButton {...propsFor(new LabController(remote({ probe }), SESSION))} />)

    expect(screen.getAllByRole('button')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: '插件反馈' }))
    await screen.findByText('未选择试用插件')
    expect(probe).toHaveBeenCalledOnce()
    expect(probe).toHaveBeenLastCalledWith(SESSION)
    expect(screen.getByText(/还没有正在试用的插件/)).toBeDefined()
  })

  it('collects experience and category, previews locally, then submits separately', async () => {
    const probe: PluginLabRemote['probe'] = vi.fn(async () => success({ active: true, text: '@example/plugin · 当前运行 OK' }))
    const record: PluginLabRemote['record'] = vi.fn(async () => success({
      ok: true,
      text: '待确认：稳定性 · 不好用\n不含当前任务、对话或日志；确认提交后才会发送。',
    }))
    const join: PluginLabRemote['join'] = vi.fn(async () => success({ ok: true, text: '已提交 · 同类 2 条 · clustered' }))
    const controller = new LabController(remote({ probe, record, join }), SESSION)
    controller.setTrialActive(true)
    render(<PluginLabButton {...propsFor(controller)} />)

    fireEvent.click(screen.getByRole('button', { name: '插件反馈 ·' }))
    await screen.findByText('@example/plugin · 当前运行 OK')
    fireEvent.click(screen.getByRole('button', { name: '不好用' }))
    fireEvent.click(screen.getByRole('button', { name: '稳定性' }))
    await screen.findByText(/待确认：稳定性/)
    expect(record).toHaveBeenLastCalledWith(SESSION, 'bad', 'reliability')

    fireEvent.click(screen.getByRole('button', { name: '确认提交并等待修复' }))
    await screen.findByText('已提交 · 同类 2 条 · clustered')
    expect(join).toHaveBeenLastCalledWith(SESSION)
    expect(screen.getByRole('button', { name: '完成' })).toBeDefined()
  })

  it('keeps progress as a secondary action inside the same panel', async () => {
    const inbox: PluginLabRemote['inbox'] = vi.fn(async () => success('暂无新进展'))
    render(<PluginLabButton {...propsFor(new LabController(remote({ inbox }), SESSION))} />)
    fireEvent.click(screen.getByRole('button', { name: '插件反馈' }))
    await screen.findByText('未选择试用插件')
    fireEvent.click(screen.getByRole('button', { name: '查看进展' }))
    await waitFor(() => { expect(screen.getByText('暂无新进展')).toBeDefined() })
    expect(inbox).toHaveBeenLastCalledWith(SESSION)
    expect(screen.queryByRole('button', { name: '插件探活' })).toBeNull()
    expect(screen.queryByRole('button', { name: '反馈进展' })).toBeNull()
  })
})
