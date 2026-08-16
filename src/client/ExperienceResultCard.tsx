import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ExperienceVerdict, FeedbackCategory } from '../protocol.js'
import type { LabController } from './controller.js'
import { ExperienceReceiptControls } from './ExperienceReceiptControls.js'
import { latestAssistantAnchor } from './message-anchor.js'

export interface LabInjected {
  hooks: { pluginLab: LabController }
  record: (verdict: ExperienceVerdict, category: FeedbackCategory) => Promise<void>
  join: () => Promise<void>
  dismiss: () => void
}

export type ExperienceResultCardProps =
  PropsRuntime<'conversation.chat.assistant-actions'>
  & InjectFace<LabInjected>

/** Tiny feedback controls attached only to the first finalized reply after trial activation. */
export function ExperienceResultCard({
  messageId, useSession, usePluginLab, record, join, dismiss,
}: ExperienceResultCardProps) {
  const view = usePluginLab(value => value)
  const anchor = useSession(snapshot => latestAssistantAnchor(snapshot.nodes))
  const belongsToTrial = view.activatedAt !== undefined
    && anchor !== undefined
    && anchor.time >= view.activatedAt
    && anchor.messageId === messageId

  if (!belongsToTrial || (!view.active && view.pending === undefined)) return null
  return (
    <ExperienceReceiptControls
      view={view}
      record={record}
      join={join}
      dismiss={dismiss}
      surface="reply"
    />
  )
}
