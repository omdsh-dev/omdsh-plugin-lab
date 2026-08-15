import type { MessageId } from '@deepseek-ai/dsh-client-connection/client';
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { TrialOutcome } from '../protocol.js';
import type { LabController } from './controller.js';
export interface LabInjected {
    hooks: {
        pluginLab: LabController;
    };
    observe: (messageId: MessageId) => () => void;
    record: (messageId: MessageId, outcome: TrialOutcome) => Promise<void>;
    join: () => Promise<void>;
    dismiss: () => void;
}
export type ExperienceResultCardProps = PropsRuntime<'conversation.chat.assistant-actions'> & InjectFace<LabInjected>;
export declare function ExperienceResultCard({ messageId, usePluginLab, observe, record, join, dismiss, }: ExperienceResultCardProps): import("react").JSX.Element | null;
