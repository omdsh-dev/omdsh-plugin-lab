import type { MessageId } from '@deepseek-ai/dsh-client-connection/client';
import type { ConversationNode } from '@deepseek-ai/dsh-client-runtime/client';
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { ExperienceVerdict, FeedbackCategory } from '../protocol.js';
import type { LabController } from './controller.js';
export interface LabInjected {
    hooks: {
        pluginLab: LabController;
    };
    record: (messageId: MessageId, verdict: ExperienceVerdict, category: FeedbackCategory) => Promise<void>;
    join: () => Promise<void>;
    dismiss: () => void;
}
export type ExperienceResultCardProps = PropsRuntime<'conversation.chat.assistant-actions'> & InjectFace<LabInjected>;
/** Latest durable assistant identity from the rc.6 conversation projection. */
export declare function latestAssistantMessageId(nodes: readonly ConversationNode[]): MessageId | undefined;
export declare function ExperienceResultCard({ messageId, useSession, usePluginLab, record, join, dismiss, }: ExperienceResultCardProps): import("react").JSX.Element | null;
