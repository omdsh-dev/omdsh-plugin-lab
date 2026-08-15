import { useState, type CSSProperties } from 'react'
import type { MessageId } from '@deepseek-ai/dsh-client-connection/client'
import type { ConversationNode } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { TrialOutcome } from '../protocol.js'
import type { LabController, LabView } from './controller.js'

export interface LabInjected {
  hooks: { pluginLab: LabController }
  record: (messageId: MessageId, outcome: TrialOutcome) => Promise<void>
  join: () => Promise<void>
  dismiss: () => void
}

export type ExperienceResultCardProps =
  PropsRuntime<'conversation.chat.assistant-actions'>
  & InjectFace<LabInjected>

const triggerStyle: CSSProperties = {
  border: 'none', borderRadius: 14, padding: '4px 9px', cursor: 'pointer',
  background: 'var(--dsw-alias-interactive-bg-hover)',
  color: 'var(--dsw-alias-label-secondary)', fontSize: 12,
}

const panelStyle: CSSProperties = {
  position: 'absolute', zIndex: 30, right: 0, bottom: 34, width: 330,
  padding: 14, border: '1px solid var(--dsw-alias-border-secondary)', borderRadius: 12,
  background: 'var(--dsw-alias-bg-primary)', color: 'var(--dsw-alias-label-primary)',
  boxShadow: '0 12px 36px rgba(0,0,0,.18)', fontSize: 13, lineHeight: 1.5,
}

const choiceStyle: CSSProperties = {
  border: '1px solid var(--dsw-alias-border-secondary)', borderRadius: 9,
  padding: '7px 9px', background: 'transparent', color: 'inherit', cursor: 'pointer',
}

function shareLabel(outcome: TrialOutcome): string {
  if (outcome === 'worked') return '贡献匿名实测'
  if (outcome === 'partial') return '查找相似问题'
  return '加入并等待修复'
}

/** Latest durable assistant identity from the rc.6 conversation projection. */
export function latestAssistantMessageId(nodes: readonly ConversationNode[]): MessageId | undefined {
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index]
    if (node?.kind === 'assistant' && node.messageId !== undefined) return node.messageId
  }
  return undefined
}

function visible(view: LabView, messageId: MessageId, latestMessageId: MessageId | undefined): boolean {
  return view.pending?.messageId === messageId
    || (view.active && latestMessageId === messageId)
}

export function ExperienceResultCard({
  messageId, useSession, usePluginLab, record, join, dismiss,
}: ExperienceResultCardProps) {
  const view = usePluginLab(value => value)
  const latestMessageId = useSession(snapshot => latestAssistantMessageId(snapshot.nodes))
  const [open, setOpen] = useState(false)
  if (!visible(view, messageId, latestMessageId)) return null
  const pending = view.pending?.messageId === messageId ? view.pending : undefined
  const busy = pending?.phase === 'saving' || pending?.phase === 'joining'
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button type="button" style={triggerStyle} onClick={() => { setOpen(value => !value) }}>
        {pending?.phase === 'joined' ? '已加入跟进' : '体验结果'}
      </button>
      {open && (
        <span role="dialog" aria-label="插件体验结果" style={panelStyle}>
          <strong style={{ display: 'block', marginBottom: 9 }}>这次插件把事情做成了吗？</strong>
          {pending === undefined && (
            <span style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 }}>
              <button type="button" style={choiceStyle} onClick={() => { void record(messageId, 'worked') }}>做成了</button>
              <button type="button" style={choiceStyle} onClick={() => { void record(messageId, 'partial') }}>做了一部分</button>
              <button type="button" style={choiceStyle} onClick={() => { void record(messageId, 'failed') }}>没做成</button>
            </span>
          )}
          {pending !== undefined && (
            <span style={{ display: 'grid', gap: 9 }}>
              <span style={{ whiteSpace: 'pre-wrap', color: 'var(--dsw-alias-label-secondary)' }}>
                {pending.phase === 'saving' ? '正在只存到本机…' : pending.text}
              </span>
              {pending.phase === 'local' && (
                <button type="button" style={{ ...choiceStyle, background: 'var(--dsw-alias-interactive-bg-primary)' }} onClick={() => { void join() }}>
                  {shareLabel(pending.outcome)}
                </button>
              )}
              {(pending.phase === 'joined' || pending.phase === 'error') && (
                <button type="button" style={choiceStyle} onClick={() => { dismiss(); setOpen(false) }}>完成</button>
              )}
            </span>
          )}
          <small style={{ display: 'block', marginTop: 10, color: 'var(--dsw-alias-label-tertiary)' }}>
            第一步只保存在本机；加入跟进仅发送插件、版本、结果与无内容运行指标，不发送对话正文。
          </small>
        </span>
      )}
    </span>
  )
}
