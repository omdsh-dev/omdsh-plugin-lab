import { useState, type CSSProperties } from 'react'
import {
  MAX_FEEDBACK_SUMMARY_LENGTH,
  normalizeFeedbackSummary,
  type ExperienceVerdict,
  type FeedbackCategory,
} from '../protocol.js'
import { categoryText, verdictText } from '../summary.js'
import type { LabView } from './controller.js'

export interface ExperienceReceiptControlsProps {
  readonly view: LabView
  readonly record: (verdict: ExperienceVerdict, category: FeedbackCategory) => Promise<void>
  readonly revise: (summary: string) => Promise<void>
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

function pluginLabel(view: LabView): string {
  const plugin = view.plugin
  if (plugin === undefined) return '本次插件'
  return `${plugin.moduleName}${plugin.version === undefined ? '' : `#${plugin.version}`}`
}

export function ExperienceReceiptControls({
  view, record, revise, join, cancel, dismiss, surface,
}: ExperienceReceiptControlsProps) {
  const [editing, setEditing] = useState(false)
  const [editSummary, setEditSummary] = useState('')
  const [editError, setEditError] = useState<string>()
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
    setEditSummary(pending.summary ?? '')
    setEditError(undefined)
    setEditing(true)
  }
  const applyEditing = (): void => {
    try {
      const normalized = normalizeFeedbackSummary(editSummary)
      setEditSummary(normalized)
      setEditError(undefined)
      void revise(normalized).then(() => { setEditing(false) })
    } catch (error: unknown) {
      setEditError(error instanceof Error ? error.message : '摘要格式无效')
    }
  }
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
          {editing ? '用户编辑' : `反馈大类：${categoryText(pending.category)}`}
        </small>
      </span>
      {editing && pending.phase === 'local' ? (
        <>
          <label style={{ display: 'grid', gap: 5 }}>
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <small style={fieldLabel}>脱敏 Summary</small>
              <small style={{ color: editSummary.length > MAX_FEEDBACK_SUMMARY_LENGTH ? '#be123c' : '#94a3b8' }}>
                {editSummary.length}/{MAX_FEEDBACK_SUMMARY_LENGTH}
              </small>
            </span>
            <textarea
              aria-label="编辑脱敏 Summary"
              value={editSummary}
              maxLength={MAX_FEEDBACK_SUMMARY_LENGTH}
              rows={3}
              autoFocus
              onChange={event => { setEditSummary(event.currentTarget.value); setEditError(undefined) }}
              style={{
                width: '100%', minHeight: 68, resize: 'vertical', boxSizing: 'border-box', padding: '8px 9px',
                border: `1px solid ${editError === undefined ? '#cbd5e1' : '#e11d48'}`, borderRadius: 8,
                background: '#fff', color: '#1e293b', font: 'inherit', lineHeight: 1.5, outlineColor: '#0f766e',
              }}
            />
          </label>
          {editError !== undefined && <small role="alert" style={{ color: '#be123c' }}>{editError}</small>}
          <small style={{ color: '#64748b' }}>
            聚合标签：{verdictText(pending.verdict)} · {categoryText(pending.category)}。请勿粘贴日志、路径、密钥或任务内容。
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
                : pending.phase === 'local'
                  ? `脱敏 Summary：${pending.summary ?? pending.text ?? ''}`
                  : pending.text}
          </span>
          {(pending.phase === 'saving' || pending.phase === 'local') && (
            <small style={{ color: '#64748b' }}>
              仅发送这句摘要和只读标签；不自动附带任务、对话、日志、文件或报错详情。
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
