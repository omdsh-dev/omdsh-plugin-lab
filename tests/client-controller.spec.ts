import { describe, expect, it, vi } from 'vitest'
import type { MessageId } from '@deepseek-ai/dsh-client-connection/client'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { LabController } from '../src/client/controller.js'

describe('result-card controller', () => {
  it('shows only the latest mounted reply and keeps sharing as a separate explicit action', async () => {
    const execute = vi.fn(async (_sessionId: SessionId, line: string) => ({
      ok: true as const,
      value: {
        result: {
          kind: 'success' as const,
          text: line.startsWith('/omdsh-result') ? '已只保存在本机' : '问题回执：PL-1234',
        },
      },
    }))
    const controller = new LabController({ execute }, 'session' as SessionId)
    controller.observe('old' as MessageId)
    controller.observe('latest' as MessageId)
    controller.setTrialActive(true)
    expect(controller.getSnapshot()).toMatchObject({ active: true, latestMessageId: 'latest' })

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
})
