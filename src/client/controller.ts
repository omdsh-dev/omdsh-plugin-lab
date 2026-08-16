import type { ClientRemote } from '@deepseek-ai/dsh-api-remotes/client'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { ExperienceVerdict, FeedbackCategory, HealthStatus, TrialPluginRef } from '../protocol.js'

/** Silent panel Remote surface. It does not create durable command nodes. */
export type PluginLabRemote = Pick<ClientRemote['pluginLab'], 'probe' | 'record' | 'join' | 'inbox'>

export interface PendingResult {
  readonly verdict: ExperienceVerdict
  readonly category: FeedbackCategory
  readonly phase: 'saving' | 'local' | 'joining' | 'joined' | 'error'
  readonly text?: string
}

export interface LabView {
  readonly active: boolean
  /** Local activation boundary used only to attach controls to a later reply. */
  readonly activatedAt?: number
  readonly plugin?: TrialPluginRef
  readonly health?: HealthStatus
  readonly suggestedCategory?: FeedbackCategory
  readonly pending?: PendingResult
}

const INITIAL_VIEW: LabView = Object.freeze({ active: false })

export class LabController implements HostObservable<LabView> {
  private view = INITIAL_VIEW
  private readonly listeners = new Set<() => void>()

  constructor(
    private readonly remote: PluginLabRemote,
    private readonly sessionId: SessionId,
  ) {}

  getSnapshot = (): LabView => this.view

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  setTrialActive(active: boolean): void {
    const {
      health: _health,
      suggestedCategory: _suggestedCategory,
      plugin: _plugin,
      activatedAt: _activatedAt,
      ...view
    } = this.view
    this.publish({ ...view, active, ...(active ? { activatedAt: Date.now() } : {}) })
  }

  async record(
    verdict: ExperienceVerdict,
    category: FeedbackCategory,
  ): Promise<void> {
    this.publish({ ...this.view, pending: { verdict, category, phase: 'saving' } })
    const settled = await this.call(() => this.remote.record(this.sessionId, verdict, category))
    if (settled.ok && settled.value.ok) {
      this.publish({
        ...this.view,
        active: false,
        pending: { verdict, category, phase: 'local', text: settled.value.text },
      })
    } else {
      this.publish({
        ...this.view,
        pending: {
          verdict,
          category,
          phase: 'error',
          text: settled.ok ? settled.value.text : settled.text,
        },
      })
    }
  }

  async join(): Promise<void> {
    const pending = this.view.pending
    if (pending === undefined || pending.phase !== 'local') return
    this.publish({ ...this.view, pending: { ...pending, phase: 'joining' } })
    const settled = await this.call(() => this.remote.join(this.sessionId))
    this.publish({
      ...this.view,
      pending: {
        ...pending,
        phase: settled.ok && settled.value.ok ? 'joined' : 'error',
        text: settled.ok ? settled.value.text : settled.text,
      },
    })
  }

  async inbox(): Promise<string> {
    const result = await this.call(() => this.remote.inbox(this.sessionId))
    return result.ok ? result.value : result.text
  }

  async probe(): Promise<string> {
    const result = await this.call(() => this.remote.probe(this.sessionId))
    if (!result.ok) return result.text
    this.publish({
      ...this.view,
      active: result.value.active,
      ...(result.value.plugin === undefined ? {} : { plugin: result.value.plugin }),
      health: result.value.health,
      suggestedCategory: result.value.suggestedCategory,
    })
    return result.value.text
  }

  dismiss(): void {
    const { pending: _pending, ...view } = this.view
    this.publish(view)
  }

  private async call<T>(task: () => Promise<{ readonly ok: true; readonly value: T } | {
    readonly ok: false
    readonly error: { readonly message: string; readonly code: string }
  }>): Promise<{ ok: true; value: T } | { ok: false; text: string }> {
    try {
      const result = await task()
      if (!result.ok) return { ok: false, text: `${result.error.message} (${result.error.code})` }
      return { ok: true, value: result.value }
    } catch (error: unknown) {
      return { ok: false, text: error instanceof Error ? error.message : String(error) }
    }
  }

  private publish(view: LabView): void {
    this.view = Object.freeze(view)
    for (const listener of [...this.listeners]) listener()
  }
}
