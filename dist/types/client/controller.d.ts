import type { ClientRemote } from '@deepseek-ai/dsh-api-remotes/client';
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client';
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots';
import type { ExperienceVerdict, FeedbackCategory } from '../protocol.js';
/** Silent panel Remote surface. It does not create durable command nodes. */
export type PluginLabRemote = Pick<ClientRemote['pluginLab'], 'probe' | 'record' | 'join' | 'inbox'>;
export interface PendingResult {
    readonly verdict: ExperienceVerdict;
    readonly category: FeedbackCategory;
    readonly phase: 'saving' | 'local' | 'joining' | 'joined' | 'error';
    readonly text?: string;
}
export interface LabView {
    readonly active: boolean;
    readonly pending?: PendingResult;
}
export declare class LabController implements HostObservable<LabView> {
    private readonly remote;
    private readonly sessionId;
    private view;
    private readonly listeners;
    constructor(remote: PluginLabRemote, sessionId: SessionId);
    getSnapshot: () => LabView;
    subscribe: (listener: () => void) => (() => void);
    setTrialActive(active: boolean): void;
    record(verdict: ExperienceVerdict, category: FeedbackCategory): Promise<void>;
    join(): Promise<void>;
    inbox(): Promise<string>;
    probe(): Promise<string>;
    dismiss(): void;
    private call;
    private publish;
}
