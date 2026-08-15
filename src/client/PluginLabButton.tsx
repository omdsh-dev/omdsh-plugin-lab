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

export type PluginLabButtonProps = PropsRuntime<'conversation.input.dock'> & InjectFace<PluginLabInjected>

const triggerStyle: CSSProperties = {
  minHeight: 30,
  padding: '0 12px',
  border: '1px solid #0b5e58',
  borderRadius: 14,
  cursor: 'pointer',
  background: '#0f766e',
  color: '#ffffff',
  boxShadow: '0 1px 2px rgba(15, 23, 42, .22)',
  fontSize: 12,
  fontWeight: 600,
}

const promptStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 14,
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  border: '1px solid #475569',
  borderRadius: 12,
  background: '#151b23',
  color: '#f8fafc',
  boxShadow: '0 6px 20px rgba(0, 0, 0, .24)',
  fontSize: 13,
}

const secondaryButtonStyle: CSSProperties = {
  minHeight: 30,
  padding: '0 10px',
  border: '1px solid #475569',
  borderRadius: 9,
  cursor: 'pointer',
  background: '#26323d',
  color: '#f8fafc',
  fontSize: 12,
  fontWeight: 600,
}

const closeButtonStyle: CSSProperties = {
  ...secondaryButtonStyle,
  width: 28,
  minHeight: 28,
  padding: 0,
  borderRadius: 8,
  fontSize: 17,
  lineHeight: 1,
}

const panelStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  padding: 14,
  border: '1px solid #475569',
  borderRadius: 12,
  background: '#151b23',
  color: '#f8fafc',
  boxShadow: '0 16px 44px rgba(0, 0, 0, .48)',
  fontSize: 13,
  lineHeight: 1.45,
}

const choiceStyle: CSSProperties = {
  minHeight: 32,
  border: '1px solid #475569',
  borderRadius: 9,
  padding: '6px 9px',
  background: '#26323d',
  color: '#f8fafc',
  cursor: 'pointer',
  boxShadow: '0 1px 1px rgba(15, 23, 42, .08)',
}

const confirmStyle: CSSProperties = {
  ...choiceStyle,
  borderColor: '#0b5e58',
  background: '#0f766e',
  color: '#ffffff',
  fontWeight: 700,
  boxShadow: '0 2px 5px rgba(15, 118, 110, .28)',
}

const previewStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  padding: 11,
  border: '1px solid #334155',
  borderRadius: 10,
  background: '#0f172a',
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
  const failed = view.health === 'error' || view.health === 'unavailable'
  const visible = pending !== undefined || (view.active && failed)

  const openPanel = (): void => {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    setHealthBusy(true)
    void checkHealth().then(setHealth).finally(() => { setHealthBusy(false) })
  }

  if (!visible) return null

  const promptTitle = pending !== undefined
    ? pending.phase === 'joined' ? '反馈已提交' : '有一条反馈等待确认'
    : view.health === 'error' ? '当前插件运行报错' : '当前插件暂不可用'

  return (
    <span style={{ display: 'block', width: '100%' }}>
      {!open && (
        <span role="status" style={promptStyle}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span aria-hidden="true" style={{ width: 8, height: 8, flex: '0 0 auto', borderRadius: 999, background: '#fb7185' }} />
            <span style={{ display: 'grid', gap: 1, minWidth: 0 }}>
              <strong>{promptTitle}</strong>
              <small style={{ color: '#cbd5e1' }}>只基于 Host 状态，不读取对话或日志</small>
            </span>
          </span>
          <button type="button" aria-label="让 Agent 帮我反馈" style={triggerStyle} onClick={openPanel}>
            {pending === undefined ? '让 Agent 帮我反馈' : '查看反馈'}
          </button>
        </span>
      )}
      {open && (
        <span role="dialog" aria-label="让 Agent 帮我反馈" style={panelStyle}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ display: 'grid', gap: 2 }}>
              <strong>让 Agent 帮你反馈</strong>
              <small style={{ color: '#94a3b8' }}>只整理插件状态与点选项</small>
            </span>
            <button type="button" aria-label="关闭插件反馈" style={closeButtonStyle} onClick={() => { setOpen(false) }}>×</button>
          </span>

          <span role="status" style={{ display: 'block', marginTop: 8, color: '#cbd5e1' }}>
            {healthBusy ? '正在检查…' : health}
          </span>

          {pending === undefined && view.active && selectedVerdict === undefined && (
            <span style={{ display: 'grid', gap: 9, marginTop: 12 }}>
              <strong>这次体验怎么样？</strong>
              <small style={{ color: '#94a3b8' }}>
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
              <button type="button" style={{ ...secondaryButtonStyle, justifySelf: 'start' }} onClick={() => { setSelectedVerdict(undefined) }}>返回</button>
            </span>
          )}

          {pending !== undefined && (
            <span style={{ display: 'grid', gap: 9, marginTop: 12 }}>
              <span style={previewStyle}>
                <strong>{pending.phase === 'joined' ? '发送结果' : '发送前预览'}</strong>
                <span style={{ whiteSpace: 'pre-wrap', color: '#cbd5e1' }}>
                  {pending.phase === 'saving' ? 'Agent 正在生成固定模板预览…' : pending.phase === 'joining' ? '正在发送你确认的有限字段…' : pending.text}
                </span>
                {(pending.phase === 'local' || pending.phase === 'saving') && (
                  <small style={{ color: '#94a3b8' }}>
                    不会附带当前任务、本地对话、Prompt、回复或日志。
                  </small>
                )}
              </span>
              {pending.phase === 'local' && (
                <button type="button" disabled={busy} style={confirmStyle} onClick={() => { void join() }}>
                  确认发送这条反馈
                </button>
              )}
              {(pending.phase === 'joined' || pending.phase === 'error') && (
                <button type="button" style={secondaryButtonStyle} onClick={() => {
                  dismiss()
                  setSelectedVerdict(undefined)
                  setOpen(false)
                }}>完成</button>
              )}
            </span>
          )}

          <span style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, paddingTop: 10, borderTop: '1px solid #334155' }}>
            <button
              type="button"
              disabled={inboxBusy}
              style={secondaryButtonStyle}
              onClick={() => {
                if (inbox !== undefined) return setInbox(undefined)
                setInboxBusy(true)
                void checkInbox().then(setInbox).finally(() => { setInboxBusy(false) })
              }}
            >
              {inboxBusy ? '检查中…' : '查看进展'}
            </button>
            <small style={{ color: '#94a3b8' }}>不会调用模型读取本地对话</small>
          </span>
          {inbox !== undefined && (
            <span style={{ display: 'block', marginTop: 7, color: '#cbd5e1', whiteSpace: 'pre-wrap' }}>
              {inbox}
            </span>
          )}
        </span>
      )}
    </span>
  )
}
