import { describe, expect, it, vi } from 'vitest'
import type { MessageId } from '@deepseek-ai/dsh-client-connection/client'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { LabController, type CommandsRemote } from '../src/client/controller.js'

describe('result-card controller', () => {
  it('shows only the latest mounted reply and keeps sharing as a separate explicit action', async () => {
    const execute: CommandsRemote['execute'] = vi.fn(async (_sessionId: SessionId, line: string) => ({
      ok: true as const,
      value: {
        commandId: 'command' as never,
        result: {
          kind: 'success' as const,
          text: line.startsWith('/omdsh-result') ? '已只保存在本机' : '问题回执：PL-1234',
        },
      },
    }))
    const controller = new LabController({ execute }, 'session' as SessionId)
    controller.setTrialActive(true)
    expect(controller.getSnapshot()).toMatchObject({ active: true })

    await controller.record('latest' as MessageId, 'failed')
    expect(execute).toHaveBeenLastCalledWith('session', '/omdsh-result failed')
    expect(controller.getSnapshot()).toMatchObject({
      active: false,
      pending: { outcome: 'failed', phase: 'local' },
    })

    await controller.join()
    expect(execute).toHaveBeenLastCalledWith('session', '/omdsh-join latest')
    expect(controller.getSnapshot().pending).toMatchObject({ phase: 'joined', text: '问题回执：PL-1234' })
  })

  it('surfaces rc.6 transport failures and undefined command admissions', async () => {
    const failed: CommandsRemote['execute'] = vi.fn(async () => ({
      ok: false as const,
      error: { code: 'disconnected', message: '连接已断开' } as never,
    }))
    const controller = new LabController({ execute: failed }, 'session' as SessionId)
    controller.setTrialActive(true)
    await controller.record('message' as MessageId, 'partial')
    expect(controller.getSnapshot().pending).toMatchObject({
      phase: 'error', text: '连接已断开 (disconnected)',
    })

    const absent: CommandsRemote['execute'] = vi.fn(async () => ({ ok: true as const, value: undefined }))
    const second = new LabController({ execute: absent }, 'session' as SessionId)
    second.setTrialActive(true)
    await second.record('message' as MessageId, 'failed')
    expect(second.getSnapshot().pending).toMatchObject({
      phase: 'error', text: '命令未被 DSH 接收。',
    })
  })
})
