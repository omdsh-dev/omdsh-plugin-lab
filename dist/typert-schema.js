import { z } from 'zod';
const agentId = z.intersection(z.string(), z.unknown());
const verdict = z.union([z.literal('good'), z.literal('mixed'), z.literal('bad')]);
const category = z.union([
    z.literal('installation'),
    z.literal('startup'),
    z.literal('invocation'),
    z.literal('compatibility'),
    z.literal('reliability'),
    z.literal('performance'),
    z.literal('result_quality'),
    z.literal('general'),
]);
const health = z.union([
    z.literal('ok'),
    z.literal('unavailable'),
    z.literal('error'),
    z.literal('unknown'),
]);
const pluginRef = z.object({
    moduleName: z.string(),
    version: z.string().optional(),
});
const panelDraft = z.object({
    eventId: z.string().readonly(),
    verdict: verdict.readonly(),
    category: category.readonly(),
    text: z.string().readonly(),
});
const probeResult = z.object({
    active: z.boolean().readonly(),
    plugin: pluginRef.readonly().optional(),
    health: health.readonly(),
    suggestedCategory: category.readonly(),
    draft: panelDraft.readonly().optional(),
    text: z.string().readonly(),
});
const actionResult = z.object({
    ok: z.boolean().readonly(),
    text: z.string().readonly(),
    eventId: z.string().readonly().optional(),
});
const textResult = z.string();
const receiptStatus = z.union([
    z.literal('received'), z.literal('clustered'), z.literal('reported'), z.literal('fix-released'),
    z.literal('retest-requested'), z.literal('verified'), z.literal('confirmed'), z.literal('closed'),
]);
const receiptBoxResult = z.object({
    items: z.array(z.object({
        eventId: z.string().readonly(),
        plugin: pluginRef.readonly(),
        summary: z.string().readonly(),
        localState: z.union([z.literal('draft'), z.literal('queued'), z.literal('submitted')]).readonly(),
        status: receiptStatus.readonly().optional(),
        similarReports: z.number().int().nonnegative().readonly().optional(),
        recommendedVersion: z.string().readonly().optional(),
        trackingUrl: z.string().readonly().optional(),
        unread: z.boolean().readonly(),
    }).readonly()).readonly(),
    unreadCount: z.number().int().nonnegative().readonly(),
});
export const PLUGIN_LAB_REMOTE_DESCRIPTORS = [
    {
        id: '@oh-my-dsh/plugin-lab#pluginLab/probe',
        service: 'pluginLab', namespace: 'pluginLab', method: 'probe', invocation: { kind: 'direct' },
        scope: { context: 'agent', wire: 'agentId' },
        parameters: [{
                name: 'agent', wire: 'agentId', source: 'lookup', lookup: 'agent',
                codec: { mode: 'strict', typeSymbol: '@deepseek-ai/dsh-session/types#SessionId', schema: agentId },
            }],
        result: { mode: 'strict', typeSymbol: '@oh-my-dsh/plugin-lab#PluginLabPanelProbe', schema: probeResult },
        sourceLocation: { file: 'src/panel-service.ts', line: 24, column: 3 },
    },
    {
        id: '@oh-my-dsh/plugin-lab#pluginLab/select',
        service: 'pluginLab', namespace: 'pluginLab', method: 'select', invocation: { kind: 'direct' },
        scope: { context: 'agent', wire: 'agentId' },
        parameters: [
            {
                name: 'agent', wire: 'agentId', source: 'lookup', lookup: 'agent',
                codec: { mode: 'strict', typeSymbol: '@deepseek-ai/dsh-session/types#SessionId', schema: agentId },
            },
            {
                name: 'plugin', wire: 'plugin', source: 'json',
                codec: { mode: 'strict', typeSymbol: '@oh-my-dsh/plugin-lab#TrialPluginRef', schema: pluginRef },
            },
        ],
        result: { mode: 'strict', typeSymbol: '@oh-my-dsh/plugin-lab#PluginLabPanelAction', schema: actionResult },
        sourceLocation: { file: 'src/panel-service.ts', line: 33, column: 3 },
    },
    {
        id: '@oh-my-dsh/plugin-lab#pluginLab/record',
        service: 'pluginLab', namespace: 'pluginLab', method: 'record', invocation: { kind: 'direct' },
        scope: { context: 'agent', wire: 'agentId' },
        parameters: [
            {
                name: 'agent', wire: 'agentId', source: 'lookup', lookup: 'agent',
                codec: { mode: 'strict', typeSymbol: '@deepseek-ai/dsh-session/types#SessionId', schema: agentId },
            },
            {
                name: 'verdict', wire: 'verdict', source: 'json',
                codec: { mode: 'strict', typeSymbol: '@oh-my-dsh/plugin-lab#ExperienceVerdict', schema: verdict },
            },
            {
                name: 'category', wire: 'category', source: 'json',
                codec: { mode: 'strict', typeSymbol: '@oh-my-dsh/plugin-lab#FeedbackCategory', schema: category },
            },
        ],
        result: { mode: 'strict', typeSymbol: '@oh-my-dsh/plugin-lab#PluginLabPanelAction', schema: actionResult },
        sourceLocation: { file: 'src/panel-service.ts', line: 29, column: 3 },
    },
    {
        id: '@oh-my-dsh/plugin-lab#pluginLab/join',
        service: 'pluginLab', namespace: 'pluginLab', method: 'join', invocation: { kind: 'direct' },
        scope: { context: 'agent', wire: 'agentId' },
        parameters: [{
                name: 'agent', wire: 'agentId', source: 'lookup', lookup: 'agent',
                codec: { mode: 'strict', typeSymbol: '@deepseek-ai/dsh-session/types#SessionId', schema: agentId },
            }],
        result: { mode: 'strict', typeSymbol: '@oh-my-dsh/plugin-lab#PluginLabPanelAction', schema: actionResult },
        sourceLocation: { file: 'src/panel-service.ts', line: 38, column: 3 },
    },
    {
        id: '@oh-my-dsh/plugin-lab#pluginLab/cancel',
        service: 'pluginLab', namespace: 'pluginLab', method: 'cancel', invocation: { kind: 'direct' },
        scope: { context: 'agent', wire: 'agentId' },
        parameters: [{
                name: 'agent', wire: 'agentId', source: 'lookup', lookup: 'agent',
                codec: { mode: 'strict', typeSymbol: '@deepseek-ai/dsh-session/types#SessionId', schema: agentId },
            }],
        result: { mode: 'strict', typeSymbol: '@oh-my-dsh/plugin-lab#PluginLabPanelAction', schema: actionResult },
        sourceLocation: { file: 'src/panel-service.ts', line: 47, column: 3 },
    },
    {
        id: '@oh-my-dsh/plugin-lab#pluginLab/discard',
        service: 'pluginLab', namespace: 'pluginLab', method: 'discard', invocation: { kind: 'direct' },
        scope: { context: 'agent', wire: 'agentId' },
        parameters: [
            {
                name: 'agent', wire: 'agentId', source: 'lookup', lookup: 'agent',
                codec: { mode: 'strict', typeSymbol: '@deepseek-ai/dsh-session/types#SessionId', schema: agentId },
            },
            {
                name: 'eventId', wire: 'eventId', source: 'json',
                codec: { mode: 'strict', typeSymbol: 'string', schema: z.string() },
            },
        ],
        result: { mode: 'strict', typeSymbol: '@oh-my-dsh/plugin-lab#PluginLabPanelAction', schema: actionResult },
        sourceLocation: { file: 'src/panel-service.ts', line: 51, column: 3 },
    },
    {
        id: '@oh-my-dsh/plugin-lab#pluginLab/receipts',
        service: 'pluginLab', namespace: 'pluginLab', method: 'receipts', invocation: { kind: 'direct' },
        scope: { context: 'agent', wire: 'agentId' },
        parameters: [
            {
                name: 'agent', wire: 'agentId', source: 'lookup', lookup: 'agent',
                codec: { mode: 'strict', typeSymbol: '@deepseek-ai/dsh-session/types#SessionId', schema: agentId },
            },
            {
                name: 'markRead', wire: 'markRead', source: 'json',
                codec: { mode: 'strict', typeSymbol: 'boolean', schema: z.boolean() },
            },
        ],
        result: { mode: 'strict', typeSymbol: '@oh-my-dsh/plugin-lab#ReceiptBoxSnapshot', schema: receiptBoxResult },
        sourceLocation: { file: 'src/panel-service.ts', line: 55, column: 3 },
    },
    {
        id: '@oh-my-dsh/plugin-lab#pluginLab/inbox',
        service: 'pluginLab', namespace: 'pluginLab', method: 'inbox', invocation: { kind: 'direct' },
        scope: { context: 'agent', wire: 'agentId' },
        parameters: [{
                name: 'agent', wire: 'agentId', source: 'lookup', lookup: 'agent',
                codec: { mode: 'strict', typeSymbol: '@deepseek-ai/dsh-session/types#SessionId', schema: agentId },
            }],
        result: { mode: 'strict', typeSymbol: '@oh-my-dsh/plugin-lab#pluginLab/inbox:result', schema: textResult },
        sourceLocation: { file: 'src/panel-service.ts', line: 43, column: 3 },
    },
];
//# sourceMappingURL=typert-schema.js.map