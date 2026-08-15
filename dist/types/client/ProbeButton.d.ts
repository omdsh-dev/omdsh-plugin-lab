import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
export interface ProbeInjected {
    checkHealth: () => Promise<string>;
}
export type ProbeButtonProps = PropsRuntime<'conversation.input.left'> & InjectFace<ProbeInjected>;
export declare function ProbeButton({ checkHealth }: ProbeButtonProps): import("react").JSX.Element;
