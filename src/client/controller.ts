import type { CommandResult } from '@deepseek-ai/dsh-commands/types'
import type { MessageId } from '@deepseek-ai/dsh-client-connection/client'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { TrialOutcome } from '../protocol.js'

interface RemoteFailure {
  readonly code: string
  readonly message: string
}

export interface CommandsRemote {
  execute: (sessionId: SessionId, line: string) => Promise<
    | { readonly ok: true; readonly value?: { readonly result: CommandResult } }
    | { readonly ok: false; readonly error: RemoteFailure }
  >
}

export interface PendingResult {
  readonly messageId: MessageId
  readonly outcome: TrialOutcome
  readonly phase: 'saving' | 'local' | 'joining' | 'joined' | 'error'
  readonly text?: string
}

export interface LabView {
  readonly active: boolean
  readonly latestMessageId?: MessageId
  readonly pending?: PendingResult
}

const INITIAL_VIEW: LabView = Object.freeze({ active: false })

function commandText(result: CommandResult | undefined): string {
  if (result === undefined) return '命令未被 DSH 接收。'
  return result.text ?? (result.kind === 'success' ? '完成。' : '操作失败。')
}

export class LabController implements HostObservable<LabView> {
  private view = INITIAL_VIEW
  private readonly listeners = new Set<() => void>()
  private readonly mounted = new Map<MessageId, number>()
  private mountOrder = 0

  constructor(
    private readonly remote: CommandsRemote,
    private readonly sessionId: SessionId,
  ) {}

  getSnapshot = (): LabView => this.view

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  setTrialActive(active: boolean): void {
    this.publish({ ...this.view, active })
  }

  observe(messageId: MessageId): () => void {
    this.mounted.set(messageId, ++this.mountOrder)
    this.publishLatest()
    return () => {
      this.mounted.delete(messageId)
      this.publishLatest()
    }
  }

  async record(messageId: MessageId, outcome: TrialOutcome): Promise<void> {
    this.publish({ ...this.view, pending: { messageId, outcome, phase: 'saving' } })
    const settled = await this.execute(`/omdsh-result ${outcome}`)
    if (settled.ok) {
      this.publish({
        ...this.view,
        active: false,
        pending: { messageId, outcome, phase: 'local', text: settled.text },
      })
    } else {
      this.publish({ ...this.view, pending: { messageId, outcome, phase: 'error', text: settled.text } })
    }
  }

  async join(): Promise<void> {
    const pending = this.view.pending
    if (pending === undefined || pending.phase !== 'local') return
    this.publish({ ...this.view, pending: { ...pending, phase: 'joining' } })
    const settled = await this.execute('/omdsh-join latest')
    this.publish({
      ...this.view,
      pending: {
        ...pending,
        phase: settled.ok ? 'joined' : 'error',
        text: settled.text,
      },
    })
  }

  async inbox(): Promise<string> {
    return (await this.execute('/omdsh-inbox')).text
  }

  dismiss(): void {
    const { pending: _pending, ...view } = this.view
    this.publish(view)
  }

  private async execute(line: string): Promise<{ ok: boolean; text: string }> {
    try {
      const result = await this.remote.execute(this.sessionId, line)
      if (!result.ok) return { ok: false, text: `${result.error.message} (${result.error.code})` }
      const command = result.value?.result
      return { ok: command?.kind === 'success', text: commandText(command) }
    } catch (error: unknown) {
      return { ok: false, text: error instanceof Error ? error.message : String(error) }
    }
  }

  private publishLatest(): void {
    let latest: [MessageId, number] | undefined
    for (const row of this.mounted) {
      if (latest === undefined || row[1] > latest[1]) latest = row
    }
    const { latestMessageId: _latestMessageId, ...view } = this.view
    this.publish(latest === undefined ? view : { ...view, latestMessageId: latest[0] })
  }

  private publish(view: LabView): void {
    this.view = Object.freeze(view)
    for (const listener of [...this.listeners]) listener()
  }
}
