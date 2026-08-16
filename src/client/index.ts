import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { ClientRemote, PluginInventorySnapshot } from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-commands/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import TYPERT_REMOTE from '../typert.remote-client.js'
import { LabController, type PluginLabRemote } from './controller.js'
import { PluginLabButton, type PluginChoice, type PluginLabInjected } from './PluginLabButton.js'
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
  const listPlugins = async (): Promise<readonly PluginChoice[]> => {
    const remote = ctx.get('remote.pluginInventory') as Pick<ClientRemote['pluginInventory'], 'list'>
    const result = await remote.list()
    if (!result.ok) return []
    const snapshot: PluginInventorySnapshot = result.value
    return snapshot.entries
      .filter(entry => entry.moduleName !== '@oh-my-dsh/plugin-lab')
      .map(entry => ({
        moduleName: entry.moduleName,
        enabled: entry.enabled,
        fiberPhase: entry.fiberPhase,
      }))
      .sort((left, right) => {
        const priority = (value: PluginChoice): number => value.fiberPhase === 'failed' ? 0 : value.fiberPhase === 'active' ? 1 : 2
        return priority(left) - priority(right) || left.moduleName.localeCompare(right.moduleName)
      })
  }

  ctx.on('command/executed', (sessionId, name, result) => {
    if (result.kind !== 'success') return
    if (name === 'omdsh-start' || name === 'omdsh-retest') {
      const controller = controllerFor(sessionId)
      controller.setTrialActive(true)
      void controller.probe()
    }
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
        revise: summary => controller.revise(summary),
        join: () => controller.join(),
        cancel: async () => { await controller.cancel() },
        dismiss: () => controller.dismiss(),
        selectPlugin: plugin => controller.selectPlugin(plugin),
        listPlugins,
        loadReceipts: markRead => controller.receipts(markRead),
        discardReceipt: eventId => controller.discard(eventId),
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
        revise: summary => controller.revise(summary),
        join: () => controller.join(),
        cancel: async () => { await controller.cancel() },
        refresh: () => controller.probe(),
        dismiss: () => controller.dismiss(),
      }
    },
  }, ExperienceResultCard))

  ctx.slots.inject('conversation.chat.commandview', () => ctx.slots.register({
    name: 'conversation.chat.commandview',
    key: 'omdsh-history',
  }, PluginLabHistoryRow))
}
