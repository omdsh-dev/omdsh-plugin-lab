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
}
export type PluginLabButtonProps = PropsRuntime<'conversation.input.dock'> & InjectFace<PluginLabInjected>;
/**
 * Compact fallback for command/UI/crash plugins that produce no later Agent
 * reply. Once a finalized reply exists, its own action row owns the controls.
 */
export declare function PluginLabButton({ useSession, usePluginLab, record, join, dismiss, }: PluginLabButtonProps): import("react").JSX.Element | null;
