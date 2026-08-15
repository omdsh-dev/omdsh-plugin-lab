import type { ClientRemote } from '@deepseek-ai/dsh-api-remotes/client';
import type { MessageId } from '@deepseek-ai/dsh-client-connection/client';
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client';
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots';
import type { ExperienceVerdict } from '../protocol.js';
/** Exact rc.6 generated command Remote surface, kept narrow for testability. */
export type CommandsRemote = Pick<ClientRemote['commands'], 'execute'>;
export interface PendingResult {
    readonly messageId: MessageId;
    readonly verdict: ExperienceVerdict;
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
    constructor(remote: CommandsRemote, sessionId: SessionId);
    getSnapshot: () => LabView;
    subscribe: (listener: () => void) => (() => void);
    setTrialActive(active: boolean): void;
    record(messageId: MessageId, verdict: ExperienceVerdict): Promise<void>;
    join(): Promise<void>;
    inbox(): Promise<string>;
    probe(): Promise<string>;
    dismiss(): void;
    private execute;
    private publish;
}
