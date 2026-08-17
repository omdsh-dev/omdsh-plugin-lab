import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  ExperienceVerdict, FeedbackCategory, PluginLabRevision, ReceiptBoxSnapshot, ReceiptProgressItem, TrialPluginRef,
} from '../protocol.js'
import type { LabController } from './controller.js'
import { ExperienceReceiptControls } from './ExperienceReceiptControls.js'
import { latestAssistantAnchor } from './message-anchor.js'

export interface PluginChoice {
  readonly moduleName: string
  readonly enabled: boolean
  readonly fiberPhase: 'pending' | 'loading' | 'active' | 'failed' | 'unloading' | null
}

export interface PluginLabInjected {
  hooks: { pluginLab: LabController }
  record: (verdict: ExperienceVerdict, category: FeedbackCategory) => Promise<void>
  revise: (revision: PluginLabRevision) => Promise<void>
  join: () => Promise<void>
  cancel: () => Promise<void>
  dismiss: () => void
  selectPlugin: (plugin: TrialPluginRef) => Promise<string>
  listPlugins: () => Promise<readonly PluginChoice[]>
  loadReceipts: (markRead: boolean) => Promise<ReceiptBoxSnapshot>
  discardReceipt: (eventId: string) => Promise<string>
}

export type PluginLabButtonProps = PropsRuntime<'conversation.input.dock'> & InjectFace<PluginLabInjected>

const ink = '#0f172a'
const muted = '#64748b'
const line = '#dbe3ea'
const paper = '#fffefb'
const accent = '#0f766e'

const toolbarButton: CSSProperties = {
  height: 26,
  padding: '0 8px',
  border: `1px solid ${line}`,
  borderRadius: 8,
  background: '#ffffff',
  color: '#475569',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 620,
  letterSpacing: '.01em',
}

const sheetStyle: CSSProperties = {
  width: 'min(352px, calc(100vw - 28px))',
  boxSizing: 'border-box',
  padding: 10,
  border: `1px solid ${line}`,
  borderRadius: 14,
  background: paper,
  color: ink,
  boxShadow: '0 10px 28px rgba(15, 23, 42, .12)',
  fontSize: 12,
}

const STATUS_LABEL: Record<string, string> = {
  received: '已收到',
  clustered: '正在聚合',
  reported: '公开跟进',
  confirmed: '维护者已确认',
  'fix-released': '修复可用',
  'retest-requested': '等待复测',
  verified: '已验证',
  closed: '已解决',
}

function itemLabel(item: ReceiptProgressItem): string {
  if (item.localState === 'draft') return '待确认'
  if (item.localState === 'queued') return '等待发送'
  return item.status === undefined ? '已提交' : STATUS_LABEL[item.status] ?? item.status
}

function progressIndex(item: ReceiptProgressItem): number {
  if (item.localState !== 'submitted') return 0
  if (item.status === 'clustered') return 1
  if (item.status === 'reported' || item.status === 'confirmed') return 2
  if (item.status === 'fix-released' || item.status === 'retest-requested') return 3
  if (item.status === 'verified' || item.status === 'closed') return 4
  return 0
}

function pluginState(choice: PluginChoice): string {
  if (!choice.enabled) return '已停用'
  if (choice.fiberPhase === 'failed') return '运行失败'
  if (choice.fiberPhase === 'active') return '运行中'
  if (choice.fiberPhase === 'loading') return '启动中'
  return '已安装'
}

function safeTrackingUrl(value: string | undefined): string | undefined {
  return value?.startsWith('https://') ? value : undefined
}

/** One persistent receipt entry for selection, feedback and progress. */
export function PluginLabButton({
  useSession, usePluginLab, record, revise, join, cancel, dismiss,
  selectPlugin, listPlugins, loadReceipts, discardReceipt,
}: PluginLabButtonProps) {
  const view = usePluginLab(value => value)
  const latest = useSession(snapshot => latestAssistantAnchor(snapshot.nodes))
  const [open, setOpen] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [expandedEventId, setExpandedEventId] = useState<string>()
  const [plugins, setPlugins] = useState<readonly PluginChoice[]>([])
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [box, setBox] = useState<ReceiptBoxSnapshot>({ items: [], unreadCount: 0 })
  const hasReplyAfterActivation = view.activatedAt !== undefined
    && latest !== undefined
    && latest.time >= view.activatedAt
  const failed = view.health === 'error' || view.health === 'unavailable'
  const showFallback = !hasReplyAfterActivation
    && ((view.active && (failed || view.manualSelection === true)) || view.pending !== undefined)

  useEffect(() => {
    void loadReceipts(false).then(setBox)
  }, [loadReceipts])

  useEffect(() => {
    if (view.receiptBox !== undefined) setBox(view.receiptBox)
  }, [view.receiptBox])

  const visiblePlugins = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    const candidates = normalized.length > 0
      ? plugins.filter(plugin => plugin.moduleName.toLocaleLowerCase().includes(normalized))
      : plugins.filter(plugin => plugin.fiberPhase === 'failed'
        || (plugin.fiberPhase === 'active' && !plugin.moduleName.startsWith('@deepseek-ai/dsh-')))
    return candidates.slice(0, normalized.length > 0 ? 12 : 6)
  }, [plugins, query])

  const beginSelection = (): void => {
    setSelecting(true)
    setBusy(true)
    void listPlugins().then(setPlugins).finally(() => { setBusy(false) })
  }

  const toggleReceipt = (): void => {
    if (open) {
      setOpen(false)
      setSelecting(false)
      setShowAll(false)
      setExpandedEventId(undefined)
      setQuery('')
      return
    }
    setOpen(true)
    setBusy(true)
    void loadReceipts(true).then(value => {
      setBox({ ...value, unreadCount: 0 })
    }).finally(() => { setBusy(false) })
  }

  const entryLabel = [
    '体验回执',
    box.items.length > 0 ? String(box.items.length) : undefined,
    box.unreadCount > 0 ? `${box.unreadCount} 新` : undefined,
    showFallback && view.pending === undefined ? '待反馈' : undefined,
  ].filter((value): value is string => value !== undefined).join(' · ')
  const visibleReceipts = showAll ? box.items : box.items.slice(0, 3)

  return (
    <span style={{ display: 'grid', width: '100%', justifyItems: 'end', gap: 6, padding: '2px 0' }}>
      <button type="button" style={toolbarButton} aria-expanded={open} onClick={toggleReceipt}>
        {entryLabel}
      </button>

      {open && (
        <span role="region" aria-label="体验回执" style={sheetStyle}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7 }}>
              <strong style={{ fontSize: 13 }}>体验回执</strong>
              <small style={{ color: muted }}>{box.items.length} 条 · 本机</small>
            </span>
            <button
              type="button"
              aria-label="关闭体验回执"
              style={{ ...toolbarButton, width: 24, padding: 0, border: 0, background: 'transparent', fontSize: 15 }}
              onClick={toggleReceipt}
            >×</button>
          </span>

          {showFallback && (
            <span style={{ display: 'block', marginTop: 10 }}>
              <ExperienceReceiptControls
                view={view}
                record={record}
                revise={revise}
                join={join}
                cancel={cancel}
                dismiss={dismiss}
                surface="fallback"
              />
            </span>
          )}

          {!showFallback && hasReplyAfterActivation && view.active && (
            <small style={{ display: 'block', marginTop: 9, color: muted }}>
              当前插件的 👍 👎 已放在对应的 Agent 回复下方。
            </small>
          )}

          {!selecting && view.pending === undefined && (
            <button
              type="button"
              style={{
                display: 'flex', width: '100%', minHeight: 34, alignItems: 'center', justifyContent: 'space-between',
                marginTop: 8, padding: '0 9px', border: `1px solid ${line}`, borderRadius: 8,
                background: '#fff', color: ink, cursor: 'pointer', textAlign: 'left', fontSize: 12,
              }}
              onClick={beginSelection}
            >
              <span>{view.plugin === undefined ? '＋ 选择插件' : '＋ 更换插件'}</span>
              <small style={{ color: muted }}>仅名称与状态</small>
            </button>
          )}

          {selecting && (
            <span style={{ display: 'grid', gap: 7, marginTop: 8, padding: 8, border: `1px solid ${line}`, borderRadius: 9, background: '#fff' }}>
              <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                <strong style={{ fontSize: 12 }}>反馈哪个插件？</strong>
                <button
                  type="button"
                  style={{ ...toolbarButton, height: 22, border: 0, background: 'transparent' }}
                  onClick={() => { setSelecting(false); setQuery('') }}
                >收起</button>
              </span>
              <input
                aria-label="搜索已安装插件"
                value={query}
                onChange={event => { setQuery(event.currentTarget.value) }}
                placeholder="搜索公开插件名"
                style={{
                  width: '100%', height: 32, boxSizing: 'border-box', padding: '0 9px',
                  border: `1px solid ${line}`, borderRadius: 8, background: '#fff', color: ink, outlineColor: accent,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12,
                }}
              />
              <span style={{ display: 'grid', gap: 2, maxHeight: 164, overflowY: 'auto' }}>
                {busy && <small style={{ padding: 8, color: muted }}>正在读取插件清单…</small>}
                {!busy && visiblePlugins.length === 0 && (
                  <small style={{ padding: 8, color: muted }}>
                    {query.length === 0 ? '输入插件名进行搜索。' : '没有匹配的已安装插件。'}
                  </small>
                )}
                {visiblePlugins.map(plugin => (
                  <button
                    key={plugin.moduleName}
                    type="button"
                    style={{
                      display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center',
                      minHeight: 38, padding: '6px 8px', border: 0, borderRadius: 8,
                      background: plugin.fiberPhase === 'failed' ? '#fff1f2' : 'transparent', color: ink,
                      textAlign: 'left', cursor: 'pointer',
                    }}
                    onClick={() => {
                      setBusy(true)
                      void selectPlugin({ moduleName: plugin.moduleName }).then(() => {
                        setSelecting(false)
                        setQuery('')
                      }).finally(() => { setBusy(false) })
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11 }}>
                      {plugin.moduleName}
                    </span>
                    <small style={{ color: plugin.fiberPhase === 'failed' ? '#be123c' : muted }}>{pluginState(plugin)}</small>
                  </button>
                ))}
              </span>
            </span>
          )}

          {!selecting && <span
            style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10,
              marginTop: 10, paddingTop: 8, borderTop: `1px solid ${line}`,
            }}
          >
            <strong style={{ fontSize: 11, letterSpacing: '.04em', color: '#475569' }}>最近进度</strong>
            {box.items.length > 3 && (
              <button
                type="button"
                style={{ ...toolbarButton, height: 22, padding: '0 4px', border: 0, background: 'transparent', color: accent }}
                onClick={() => { setShowAll(value => !value); setExpandedEventId(undefined) }}
              >{showAll ? '收起' : `查看全部 ${box.items.length}`}</button>
            )}
          </span>}
          {!selecting && <span style={{ display: 'grid', maxHeight: showAll ? 280 : 190, overflowY: 'auto', marginTop: 3 }}>
            {busy && !selecting && <small style={{ padding: 8, color: muted }}>正在更新回执…</small>}
            {!busy && box.items.length === 0 && <small style={{ padding: 8, color: muted }}>还没有体验回执。</small>}
            {!busy && visibleReceipts.map(item => {
              const current = progressIndex(item)
              const trackingUrl = safeTrackingUrl(item.trackingUrl)
              const expanded = expandedEventId === item.eventId
              return (
                <span
                  key={item.eventId}
                  style={{
                    display: 'grid', gap: 5, padding: '7px 4px 8px', borderBottom: `1px solid ${line}`,
                    background: expanded ? '#f8fafc' : 'transparent', borderRadius: expanded ? 8 : 0,
                  }}
                >
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-label={`${expanded ? '收起' : '查看'} ${item.plugin.moduleName} 回执详情`}
                    style={{
                      display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 8,
                      padding: 0, border: 0, background: 'transparent', color: ink, cursor: 'pointer', textAlign: 'left',
                    }}
                    onClick={() => { setExpandedEventId(expanded ? undefined : item.eventId) }}
                  >
                    <strong style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 10.5 }}>
                      {item.plugin.moduleName}{item.plugin.version === undefined ? '' : `#${item.plugin.version}`}
                    </strong>
                    <small style={{ color: item.unread ? accent : muted, fontWeight: item.unread ? 700 : 500 }}>{itemLabel(item)}</small>
                  </button>
                  <span aria-label={`进度 ${current + 1}/5`} style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 3 }}>
                    {[0, 1, 2, 3, 4].map(index => (
                      <span key={index} style={{ height: 2, borderRadius: 99, background: index <= current ? accent : '#e2e8f0' }} />
                    ))}
                  </span>
                  {expanded && <>
                    <span style={{ color: '#334155', lineHeight: 1.45 }}>{item.summary}</span>
                    <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 9, color: muted }}>
                      {item.similarReports !== undefined && <small>同类 {item.similarReports} 条</small>}
                      {item.recommendedVersion !== undefined && <small>建议版本 {item.recommendedVersion}</small>}
                      {trackingUrl !== undefined && <a href={trackingUrl} target="_blank" rel="noreferrer" style={{ color: accent }}>公开进展</a>}
                      {item.localState === 'draft' && (
                        <button
                          type="button"
                          style={{ ...toolbarButton, height: 22, marginLeft: 'auto', border: 0, background: 'transparent' }}
                          onClick={() => {
                            setBusy(true)
                            void discardReceipt(item.eventId).then(() => loadReceipts(false)).then(setBox)
                              .finally(() => { setBusy(false) })
                          }}
                        >移除草稿</button>
                      )}
                    </span>
                  </>}
                </span>
              )
            })}
          </span>}
        </span>
      )}
    </span>
  )
}
