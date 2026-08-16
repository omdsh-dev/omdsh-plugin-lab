import type { MessageId } from '@deepseek-ai/dsh-client-connection/client';
import type { ConversationNode } from '@deepseek-ai/dsh-client-runtime/client';
export interface AssistantAnchor {
    readonly messageId: MessageId;
    readonly time: number;
}
/**
 * Reads only the finalized message identity and timestamp needed to place the
 * receipt controls. It never reads message blocks, tool arguments or results.
 */
export declare function latestAssistantAnchor(nodes: readonly ConversationNode[]): AssistantAnchor | undefined;
