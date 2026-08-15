import { createHash, createHmac } from 'node:crypto'
import type { AcceptedEvent } from './types.js'

export function symptomFor(event: AcceptedEvent): string {
  if (event.health !== 'ok') return `${event.category}-health-${event.health}`
  return `${event.category}-experience-${event.experience}`
}

export function clusterKey(event: AcceptedEvent): string {
  return createHash('sha256').update([
    event.pluginModule,
    event.pluginVersion ?? '*',
    event.health,
    event.experience,
    event.category,
  ].join('\u001f')).digest('hex')
}

export function followToken(secret: string, eventId: string): string {
  return createHmac('sha256', secret).update(`receipt:${eventId}`).digest('base64url')
}
