import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { ExperienceVerdict, FeedbackCategory } from '../protocol.js';
import type { LabController } from './controller.js';
export interface PluginLabInjected {
    hooks: {
        pluginLab: LabController;
    };
    record: (verdict: ExperienceVerdict, category: FeedbackCategory) => Promise<void>;
    join: () => Promise<void>;
    dismiss: () => void;
    checkHealth: () => Promise<string>;
    checkInbox: () => Promise<string>;
}
export type PluginLabButtonProps = PropsRuntime<'conversation.input.left'> & InjectFace<PluginLabInjected>;
export declare function PluginLabButton({ usePluginLab, record, join, dismiss, checkHealth, checkInbox, }: PluginLabButtonProps): import("react").JSX.Element;
