import type { CommandResult } from '@deepseek-ai/dsh-commands/types'
import type { ClientRemote } from '@deepseek-ai/dsh-api-remotes/client'
import type { MessageId } from '@deepseek-ai/dsh-client-connection/client'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { ExperienceVerdict } from '../protocol.js'

/** Exact rc.6 generated command Remote surface, kept narrow for testability. */
export type CommandsRemote = Pick<ClientRemote['commands'], 'execute'>

export interface PendingResult {
  readonly messageId: MessageId
  readonly verdict: ExperienceVerdict
  readonly phase: 'saving' | 'local' | 'joining' | 'joined' | 'error'
  readonly text?: string
}

export interface LabView {
  readonly active: boolean
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

  async record(messageId: MessageId, verdict: ExperienceVerdict): Promise<void> {
    this.publish({ ...this.view, pending: { messageId, verdict, phase: 'saving' } })
    const settled = await this.execute(`/omdsh-result ${verdict}`)
    if (settled.ok) {
      this.publish({
        ...this.view,
        active: false,
        pending: { messageId, verdict, phase: 'local', text: settled.text },
      })
    } else {
      this.publish({ ...this.view, pending: { messageId, verdict, phase: 'error', text: settled.text } })
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

  async probe(): Promise<string> {
    return (await this.execute('/omdsh-probe')).text
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

  private publish(view: LabView): void {
    this.view = Object.freeze(view)
    for (const listener of [...this.listeners]) listener()
  }
}
