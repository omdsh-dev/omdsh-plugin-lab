import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { ExperienceVerdict, FeedbackCategory, PluginLabPanelAction, PluginLabPanelProbe } from './protocol.js';
export interface PluginLabPanelHandlers {
    probe(agent: Agent): PluginLabPanelProbe;
    record(agent: Agent, verdict: ExperienceVerdict, category: FeedbackCategory): PluginLabPanelAction;
    join(agent: Agent): Promise<PluginLabPanelAction>;
    inbox(agent: Agent): Promise<string>;
}
/** Non-durable UI RPC. It never appends command lifecycle nodes to the Session. */
export declare class PluginLabPanelService extends TypertRemoteService {
    private readonly handlers;
    constructor(ctx: Context, handlers: PluginLabPanelHandlers);
    probe(agent: Agent): PluginLabPanelProbe;
    record(agent: Agent, verdict: ExperienceVerdict, category: FeedbackCategory): PluginLabPanelAction;
    join(agent: Agent): Promise<PluginLabPanelAction>;
    inbox(agent: Agent): Promise<string>;
}
