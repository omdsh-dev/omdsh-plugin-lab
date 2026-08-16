import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type {
  ExperienceVerdict,
  FeedbackCategory,
  PluginLabPanelAction,
  PluginLabPanelProbe,
  ReceiptBoxSnapshot,
  TrialPluginRef,
} from './protocol.js'

export interface PluginLabPanelHandlers {
  probe(agent: Agent): PluginLabPanelProbe
  select(agent: Agent, plugin: TrialPluginRef): PluginLabPanelAction
  record(agent: Agent, verdict: ExperienceVerdict, category: FeedbackCategory): PluginLabPanelAction
  revise(agent: Agent, summary: string): PluginLabPanelAction
  join(agent: Agent): Promise<PluginLabPanelAction>
  cancel(agent: Agent): PluginLabPanelAction
  discard(agent: Agent, eventId: string): PluginLabPanelAction
  receipts(agent: Agent, markRead: boolean): Promise<ReceiptBoxSnapshot>
  inbox(agent: Agent): Promise<string>
}

const remoteInitializers: Array<(this: PluginLabPanelService) => void> = []

/** Non-durable UI RPC. It never appends command lifecycle nodes to the Session. */
export class PluginLabPanelService extends TypertRemoteService {
  constructor(ctx: Context, private readonly handlers: PluginLabPanelHandlers) {
    super(ctx, 'pluginLab')
    for (const initialize of remoteInitializers) initialize.call(this)
  }

  probe(agent: Agent): PluginLabPanelProbe {
    return this.handlers.probe(agent)
  }

  select(agent: Agent, plugin: TrialPluginRef): PluginLabPanelAction {
    return this.handlers.select(agent, plugin)
  }

  record(
    agent: Agent,
    verdict: ExperienceVerdict,
    category: FeedbackCategory,
  ): PluginLabPanelAction {
    return this.handlers.record(agent, verdict, category)
  }

  revise(agent: Agent, summary: string): PluginLabPanelAction {
    return this.handlers.revise(agent, summary)
  }

  join(agent: Agent): Promise<PluginLabPanelAction> {
    return this.handlers.join(agent)
  }

  cancel(agent: Agent): PluginLabPanelAction {
    return this.handlers.cancel(agent)
  }

  discard(agent: Agent, eventId: string): PluginLabPanelAction {
    return this.handlers.discard(agent, eventId)
  }

  receipts(agent: Agent, markRead: boolean): Promise<ReceiptBoxSnapshot> {
    return this.handlers.receipts(agent, markRead)
  }

  inbox(agent: Agent): Promise<string> {
    return this.handlers.inbox(agent)
  }
}

for (const method of ['probe', 'select', 'record', 'revise', 'join', 'cancel', 'discard', 'receipts', 'inbox'] as const) {
  Remote(PluginLabPanelService.prototype[method] as never, {
    kind: 'method',
    name: method,
    static: false,
    private: false,
    addInitializer(initializer: (this: PluginLabPanelService) => void) {
      remoteInitializers.push(initializer)
    },
  } as never)
}
