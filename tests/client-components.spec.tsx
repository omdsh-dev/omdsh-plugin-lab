// @vitest-environment jsdom
import { useSyncExternalStore } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { MessageId } from '@deepseek-ai/dsh-client-connection/client'
import type { ConversationNode, ConversationSnapshot, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ExperienceResultCard, latestAssistantMessageId,
  type ExperienceResultCardProps,
} from '../src/client/ExperienceResultCard.js'
import { InboxButton, type InboxButtonProps } from '../src/client/InboxButton.js'
import { ProbeButton, type ProbeButtonProps } from '../src/client/ProbeButton.js'
import { LabController, type CommandsRemote } from '../src/client/controller.js'

afterEach(cleanup)

const OLD = 'message-old' as MessageId
const LATEST = 'message-latest' as MessageId
const SESSION = 'session' as SessionId

const nodes = [
  { kind: 'assistant', messageId: OLD },
  { kind: 'assistant', messageId: LATEST },
] as ConversationNode[]

function sessionHook<T>(selector: (snapshot: ConversationSnapshot) => T): T {
  return selector({ nodes } as unknown as ConversationSnapshot)
}

function propsFor(controller: LabController, messageId: MessageId): ExperienceResultCardProps {
  const usePluginLab = <T,>(selector: (view: ReturnType<LabController['getSnapshot']>) => T): T => {
    const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
    return selector(view)
  }
  return {
    messageId,
    sessionId: SESSION,
    useSession: sessionHook,
    usePluginLab,
    record: (id, outcome) => controller.record(id, outcome),
    join: () => controller.join(),
    dismiss: () => { controller.dismiss() },
  } as ExperienceResultCardProps
}

describe('rc.6 client components', () => {
  it('selects the latest durable assistant message from the rc.6 projection', () => {
    expect(latestAssistantMessageId(nodes)).toBe(LATEST)
    expect(latestAssistantMessageId([{ kind: 'user' } as ConversationNode])).toBeUndefined()
  })

  it('renders only on the latest reply and completes local-save then explicit-join clicks', async () => {
    const execute: CommandsRemote['execute'] = vi.fn(async (_sessionId, line) => ({
      ok: true as const,
      value: {
        commandId: 'command' as never,
        result: {
          kind: 'success' as const,
          text: line.startsWith('/omdsh-result') ? '已只保存在本机' : '问题回执：PL-RC6',
        },
      },
    }))
    const controller = new LabController({ execute }, SESSION)
    controller.setTrialActive(true)
    const rendered = render(<ExperienceResultCard {...propsFor(controller, OLD)} />)
    expect(screen.queryByRole('button', { name: '体验结果' })).toBeNull()

    rendered.rerender(<ExperienceResultCard {...propsFor(controller, LATEST)} />)
    fireEvent.click(screen.getByRole('button', { name: '体验结果' }))
    fireEvent.click(screen.getByRole('button', { name: '不好用' }))
    await screen.findByText('已只保存在本机')
    expect(execute).toHaveBeenLastCalledWith(SESSION, '/omdsh-result bad')

    fireEvent.click(screen.getByRole('button', { name: '加入并等待修复' }))
    await screen.findByText('问题回执：PL-RC6')
    expect(execute).toHaveBeenLastCalledWith(SESSION, '/omdsh-join latest')
    expect(screen.getByRole('button', { name: '完成' })).toBeDefined()
  })

  it('opens and closes the in-composer progress inbox', async () => {
    const checkInbox = vi.fn(async () => 'Plugin Lab 暂无新的处理进展。')
    render(<InboxButton {...({ checkInbox } as InboxButtonProps)} />)
    fireEvent.click(screen.getByRole('button', { name: '反馈进展' }))
    await waitFor(() => { expect(screen.getByRole('status').textContent).toContain('暂无新的处理进展') })
    fireEvent.click(screen.getByRole('button', { name: '反馈进展' }))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('runs one-click local health without sharing', async () => {
    const checkHealth = vi.fn(async () => '运行状态：当前运行 OK')
    render(<ProbeButton {...({ checkHealth } as ProbeButtonProps)} />)
    fireEvent.click(screen.getByRole('button', { name: '插件探活' }))
    await waitFor(() => { expect(screen.getByRole('status').textContent).toContain('当前运行 OK') })
    expect(checkHealth).toHaveBeenCalledOnce()
  })
})
