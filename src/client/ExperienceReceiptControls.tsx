import type { CSSProperties } from 'react'
import type { ExperienceVerdict, FeedbackCategory } from '../protocol.js'
import { categoryText } from '../summary.js'
import type { LabView } from './controller.js'

export interface ExperienceReceiptControlsProps {
  readonly view: LabView
  readonly record: (verdict: ExperienceVerdict, category: FeedbackCategory) => Promise<void>
  readonly join: () => Promise<void>
  readonly cancel: () => Promise<void>
  readonly dismiss: () => void
  readonly surface: 'reply' | 'fallback'
}

const quietButton: CSSProperties = {
  minWidth: 28,
  height: 26,
  padding: '0 6px',
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  cursor: 'pointer',
  background: '#f1f5f9',
  color: '#334155',
  fontSize: 13,
  lineHeight: 1,
}

const confirmButton: CSSProperties = {
  ...quietButton,
  width: 'auto',
  padding: '0 10px',
  borderColor: '#0b5e58',
  background: '#0f766e',
  color: '#fff',
  fontSize: 12,
  fontWeight: 650,
}

const receiptStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  width: 'min(420px, calc(100vw - 40px))',
  boxSizing: 'border-box',
  padding: '9px 10px',
  border: '1px solid #cbd5e1',
  borderRadius: 10,
  background: '#ffffff',
  color: '#0f172a',
  boxShadow: '0 5px 18px rgba(15, 23, 42, .12)',
  fontSize: 12,
  lineHeight: 1.45,
}

function pluginLabel(view: LabView): string {
  const plugin = view.plugin
  if (plugin === undefined) return '本次插件'
  return `${plugin.moduleName}${plugin.version === undefined ? '' : `#${plugin.version}`}`
}

export function ExperienceReceiptControls({
  view, record, join, cancel, dismiss, surface,
}: ExperienceReceiptControlsProps) {
  const pending = view.pending
  const category = view.suggestedCategory ?? 'general'
  const categoryName = categoryText(category)
  const label = pluginLabel(view)

  if (pending === undefined) {
    return (
      <span
        role="group"
        aria-label={`${label} 体验反馈`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0 }}
      >
        <small
          title={label}
          style={{ maxWidth: surface === 'reply' ? 132 : 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#64748b' }}
        >
          {surface === 'reply' ? label : `${label} · 体验如何？`}
        </small>
        <button
          type="button"
          aria-label="好用"
          title={`好用 · Agent 自动归类为${categoryName}`}
          style={quietButton}
          onClick={() => { void record('good', category) }}
        >👍</button>
        <button
          type="button"
          aria-label="不好用"
          title={`不好用 · Agent 自动归类为${categoryName}`}
          style={quietButton}
          onClick={() => { void record('bad', category) }}
        >👎</button>
      </span>
    )
  }

  const working = pending.phase === 'saving' || pending.phase === 'joining'
  return (
    <span
      role="region"
      aria-label="体验回执预览"
      style={surface === 'fallback'
        ? { ...receiptStyle, width: '100%', boxShadow: 'none', background: '#f8fafc' }
        : receiptStyle}
    >
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <strong>{pending.phase === 'joined' ? '回执已发送' : '发送前预览'}</strong>
        <small style={{ color: '#64748b' }}>
          Agent 分类：{categoryText(pending.category)}
        </small>
      </span>
      <span style={{ whiteSpace: 'pre-wrap', color: '#334155' }}>
        {pending.phase === 'saving'
          ? '正在本地生成固定模板 Summary…'
          : pending.phase === 'joining'
            ? '正在发送你看到的有限字段…'
            : pending.text}
      </span>
      {(pending.phase === 'saving' || pending.phase === 'local') && (
        <small style={{ color: '#64748b' }}>
          未读取或附带任务、对话正文、Prompt、回复、日志、文件或报错详情。
        </small>
      )}
      <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        {pending.phase === 'local' && (
          <button type="button" disabled={working} style={confirmButton} onClick={() => { void join() }}>
            确认发送
          </button>
        )}
        {pending.phase === 'local' && (
          <button
            type="button"
            style={quietButton}
            onClick={() => { void record(pending.verdict === 'good' ? 'bad' : 'good', pending.category) }}
          >
            改为{pending.verdict === 'good' ? '👎' : '👍'}
          </button>
        )}
        {pending.phase === 'local' && (
          <button type="button" style={{ ...quietButton, border: 'none', background: 'transparent' }} onClick={() => { void cancel() }}>
            取消
          </button>
        )}
        {(pending.phase === 'joined' || pending.phase === 'error') && (
          <button type="button" style={quietButton} onClick={dismiss}>
            完成
          </button>
        )}
      </span>
    </span>
  )
}
