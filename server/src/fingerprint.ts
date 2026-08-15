import { createHash, createHmac } from 'node:crypto'
import type { AcceptedEvent } from './types.js'

export function symptomFor(event: AcceptedEvent): string {
  if (event.loaderHealth === 'failed' || event.loaderHealth === 'missing') return `loader-${event.loaderHealth}`
  if (event.agentErrors > 0) return 'agent-error'
  if (event.toolErrors > 0) return 'tool-error'
  return `outcome-${event.outcome}`
}

export function clusterKey(event: AcceptedEvent): string {
  const parts = [
    event.pluginModule,
    event.pluginVersion ?? '*',
    event.dshVersion,
    event.taskId ?? '*',
    symptomFor(event),
  ]
  return createHash('sha256').update(parts.join('\u001f')).digest('hex')
}

export function hashParticipant(secret: string, participantId: string): string {
  return createHmac('sha256', secret).update(participantId).digest('hex')
}

export function followToken(secret: string, eventId: string): string {
  return createHmac('sha256', secret).update(`receipt:${eventId}`).digest('base64url')
}
