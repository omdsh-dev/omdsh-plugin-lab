import { z } from 'zod'

const agentId = z.intersection(z.string(), z.unknown())
const verdict = z.union([z.literal('good'), z.literal('mixed'), z.literal('bad')])
const category = z.union([
  z.literal('installation'),
  z.literal('startup'),
  z.literal('invocation'),
  z.literal('compatibility'),
  z.literal('reliability'),
  z.literal('performance'),
  z.literal('result_quality'),
  z.literal('general'),
])
const health = z.union([
  z.literal('ok'),
  z.literal('unavailable'),
  z.literal('error'),
  z.literal('unknown'),
])
const probeResult = z.object({
  active: z.boolean().readonly(),
  plugin: z.object({
    moduleName: z.string(),
    version: z.string().optional(),
  }).readonly().optional(),
  health: health.readonly(),
  suggestedCategory: category.readonly(),
  text: z.string().readonly(),
})
const actionResult = z.object({ ok: z.boolean().readonly(), text: z.string().readonly() })
const textResult = z.string()

export const PLUGIN_LAB_REMOTE_DESCRIPTORS = [
  {
    id: '@oh-my-dsh/plugin-lab#pluginLab/probe',
    service: 'pluginLab', namespace: 'pluginLab', method: 'probe', invocation: { kind: 'direct' as const },
    scope: { context: 'agent', wire: 'agentId' },
    parameters: [{
      name: 'agent', wire: 'agentId', source: 'lookup' as const, lookup: 'agent',
      codec: { mode: 'strict' as const, typeSymbol: '@deepseek-ai/dsh-session/types#SessionId', schema: agentId },
    }],
    result: { mode: 'strict' as const, typeSymbol: '@oh-my-dsh/plugin-lab#PluginLabPanelProbe', schema: probeResult },
    sourceLocation: { file: 'src/panel-service.ts', line: 24, column: 3 },
  },
  {
    id: '@oh-my-dsh/plugin-lab#pluginLab/record',
    service: 'pluginLab', namespace: 'pluginLab', method: 'record', invocation: { kind: 'direct' as const },
    scope: { context: 'agent', wire: 'agentId' },
    parameters: [
      {
        name: 'agent', wire: 'agentId', source: 'lookup' as const, lookup: 'agent',
        codec: { mode: 'strict' as const, typeSymbol: '@deepseek-ai/dsh-session/types#SessionId', schema: agentId },
      },
      {
        name: 'verdict', wire: 'verdict', source: 'json' as const,
        codec: { mode: 'strict' as const, typeSymbol: '@oh-my-dsh/plugin-lab#ExperienceVerdict', schema: verdict },
      },
      {
        name: 'category', wire: 'category', source: 'json' as const,
        codec: { mode: 'strict' as const, typeSymbol: '@oh-my-dsh/plugin-lab#FeedbackCategory', schema: category },
      },
    ],
    result: { mode: 'strict' as const, typeSymbol: '@oh-my-dsh/plugin-lab#PluginLabPanelAction', schema: actionResult },
    sourceLocation: { file: 'src/panel-service.ts', line: 29, column: 3 },
  },
  {
    id: '@oh-my-dsh/plugin-lab#pluginLab/join',
    service: 'pluginLab', namespace: 'pluginLab', method: 'join', invocation: { kind: 'direct' as const },
    scope: { context: 'agent', wire: 'agentId' },
    parameters: [{
      name: 'agent', wire: 'agentId', source: 'lookup' as const, lookup: 'agent',
      codec: { mode: 'strict' as const, typeSymbol: '@deepseek-ai/dsh-session/types#SessionId', schema: agentId },
    }],
    result: { mode: 'strict' as const, typeSymbol: '@oh-my-dsh/plugin-lab#PluginLabPanelAction', schema: actionResult },
    sourceLocation: { file: 'src/panel-service.ts', line: 38, column: 3 },
  },
  {
    id: '@oh-my-dsh/plugin-lab#pluginLab/inbox',
    service: 'pluginLab', namespace: 'pluginLab', method: 'inbox', invocation: { kind: 'direct' as const },
    scope: { context: 'agent', wire: 'agentId' },
    parameters: [{
      name: 'agent', wire: 'agentId', source: 'lookup' as const, lookup: 'agent',
      codec: { mode: 'strict' as const, typeSymbol: '@deepseek-ai/dsh-session/types#SessionId', schema: agentId },
    }],
    result: { mode: 'strict' as const, typeSymbol: '@oh-my-dsh/plugin-lab#pluginLab/inbox:result', schema: textResult },
    sourceLocation: { file: 'src/panel-service.ts', line: 43, column: 3 },
  },
] as const
