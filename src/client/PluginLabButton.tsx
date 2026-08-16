import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ExperienceVerdict, FeedbackCategory } from '../protocol.js'
import type { LabController } from './controller.js'
import { ExperienceReceiptControls } from './ExperienceReceiptControls.js'
import { latestAssistantAnchor } from './message-anchor.js'

export interface PluginLabInjected {
  hooks: { pluginLab: LabController }
  record: (verdict: ExperienceVerdict, category: FeedbackCategory) => Promise<void>
  join: () => Promise<void>
  dismiss: () => void
}

export type PluginLabButtonProps = PropsRuntime<'conversation.input.dock'> & InjectFace<PluginLabInjected>

/**
 * Compact fallback for command/UI/crash plugins that produce no later Agent
 * reply. Once a finalized reply exists, its own action row owns the controls.
 */
export function PluginLabButton({
  useSession, usePluginLab, record, join, dismiss,
}: PluginLabButtonProps) {
  const view = usePluginLab(value => value)
  const latest = useSession(snapshot => latestAssistantAnchor(snapshot.nodes))
  const hasReplyAfterActivation = view.activatedAt !== undefined
    && latest !== undefined
    && latest.time >= view.activatedAt
  const failed = view.health === 'error' || view.health === 'unavailable'
  const visible = (view.active && failed) || view.pending !== undefined

  if (!visible || hasReplyAfterActivation) return null
  return (
    <span style={{ display: 'flex', width: '100%', justifyContent: 'flex-end', padding: '2px 0' }}>
      <ExperienceReceiptControls
        view={view}
        record={record}
        join={join}
        dismiss={dismiss}
        surface="fallback"
      />
    </span>
  )
}
