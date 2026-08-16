import { useState, type CSSProperties } from 'react'
import {
  FEEDBACK_CATEGORIES,
  type ExperienceVerdict,
  type FeedbackCategory,
} from '../protocol.js'
import { categoryText, fixedSummary, verdictText } from '../summary.js'
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
  width: 'min(352px, calc(100vw - 28px))',
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

const fieldLabel: CSSProperties = {
  color: '#64748b',
  fontSize: 10.5,
  fontWeight: 650,
  letterSpacing: '.03em',
}

const choiceButton: CSSProperties = {
  minWidth: 0,
  height: 28,
  padding: '0 8px',
  border: '1px solid #dbe3ea',
  borderRadius: 7,
  background: '#ffffff',
  color: '#475569',
  cursor: 'pointer',
  fontSize: 11,
}

function pluginLabel(view: LabView): string {
  const plugin = view.plugin
  if (plugin === undefined) return '本次插件'
  return `${plugin.moduleName}${plugin.version === undefined ? '' : `#${plugin.version}`}`
}

export function ExperienceReceiptControls({
  view, record, join, cancel, dismiss, surface,
}: ExperienceReceiptControlsProps) {
  const [editing, setEditing] = useState(false)
  const [editVerdict, setEditVerdict] = useState<ExperienceVerdict>('mixed')
  const [editCategory, setEditCategory] = useState<FeedbackCategory>('general')
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
  const beginEditing = (): void => {
    setEditVerdict(pending.verdict)
    setEditCategory(pending.category)
    setEditing(true)
  }
  const applyEditing = (): void => {
    void record(editVerdict, editCategory).then(() => { setEditing(false) })
  }
  const editedSummary = view.plugin === undefined
    ? undefined
    : fixedSummary(view.plugin, view.health ?? 'unknown', editVerdict, editCategory)
  return (
    <span
      role="region"
      aria-label="体验回执预览"
      style={surface === 'fallback'
        ? { ...receiptStyle, width: '100%', boxShadow: 'none', background: '#f8fafc' }
        : receiptStyle}
    >
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <strong>{pending.phase === 'joined' ? '回执已发送' : editing ? '修改回执' : '发送前预览'}</strong>
        <small style={{ color: '#64748b' }}>
          {editing ? '有限字段' : `反馈大类：${categoryText(pending.category)}`}
        </small>
      </span>
      {editing && pending.phase === 'local' ? (
        <>
          <span style={{ display: 'grid', gap: 5 }}>
            <small style={fieldLabel}>体验</small>
            <span style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              {(['good', 'mixed', 'bad'] as const).map(verdict => (
                <button
                  key={verdict}
                  type="button"
                  aria-pressed={editVerdict === verdict}
                  style={editVerdict === verdict
                    ? { ...choiceButton, borderColor: '#0f766e', background: '#ecfdf5', color: '#0f5f58', fontWeight: 700 }
                    : choiceButton}
                  onClick={() => { setEditVerdict(verdict) }}
                >{verdict === 'good' ? '👍 ' : verdict === 'bad' ? '👎 ' : '— '}{verdictText(verdict)}</button>
              ))}
            </span>
          </span>
          <label style={{ display: 'grid', gap: 5 }}>
            <small style={fieldLabel}>问题大类</small>
            <select
              aria-label="问题大类"
              value={editCategory}
              onChange={event => { setEditCategory(event.currentTarget.value as FeedbackCategory) }}
              style={{
                width: '100%', height: 30, padding: '0 8px', border: '1px solid #dbe3ea', borderRadius: 7,
                background: '#fff', color: '#334155', fontSize: 11.5, outlineColor: '#0f766e',
              }}
            >
              {FEEDBACK_CATEGORIES.map(value => (
                <option key={value} value={value}>{categoryText(value)}</option>
              ))}
            </select>
          </label>
          <span style={{ display: 'grid', gap: 3, padding: '7px 8px', borderLeft: '2px solid #0f766e', background: '#f8fafc', color: '#334155' }}>
            <small style={fieldLabel}>更新后 Summary</small>
            <span>{editedSummary ?? '反馈对象状态暂不可用。'}</span>
          </span>
          <small style={{ color: '#64748b' }}>
            插件与运行状态来自 Host，不可手工改写；对象不对时请取消后重选。
          </small>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <button type="button" style={confirmButton} onClick={applyEditing}>应用修改</button>
            <button type="button" style={quietButton} onClick={() => { setEditing(false) }}>放弃修改</button>
          </span>
        </>
      ) : (
        <>
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
              <button type="button" style={quietButton} onClick={beginEditing}>修改</button>
            )}
            {pending.phase === 'local' && (
              <button type="button" style={{ ...quietButton, border: 'none', background: 'transparent' }} onClick={() => { void cancel() }}>
                取消并重选
              </button>
            )}
            {(pending.phase === 'joined' || pending.phase === 'error') && (
              <button type="button" style={quietButton} onClick={dismiss}>
                完成
              </button>
            )}
          </span>
        </>
      )}
    </span>
  )
}
