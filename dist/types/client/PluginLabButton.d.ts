import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { ExperienceVerdict, FeedbackCategory, ReceiptBoxSnapshot, TrialPluginRef } from '../protocol.js';
import type { LabController } from './controller.js';
export interface PluginChoice {
    readonly moduleName: string;
    readonly enabled: boolean;
    readonly fiberPhase: 'pending' | 'loading' | 'active' | 'failed' | 'unloading' | null;
}
export interface PluginLabInjected {
    hooks: {
        pluginLab: LabController;
    };
    record: (verdict: ExperienceVerdict, category: FeedbackCategory) => Promise<void>;
    revise: (summary: string) => Promise<void>;
    join: () => Promise<void>;
    cancel: () => Promise<void>;
    dismiss: () => void;
    selectPlugin: (plugin: TrialPluginRef) => Promise<string>;
    listPlugins: () => Promise<readonly PluginChoice[]>;
    loadReceipts: (markRead: boolean) => Promise<ReceiptBoxSnapshot>;
    discardReceipt: (eventId: string) => Promise<string>;
}
export type PluginLabButtonProps = PropsRuntime<'conversation.input.dock'> & InjectFace<PluginLabInjected>;
/** One persistent receipt entry for selection, feedback and progress. */
export declare function PluginLabButton({ useSession, usePluginLab, record, revise, join, cancel, dismiss, selectPlugin, listPlugins, loadReceipts, discardReceipt, }: PluginLabButtonProps): import("react").JSX.Element;
