import * as react0 from "react";
import { ClientContext, SessionId } from "@deepseek-ai/dsh-client-runtime/client";
import { MessageId } from "@deepseek-ai/dsh-client-connection/client";
import { HostObservable, InjectFace, PropsRuntime } from "@deepseek-ai/dsh-client-ui-slots";
import { CommandResult } from "@deepseek-ai/dsh-commands/types";

//#region src/protocol.d.ts
type TrialOutcome = 'worked' | 'partial' | 'failed';
//#endregion
//#region src/client/controller.d.ts
interface RemoteFailure {
  readonly code: string;
  readonly message: string;
}
interface CommandsRemote {
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
interface PendingResult {
  readonly messageId: MessageId;
  readonly outcome: TrialOutcome;
  readonly phase: 'saving' | 'local' | 'joining' | 'joined' | 'error';
  readonly text?: string;
}
interface LabView {
  readonly active: boolean;
  readonly latestMessageId?: MessageId;
  readonly pending?: PendingResult;
}
declare class LabController implements HostObservable<LabView> {
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
//#endregion
//#region src/client/ExperienceResultCard.d.ts
interface LabInjected {
  hooks: {
    pluginLab: LabController;
  };
  observe: (messageId: MessageId) => () => void;
  record: (messageId: MessageId, outcome: TrialOutcome) => Promise<void>;
  join: () => Promise<void>;
  dismiss: () => void;
}
type ExperienceResultCardProps = PropsRuntime<'conversation.chat.assistant-actions'> & InjectFace<LabInjected>;
declare function ExperienceResultCard({
  messageId,
  usePluginLab,
  observe,
  record,
  join,
  dismiss
}: ExperienceResultCardProps): react0.JSX.Element | null;
//#endregion
//#region src/client/InboxButton.d.ts
interface InboxInjected {
  checkInbox: () => Promise<string>;
}
type InboxButtonProps = PropsRuntime<'conversation.input.left'> & InjectFace<InboxInjected>;
declare function InboxButton({
  checkInbox
}: InboxButtonProps): react0.JSX.Element;
//#endregion
//#region src/client/index.d.ts
declare const inject: string[];
declare function apply(ctx: ClientContext): void;
//#endregion
export { ExperienceResultCard, InboxButton, LabController, apply, inject };
//# sourceMappingURL=client.d.ts.map