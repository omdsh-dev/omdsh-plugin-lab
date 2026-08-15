import type { CSSProperties } from 'react'
import type { CommandRowProps } from '@deepseek-ai/dsh-client-ui-conversation/client'

const cardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  alignItems: 'start',
  gap: 10,
  margin: '8px 0',
  padding: '9px 11px',
  border: '1px solid var(--dsw-alias-border-secondary)',
  borderRadius: 10,
  background: 'var(--dsw-alias-bg-secondary)',
  color: 'var(--dsw-alias-label-secondary)',
  fontSize: 12,
  lineHeight: 1.45,
}

/** One durable row per confirmed submission; intermediate panel actions stay silent. */
export function PluginLabHistoryRow({ node }: CommandRowProps) {
  return (
    <div style={cardStyle}>
      <strong style={{ color: 'var(--dsw-alias-label-primary)', whiteSpace: 'nowrap' }}>插件反馈</strong>
      <span>{node.outcome?.text ?? '正在记录…'}</span>
    </div>
  )
}
