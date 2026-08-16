import { useEffect } from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ExperienceVerdict, FeedbackCategory } from '../protocol.js'
import type { LabController } from './controller.js'
import { ExperienceReceiptControls } from './ExperienceReceiptControls.js'
import { latestAssistantAnchor } from './message-anchor.js'

export interface LabInjected {
  hooks: { pluginLab: LabController }
  record: (verdict: ExperienceVerdict, category: FeedbackCategory) => Promise<void>
  join: () => Promise<void>
  cancel: () => Promise<void>
  refresh: () => Promise<string>
  dismiss: () => void
}

export type ExperienceResultCardProps =
  PropsRuntime<'conversation.chat.assistant-actions'>
  & InjectFace<LabInjected>

/** Tiny feedback controls attached only to the first finalized reply after trial activation. */
export function ExperienceResultCard({
  messageId, useSession, usePluginLab, record, join, cancel, refresh, dismiss,
}: ExperienceResultCardProps) {
  const view = usePluginLab(value => value)
  const anchor = useSession(snapshot => latestAssistantAnchor(snapshot.nodes))
  const belongsToTrial = view.activatedAt !== undefined
    && anchor !== undefined
    && anchor.time >= view.activatedAt
    && anchor.messageId === messageId

  useEffect(() => {
    if (belongsToTrial) void refresh()
  }, [belongsToTrial, messageId, refresh])

  if (!belongsToTrial || (!view.active && view.pending === undefined)) return null
  return (
    <ExperienceReceiptControls
      view={view}
      record={record}
      join={join}
      cancel={cancel}
      dismiss={dismiss}
      surface="reply"
    />
  )
}
