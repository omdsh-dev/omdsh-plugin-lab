import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { ExperienceVerdict, FeedbackCategory } from '../protocol.js';
import type { LabController } from './controller.js';
export interface LabInjected {
    hooks: {
        pluginLab: LabController;
    };
    record: (verdict: ExperienceVerdict, category: FeedbackCategory) => Promise<void>;
    join: () => Promise<void>;
    dismiss: () => void;
}
export type ExperienceResultCardProps = PropsRuntime<'conversation.chat.assistant-actions'> & InjectFace<LabInjected>;
/** Tiny feedback controls attached only to the first finalized reply after trial activation. */
export declare function ExperienceResultCard({ messageId, useSession, usePluginLab, record, join, dismiss, }: ExperienceResultCardProps): import("react").JSX.Element | null;
