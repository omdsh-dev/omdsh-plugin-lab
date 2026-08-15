import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
export interface InboxInjected {
    checkInbox: () => Promise<string>;
}
export type InboxButtonProps = PropsRuntime<'conversation.input.left'> & InjectFace<InboxInjected>;
export declare function InboxButton({ checkInbox }: InboxButtonProps): import("react").JSX.Element;
