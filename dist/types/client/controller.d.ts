import type { ClientRemote } from '@deepseek-ai/dsh-api-remotes/client';
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client';
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots';
import type { ExperienceVerdict, FeedbackCategory, HealthStatus, ReceiptBoxSnapshot, TrialPluginRef } from '../protocol.js';
/** Silent panel Remote surface. It does not create durable command nodes. */
export type PluginLabRemote = Pick<ClientRemote['pluginLab'], 'probe' | 'select' | 'record' | 'join' | 'cancel' | 'discard' | 'receipts' | 'inbox'>;
export interface PendingResult {
    readonly verdict: ExperienceVerdict;
    readonly category: FeedbackCategory;
    readonly phase: 'saving' | 'local' | 'joining' | 'joined' | 'error';
    readonly text?: string;
}
export interface LabView {
    readonly active: boolean;
    /** Local activation boundary used only to attach controls to a later reply. */
    readonly activatedAt?: number;
    readonly plugin?: TrialPluginRef;
    readonly manualSelection?: boolean;
    readonly health?: HealthStatus;
    readonly suggestedCategory?: FeedbackCategory;
    readonly pending?: PendingResult;
    readonly receiptBox?: ReceiptBoxSnapshot;
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
    selectPlugin(plugin: TrialPluginRef): Promise<string>;
    cancel(): Promise<string>;
    discard(eventId: string): Promise<string>;
    receipts(markRead: boolean): Promise<ReceiptBoxSnapshot>;
    inbox(): Promise<string>;
    probe(): Promise<string>;
    dismiss(): void;
    private call;
    private publish;
}
