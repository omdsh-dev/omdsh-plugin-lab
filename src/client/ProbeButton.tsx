import { useState, type CSSProperties } from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'

export interface ProbeInjected {
  checkHealth: () => Promise<string>
}

export type ProbeButtonProps = PropsRuntime<'conversation.input.left'> & InjectFace<ProbeInjected>

const button: CSSProperties = {
  height: 28, padding: '0 9px', border: 'none', borderRadius: 14, cursor: 'pointer',
  background: 'transparent', color: 'var(--dsw-alias-label-tertiary)', fontSize: 12,
}

export function ProbeButton({ checkHealth }: ProbeButtonProps) {
  const [text, setText] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        style={button}
        disabled={busy}
        onClick={() => {
          if (text !== null) return setText(null)
          setBusy(true)
          void checkHealth().then(setText).finally(() => { setBusy(false) })
        }}
      >
        {busy ? '探活中…' : '插件探活'}
      </button>
      {text !== null && (
        <span
          role="status"
          style={{
            position: 'absolute', zIndex: 30, left: 0, bottom: 34, width: 330, padding: 12,
            border: '1px solid var(--dsw-alias-border-secondary)', borderRadius: 10,
            background: 'var(--dsw-alias-bg-primary)', color: 'var(--dsw-alias-label-secondary)',
            boxShadow: '0 12px 36px rgba(0,0,0,.18)', whiteSpace: 'pre-wrap', fontSize: 13,
          }}
        >
          {text}
        </span>
      )}
    </span>
  )
}
