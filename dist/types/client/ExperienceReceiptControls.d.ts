import type { ExperienceVerdict, FeedbackCategory } from '../protocol.js';
import type { LabView } from './controller.js';
export interface ExperienceReceiptControlsProps {
    readonly view: LabView;
    readonly record: (verdict: ExperienceVerdict, category: FeedbackCategory) => Promise<void>;
    readonly join: () => Promise<void>;
    readonly cancel: () => Promise<void>;
    readonly dismiss: () => void;
    readonly surface: 'reply' | 'fallback';
}
export declare function ExperienceReceiptControls({ view, record, join, cancel, dismiss, surface, }: ExperienceReceiptControlsProps): import("react").JSX.Element;
