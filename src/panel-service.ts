import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type {
  ExperienceVerdict,
  FeedbackCategory,
  PluginLabPanelAction,
  PluginLabPanelProbe,
} from './protocol.js'

export interface PluginLabPanelHandlers {
  probe(agent: Agent): PluginLabPanelProbe
  record(agent: Agent, verdict: ExperienceVerdict, category: FeedbackCategory): PluginLabPanelAction
  join(agent: Agent): Promise<PluginLabPanelAction>
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

  record(
    agent: Agent,
    verdict: ExperienceVerdict,
    category: FeedbackCategory,
  ): PluginLabPanelAction {
    return this.handlers.record(agent, verdict, category)
  }

  join(agent: Agent): Promise<PluginLabPanelAction> {
    return this.handlers.join(agent)
  }

  inbox(agent: Agent): Promise<string> {
    return this.handlers.inbox(agent)
  }
}

for (const method of ['probe', 'record', 'join', 'inbox'] as const) {
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
