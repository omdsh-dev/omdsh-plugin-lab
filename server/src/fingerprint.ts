import { createHash, createHmac } from 'node:crypto'
import type { AcceptedEvent } from './types.js'

export function symptomFor(event: AcceptedEvent): string {
  if (event.health !== 'ok') return `health-${event.health}`
  return `experience-${event.experience}`
}

export function clusterKey(event: AcceptedEvent): string {
  return createHash('sha256').update([
    event.pluginModule,
    event.pluginVersion ?? '*',
    event.health,
    event.experience,
  ].join('\u001f')).digest('hex')
}

export function followToken(secret: string, eventId: string): string {
  return createHmac('sha256', secret).update(`receipt:${eventId}`).digest('base64url')
}
