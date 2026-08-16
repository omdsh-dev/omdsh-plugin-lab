import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client';
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol';
import type { ExperienceVerdict, FeedbackCategory, PluginLabPanelAction, PluginLabPanelProbe, ReceiptBoxSnapshot, TrialPluginRef } from './protocol.js';
interface PluginLabRemoteNamespace {
    probe: (agentId: SessionId) => Promise<RemoteResult<PluginLabPanelProbe>>;
    select: (agentId: SessionId, plugin: TrialPluginRef) => Promise<RemoteResult<PluginLabPanelAction>>;
    record: (agentId: SessionId, verdict: ExperienceVerdict, category: FeedbackCategory) => Promise<RemoteResult<PluginLabPanelAction>>;
    revise: (agentId: SessionId, summary: string) => Promise<RemoteResult<PluginLabPanelAction>>;
    join: (agentId: SessionId) => Promise<RemoteResult<PluginLabPanelAction>>;
    cancel: (agentId: SessionId) => Promise<RemoteResult<PluginLabPanelAction>>;
    discard: (agentId: SessionId, eventId: string) => Promise<RemoteResult<PluginLabPanelAction>>;
    receipts: (agentId: SessionId, markRead: boolean) => Promise<RemoteResult<ReceiptBoxSnapshot>>;
    inbox: (agentId: SessionId) => Promise<RemoteResult<string>>;
}
declare module '@deepseek-ai/dsh-typert-protocol' {
    interface TypertRemoteNamespaceMap {
        pluginLab: PluginLabRemoteNamespace;
    }
    interface TypertRemoteMap {
        'pluginLab/probe': PluginLabRemoteNamespace['probe'];
        'pluginLab/select': PluginLabRemoteNamespace['select'];
        'pluginLab/record': PluginLabRemoteNamespace['record'];
        'pluginLab/revise': PluginLabRemoteNamespace['revise'];
        'pluginLab/join': PluginLabRemoteNamespace['join'];
        'pluginLab/cancel': PluginLabRemoteNamespace['cancel'];
        'pluginLab/discard': PluginLabRemoteNamespace['discard'];
        'pluginLab/receipts': PluginLabRemoteNamespace['receipts'];
        'pluginLab/inbox': PluginLabRemoteNamespace['inbox'];
    }
}
export declare const TYPERT_REMOTE: TypertRemoteContribution;
export default TYPERT_REMOTE;
