import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-commands/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import TYPERT_REMOTE from '../typert.remote-client.js'
import { LabController, type PluginLabRemote } from './controller.js'
import { PluginLabButton, type PluginLabInjected } from './PluginLabButton.js'
import { ExperienceResultCard, type LabInjected } from './ExperienceResultCard.js'
import { PluginLabHistoryRow } from './PluginLabHistoryRow.js'

export { ExperienceResultCard } from './ExperienceResultCard.js'
export { InboxButton } from './InboxButton.js'
export { PluginLabButton } from './PluginLabButton.js'
export { PluginLabHistoryRow } from './PluginLabHistoryRow.js'
export { ProbeButton } from './ProbeButton.js'
export { LabController } from './controller.js'

export const inject = ['slots', 'remote']

export function apply(ctx: ClientContext): void {
  ctx.remote.$mount(TYPERT_REMOTE)
  const controllers = new Map<SessionId, LabController>()
  ctx.effect(() => () => { controllers.clear() }, 'plugin-lab: client controller lifecycle')
  const controllerFor = (sessionId: SessionId): LabController => {
    let controller = controllers.get(sessionId)
    if (controller === undefined) {
      controller = new LabController(ctx.get('remote.pluginLab') as PluginLabRemote, sessionId)
      controllers.set(sessionId, controller)
    }
    return controller
  }

  ctx.on('command/executed', (sessionId, name, result) => {
    if (result.kind !== 'success') return
    if (name === 'omdsh-start' || name === 'omdsh-retest') {
      const controller = controllerFor(sessionId)
      controller.setTrialActive(true)
      void controller.probe()
    }
    if (name === 'omdsh-result' || name === 'omdsh-feedback') controllerFor(sessionId).setTrialActive(false)
  })

  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock',
    id: 'omdsh-plugin-lab',
    order: 15,
    inject: (sessionId): PluginLabInjected => {
      const controller = controllerFor(sessionId)
      return {
        hooks: { pluginLab: controller },
        record: (outcome, category) => controller.record(outcome, category),
        join: () => controller.join(),
        dismiss: () => controller.dismiss(),
      }
    },
  }, PluginLabButton))

  ctx.slots.inject('conversation.chat.assistant-actions', () => ctx.slots.register({
    name: 'conversation.chat.assistant-actions',
    id: 'omdsh-experience-receipt',
    order: 40,
    inject: (sessionId): LabInjected => {
      const controller = controllerFor(sessionId)
      return {
        hooks: { pluginLab: controller },
        record: (outcome, category) => controller.record(outcome, category),
        join: () => controller.join(),
        dismiss: () => controller.dismiss(),
      }
    },
  }, ExperienceResultCard))

  ctx.slots.inject('conversation.chat.commandview', () => ctx.slots.register({
    name: 'conversation.chat.commandview',
    key: 'omdsh-history',
  }, PluginLabHistoryRow))
}
