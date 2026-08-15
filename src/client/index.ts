import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-commands/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { LabController, type CommandsRemote } from './controller.js'
import { ExperienceResultCard, type LabInjected } from './ExperienceResultCard.js'
import { InboxButton, type InboxInjected } from './InboxButton.js'
import { ProbeButton, type ProbeInjected } from './ProbeButton.js'

export { ExperienceResultCard } from './ExperienceResultCard.js'
export { InboxButton } from './InboxButton.js'
export { ProbeButton } from './ProbeButton.js'
export { LabController } from './controller.js'

export const inject = ['slots', 'remote', 'remote.commands']

export function apply(ctx: ClientContext): void {
  const controllers = new Map<SessionId, LabController>()
  ctx.effect(() => () => { controllers.clear() }, 'plugin-lab: client controller lifecycle')
  const controllerFor = (sessionId: SessionId): LabController => {
    let controller = controllers.get(sessionId)
    if (controller === undefined) {
      controller = new LabController(ctx.remote.commands as CommandsRemote, sessionId)
      controllers.set(sessionId, controller)
    }
    return controller
  }

  ctx.on('command/executed', (sessionId, name, result) => {
    if (result.kind !== 'success') return
    if (name === 'omdsh-start' || name === 'omdsh-retest') controllerFor(sessionId).setTrialActive(true)
    if (name === 'omdsh-result' || name === 'omdsh-feedback') controllerFor(sessionId).setTrialActive(false)
  })

  ctx.slots.inject('conversation.chat.assistant-actions', () => ctx.slots.register({
    name: 'conversation.chat.assistant-actions',
    id: 'omdsh-plugin-lab',
    order: 20,
    inject: (sessionId): LabInjected => {
      const controller = controllerFor(sessionId)
      return {
        hooks: { pluginLab: controller },
        record: (messageId, outcome) => controller.record(messageId, outcome),
        join: () => controller.join(),
        dismiss: () => controller.dismiss(),
      }
    },
  }, ExperienceResultCard))

  ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
    name: 'conversation.input.left',
    id: 'omdsh-plugin-lab-inbox',
    order: 40,
    inject: (sessionId): InboxInjected => ({
      checkInbox: () => controllerFor(sessionId).inbox(),
    }),
  }, InboxButton))

  ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
    name: 'conversation.input.left',
    id: 'omdsh-plugin-lab-probe',
    order: 39,
    inject: (sessionId): ProbeInjected => ({
      checkHealth: () => controllerFor(sessionId).probe(),
    }),
  }, ProbeButton))
}
