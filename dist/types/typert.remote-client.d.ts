import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client';
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol';
import type { ExperienceVerdict, FeedbackCategory, PluginLabPanelAction, PluginLabPanelProbe } from './protocol.js';
interface PluginLabRemoteNamespace {
    probe: (agentId: SessionId) => Promise<RemoteResult<PluginLabPanelProbe>>;
    record: (agentId: SessionId, verdict: ExperienceVerdict, category: FeedbackCategory) => Promise<RemoteResult<PluginLabPanelAction>>;
    join: (agentId: SessionId) => Promise<RemoteResult<PluginLabPanelAction>>;
    inbox: (agentId: SessionId) => Promise<RemoteResult<string>>;
}
declare module '@deepseek-ai/dsh-typert-protocol' {
    interface TypertRemoteNamespaceMap {
        pluginLab: PluginLabRemoteNamespace;
    }
    interface TypertRemoteMap {
        'pluginLab/probe': PluginLabRemoteNamespace['probe'];
        'pluginLab/record': PluginLabRemoteNamespace['record'];
        'pluginLab/join': PluginLabRemoteNamespace['join'];
        'pluginLab/inbox': PluginLabRemoteNamespace['inbox'];
    }
}
export declare const TYPERT_REMOTE: TypertRemoteContribution;
export default TYPERT_REMOTE;
