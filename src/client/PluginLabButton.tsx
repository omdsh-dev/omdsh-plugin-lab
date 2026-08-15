import { useState, type CSSProperties } from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ExperienceVerdict, FeedbackCategory } from '../protocol.js'
import type { LabController } from './controller.js'

export interface PluginLabInjected {
  hooks: { pluginLab: LabController }
  record: (verdict: ExperienceVerdict, category: FeedbackCategory) => Promise<void>
  join: () => Promise<void>
  dismiss: () => void
  checkHealth: () => Promise<string>
  checkInbox: () => Promise<string>
}

export type PluginLabButtonProps = PropsRuntime<'conversation.input.left'> & InjectFace<PluginLabInjected>

const triggerStyle: CSSProperties = {
  minHeight: 30,
  padding: '0 12px',
  border: '1px solid var(--dsw-alias-border-secondary)',
  borderRadius: 14,
  cursor: 'pointer',
  background: 'var(--dsw-alias-interactive-bg-hover)',
  color: 'var(--dsw-alias-label-secondary)',
  fontSize: 12,
  fontWeight: 600,
}

const panelStyle: CSSProperties = {
  position: 'absolute',
  zIndex: 30,
  left: 0,
  bottom: 34,
  width: 314,
  padding: 14,
  border: '1px solid var(--dsw-alias-border-secondary)',
  borderRadius: 12,
  background: 'var(--dsw-alias-bg-primary)',
  color: 'var(--dsw-alias-label-primary)',
  boxShadow: '0 12px 36px rgba(0,0,0,.18)',
  fontSize: 13,
  lineHeight: 1.45,
}

const choiceStyle: CSSProperties = {
  minHeight: 32,
  border: '1px solid var(--dsw-alias-border-secondary)',
  borderRadius: 9,
  padding: '6px 9px',
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
}

const previewStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  padding: 11,
  border: '1px solid var(--dsw-alias-border-secondary)',
  borderRadius: 10,
  background: 'var(--dsw-alias-bg-secondary)',
}

const CATEGORY_CHOICES: ReadonlyArray<{ value: FeedbackCategory; label: string }> = [
  { value: 'installation', label: '安装' },
  { value: 'startup', label: '启动' },
  { value: 'invocation', label: '调用' },
  { value: 'compatibility', label: '兼容性' },
  { value: 'reliability', label: '稳定性' },
  { value: 'performance', label: '性能' },
  { value: 'result_quality', label: '结果质量' },
  { value: 'general', label: '整体体验' },
]

export function PluginLabButton({
  usePluginLab, record, join, dismiss, checkHealth, checkInbox,
}: PluginLabButtonProps) {
  const view = usePluginLab(value => value)
  const [open, setOpen] = useState(false)
  const [selectedVerdict, setSelectedVerdict] = useState<ExperienceVerdict>()
  const [health, setHealth] = useState('')
  const [healthBusy, setHealthBusy] = useState(false)
  const [inbox, setInbox] = useState<string>()
  const [inboxBusy, setInboxBusy] = useState(false)
  const pending = view.pending
  const busy = pending?.phase === 'saving' || pending?.phase === 'joining'

  const openPanel = (): void => {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    setHealthBusy(true)
    void checkHealth().then(setHealth).finally(() => { setHealthBusy(false) })
  }

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button type="button" aria-label="让 Agent 帮我反馈" style={triggerStyle} onClick={openPanel}>
        让 Agent 帮我反馈{view.active ? ' ·' : ''}
      </button>
      {open && (
        <span role="dialog" aria-label="让 Agent 帮我反馈" style={panelStyle}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ display: 'grid', gap: 2 }}>
              <strong>让 Agent 帮你反馈</strong>
              <small style={{ color: 'var(--dsw-alias-label-tertiary)' }}>只整理插件状态与点选项</small>
            </span>
            <button type="button" aria-label="关闭插件反馈" style={{ ...triggerStyle, padding: '0 4px' }} onClick={() => { setOpen(false) }}>×</button>
          </span>

          <span role="status" style={{ display: 'block', marginTop: 8, color: 'var(--dsw-alias-label-secondary)' }}>
            {healthBusy ? '正在检查…' : health}
          </span>

          {pending === undefined && !view.active && (
            <span style={{ display: 'block', marginTop: 12, color: 'var(--dsw-alias-label-secondary)' }}>
              还没有正在试用的插件。开始试用后，反馈会出现在这里。
            </span>
          )}

          {pending === undefined && view.active && selectedVerdict === undefined && (
            <span style={{ display: 'grid', gap: 9, marginTop: 12 }}>
              <strong>这次体验怎么样？</strong>
              <small style={{ color: 'var(--dsw-alias-label-tertiary)' }}>
                Agent 不读取对话来猜测体验，这一项由你选择。
              </small>
              <span style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 }}>
                <button type="button" style={choiceStyle} onClick={() => { setSelectedVerdict('good') }}>好用</button>
                <button type="button" style={choiceStyle} onClick={() => { setSelectedVerdict('mixed') }}>一般</button>
                <button type="button" style={choiceStyle} onClick={() => { setSelectedVerdict('bad') }}>不好用</button>
              </span>
            </span>
          )}

          {pending === undefined && view.active && selectedVerdict !== undefined && (
            <span style={{ display: 'grid', gap: 9, marginTop: 12 }}>
              <strong>让 Agent 按哪个方面整理？</strong>
              <span style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 7 }}>
                {CATEGORY_CHOICES.map(choice => (
                  <button
                    key={choice.value}
                    type="button"
                    style={choiceStyle}
                    onClick={() => { void record(selectedVerdict, choice.value) }}
                  >
                    {choice.label}
                  </button>
                ))}
              </span>
              <button type="button" style={{ ...triggerStyle, justifySelf: 'start', padding: 0 }} onClick={() => { setSelectedVerdict(undefined) }}>返回</button>
            </span>
          )}

          {pending !== undefined && (
            <span style={{ display: 'grid', gap: 9, marginTop: 12 }}>
              <span style={previewStyle}>
                <strong>{pending.phase === 'joined' ? '发送结果' : '发送前预览'}</strong>
                <span style={{ whiteSpace: 'pre-wrap', color: 'var(--dsw-alias-label-secondary)' }}>
                  {pending.phase === 'saving' ? 'Agent 正在生成固定模板预览…' : pending.phase === 'joining' ? '正在发送你确认的有限字段…' : pending.text}
                </span>
                {(pending.phase === 'local' || pending.phase === 'saving') && (
                  <small style={{ color: 'var(--dsw-alias-label-tertiary)' }}>
                    不会附带当前任务、本地对话、Prompt、回复或日志。
                  </small>
                )}
              </span>
              {pending.phase === 'local' && (
                <button type="button" disabled={busy} style={{ ...choiceStyle, background: 'var(--dsw-alias-interactive-bg-primary)' }} onClick={() => { void join() }}>
                  确认发送这条反馈
                </button>
              )}
              {(pending.phase === 'joined' || pending.phase === 'error') && (
                <button type="button" style={choiceStyle} onClick={() => {
                  dismiss()
                  setSelectedVerdict(undefined)
                  setOpen(false)
                }}>完成</button>
              )}
            </span>
          )}

          <span style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--dsw-alias-border-secondary)' }}>
            <button
              type="button"
              disabled={inboxBusy}
              style={{ ...triggerStyle, padding: 0 }}
              onClick={() => {
                if (inbox !== undefined) return setInbox(undefined)
                setInboxBusy(true)
                void checkInbox().then(setInbox).finally(() => { setInboxBusy(false) })
              }}
            >
              {inboxBusy ? '检查中…' : '查看进展'}
            </button>
            <small style={{ color: 'var(--dsw-alias-label-tertiary)' }}>不会调用模型读取本地对话</small>
          </span>
          {inbox !== undefined && (
            <span style={{ display: 'block', marginTop: 7, color: 'var(--dsw-alias-label-secondary)', whiteSpace: 'pre-wrap' }}>
              {inbox}
            </span>
          )}
        </span>
      )}
    </span>
  )
}
