import type { CommandResult } from '@deepseek-ai/dsh-commands/types';
import type { MessageId } from '@deepseek-ai/dsh-client-connection/client';
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client';
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots';
import type { TrialOutcome } from '../protocol.js';
interface RemoteFailure {
    readonly code: string;
    readonly message: string;
}
export interface CommandsRemote {
    execute: (sessionId: SessionId, line: string) => Promise<{
        readonly ok: true;
        readonly value?: {
            readonly result: CommandResult;
        };
    } | {
        readonly ok: false;
        readonly error: RemoteFailure;
    }>;
}
export interface PendingResult {
    readonly messageId: MessageId;
    readonly outcome: TrialOutcome;
    readonly phase: 'saving' | 'local' | 'joining' | 'joined' | 'error';
    readonly text?: string;
}
export interface LabView {
    readonly active: boolean;
    readonly latestMessageId?: MessageId;
    readonly pending?: PendingResult;
}
export declare class LabController implements HostObservable<LabView> {
    private readonly remote;
    private readonly sessionId;
    private view;
    private readonly listeners;
    private readonly mounted;
    private mountOrder;
    constructor(remote: CommandsRemote, sessionId: SessionId);
    getSnapshot: () => LabView;
    subscribe: (listener: () => void) => (() => void);
    setTrialActive(active: boolean): void;
    observe(messageId: MessageId): () => void;
    record(messageId: MessageId, outcome: TrialOutcome): Promise<void>;
    join(): Promise<void>;
    inbox(): Promise<string>;
    dismiss(): void;
    private execute;
    private publishLatest;
    private publish;
}
export {};
