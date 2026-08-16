/** Task-agnostic plugin health and user-confirmed feedback loop for DeepSeek Harness. */
import z from '@deepseek-ai/schemastery';
import { createAgentAssessmentTool, createAgentPrepareTool, createAgentPreviewTool, } from './agent-tool.js';
import { healthText, probeLoaderHealth } from './health.js';
import { JOIN_USAGE, parseJoinTarget, parseReceiptId, parseResultInput, parseStartInput, RESULT_USAGE, RETEST_USAGE, START_USAGE, } from './input.js';
import { FEEDBACK_SCHEMA_VERSION, FEEDBACK_CATEGORIES, } from './protocol.js';
import { PluginLabPanelService } from './panel-service.js';
import { FeedbackStore } from './storage.js';
import { fixedSummary, renderUploadPreview, suggestedCategory } from './summary.js';
import { ExperienceUploader } from './uploader.js';
export const name = 'omdsh-plugin-lab';
export const inject = ['commands'];
export const Config = z.object({
    dataDir: z.string(),
    ingestUrl: z.string(),
    allowShare: z.boolean(),
    allowAnonymousShare: z.boolean(),
    authorizationEnv: z.string().default('OMDSH_PLUGIN_LAB_TOKEN'),
    requestTimeoutMs: z.number().default(5_000),
    retryIntervalMs: z.number().default(30_000),
});
function sessionKey(invocation) {
    return String(invocation.agent.session.id);
}
function agentSessionKey(agent) {
    return agent === undefined ? undefined : String(agent.session.id);
}
function agentKey(agent) {
    return String(agent.session.id);
}
function health(ctx, plugin) {
    return probeLoaderHealth(ctx.get('loader'), plugin.moduleName);
}
function assessment(status, plugin) {
    return {
        ...plugin === undefined ? {} : { plugin },
        health: status,
        experience: 'unknown',
        feedbackCategories: FEEDBACK_CATEGORIES,
        suggestedCategory: suggestedCategory(status),
        analysisScope: 'plugin_identity_and_host_state_only',
        summaryIsTemplateOnly: true,
        userConfirmationRequired: true,
    };
}
function renderReceipt(receipt) {
    const details = [
        receipt.similarReports === undefined ? undefined : `同类 ${receipt.similarReports} 条`,
        receipt.status,
        receipt.caseId,
    ].filter((value) => value !== undefined);
    const lines = [`已提交${details.length === 0 ? '' : ` · ${details.join(' · ')}`}`];
    if (receipt.recommendedVersion !== undefined)
        lines.push(`建议版本：${receipt.recommendedVersion}`);
    if (receipt.trackingUrl !== undefined)
        lines.push(`跟踪：${receipt.trackingUrl}`);
    return lines;
}
function validateConfig(config) {
    const requestTimeoutMs = config.requestTimeoutMs ?? 5_000;
    const retryIntervalMs = config.retryIntervalMs ?? 30_000;
    if (!Number.isFinite(requestTimeoutMs) || requestTimeoutMs <= 0) {
        throw new TypeError('plugin-lab: requestTimeoutMs must be a positive finite number');
    }
    if (!Number.isFinite(retryIntervalMs) || retryIntervalMs < 1_000) {
        throw new TypeError('plugin-lab: retryIntervalMs must be at least 1000');
    }
    const authorizationEnv = config.authorizationEnv ?? 'OMDSH_PLUGIN_LAB_TOKEN';
    if (!/^[A-Z_][A-Z0-9_]*$/u.test(authorizationEnv)) {
        throw new TypeError('plugin-lab: authorizationEnv must be an uppercase environment variable name');
    }
    if (config.ingestUrl !== undefined && config.ingestUrl.length > 0) {
        const parsed = new URL(config.ingestUrl);
        if (parsed.protocol !== 'https:' && parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') {
            throw new TypeError('plugin-lab: ingestUrl must use HTTPS (HTTP is allowed only for localhost testing)');
        }
    }
    return {
        ...config.dataDir === undefined ? {} : { dataDir: config.dataDir },
        ...config.ingestUrl === undefined || config.ingestUrl.length === 0 ? {} : { ingestUrl: config.ingestUrl },
        allowShare: config.allowShare ?? config.allowAnonymousShare ?? false,
        authorizationEnv,
        requestTimeoutMs,
        retryIntervalMs,
    };
}
export function apply(ctx, rawConfig) {
    const config = validateConfig(rawConfig);
    const store = new FeedbackStore(config.dataDir);
    const uploader = config.allowShare && config.ingestUrl !== undefined
        ? new ExperienceUploader(store, {
            ingestUrl: config.ingestUrl,
            authorizationEnv: config.authorizationEnv,
            requestTimeoutMs: config.requestTimeoutMs,
        })
        : undefined;
    const trials = new Map();
    /** Session-local pointers only; Session ids are never written to disk or sent. */
    const draftsBySession = new Map();
    const assessTrial = (key) => {
        const state = key === undefined ? undefined : trials.get(key);
        return assessment(state === undefined ? 'unknown' : health(ctx, state.plugin), state?.plugin);
    };
    const previewTrial = (key, experience, category) => {
        const state = key === undefined ? undefined : trials.get(key);
        if (state === undefined)
            throw new TypeError('no active Plugin Lab trial');
        const status = health(ctx, state.plugin);
        return {
            plugin: state.plugin,
            health: status,
            experience,
            category,
            summary: fixedSummary(state.plugin, status, experience, category),
            willUpload: false,
            userConfirmationRequired: true,
        };
    };
    const panelProbe = (agent) => {
        const key = agentKey(agent);
        const state = trials.get(key);
        const result = assessment(state === undefined ? 'unknown' : health(ctx, state.plugin), state?.plugin);
        const draftId = draftsBySession.get(key);
        const draft = draftId === undefined ? undefined : store.record(draftId);
        return {
            active: state !== undefined,
            ...(result.plugin === undefined ? {} : { plugin: result.plugin }),
            health: result.health,
            suggestedCategory: result.suggestedCategory,
            ...(draft === undefined ? {} : {
                draft: {
                    eventId: draft.event.eventId,
                    verdict: draft.event.experience,
                    category: draft.event.category,
                    text: renderUploadPreview(draft.event).join('\n'),
                },
            }),
            text: state === undefined
                ? '未选择试用插件'
                : `${state.plugin.moduleName} · ${healthText(result.health)}`,
        };
    };
    const recordFeedback = (agent, verdict, category) => {
        const key = agentKey(agent);
        const state = trials.get(key);
        if (state === undefined)
            return { ok: false, text: '没有进行中的插件试用。' };
        const previousDraftId = draftsBySession.get(key);
        if (previousDraftId !== undefined)
            store.discardDraft(previousDraftId);
        const event = {
            schemaVersion: FEEDBACK_SCHEMA_VERSION,
            type: 'feedback.signal',
            eventId: crypto.randomUUID(),
            plugin: state.plugin,
            health: health(ctx, state.plugin),
            experience: verdict,
            category,
            source: 'user_confirmed',
            ...state.retestOfReceiptId === undefined ? {} : { retestOfReceiptId: state.retestOfReceiptId },
        };
        store.append({ event, requestedShare: false });
        draftsBySession.set(key, event.eventId);
        return { ok: true, text: renderUploadPreview(event).join('\n'), eventId: event.eventId };
    };
    const prepareFeedback = (agent, verdict) => {
        if (agent === undefined)
            throw new TypeError('no active Plugin Lab agent');
        const state = trials.get(agentKey(agent));
        if (state === undefined)
            throw new TypeError('no active Plugin Lab trial');
        const status = health(ctx, state.plugin);
        const category = suggestedCategory(status);
        const result = recordFeedback(agent, verdict, category);
        if (!result.ok)
            throw new TypeError(result.text);
        return {
            plugin: state.plugin,
            health: status,
            experience: verdict,
            category,
            summary: fixedSummary(state.plugin, status, verdict, category),
            willUpload: false,
            userConfirmationRequired: true,
        };
    };
    const joinFeedback = async (eventId) => {
        if (uploader === undefined) {
            return { ok: false, text: '结构化分享未启用；当前不会产生反馈网络请求。' };
        }
        if (eventId === undefined || store.record(eventId) === undefined) {
            return { ok: false, text: '找不到这条本地体验记录。请先确认一次结果。' };
        }
        const existing = store.latestReceipts().find(receipt => receipt.eventId === eventId);
        if (existing !== undefined)
            return { ok: true, text: renderReceipt(existing).join('\n'), eventId };
        store.requestShare(eventId);
        try {
            const receipt = (await uploader.flushPending(eventId)).get(eventId);
            if (receipt === undefined)
                return { ok: false, text: '反馈服务没有返回回执。' };
            store.markSeen(receipt);
            return { ok: true, text: renderReceipt(receipt).join('\n'), eventId };
        }
        catch {
            return { ok: true, text: '已加入本地发送队列；网络恢复后只会重试同一份有限字段。', eventId };
        }
    };
    const receiptBox = async (markRead) => {
        if (uploader !== undefined) {
            try {
                await uploader.refreshReceipts();
            }
            catch {
                // A progress refresh never reveals diagnostics and never blocks local history.
            }
        }
        const receipts = new Map(store.latestReceipts().map(receipt => [receipt.eventId, receipt]));
        const queued = new Set(store.pending().map(record => record.event.eventId));
        const unreadReceipts = store.unreadReceipts();
        const unread = new Set(unreadReceipts.map(receipt => receipt.eventId));
        const items = store.visibleRecords().toReversed().map(record => {
            const event = record.event;
            const receipt = receipts.get(event.eventId);
            return {
                eventId: event.eventId,
                plugin: event.plugin,
                summary: fixedSummary(event.plugin, event.health, event.experience, event.category),
                localState: receipt !== undefined ? 'submitted' : queued.has(event.eventId) ? 'queued' : 'draft',
                ...(receipt?.status === undefined ? {} : { status: receipt.status }),
                ...(receipt?.similarReports === undefined ? {} : { similarReports: receipt.similarReports }),
                ...(receipt?.recommendedVersion === undefined ? {} : { recommendedVersion: receipt.recommendedVersion }),
                ...(receipt?.trackingUrl === undefined ? {} : { trackingUrl: receipt.trackingUrl }),
                unread: !markRead && unread.has(event.eventId),
            };
        });
        if (markRead) {
            for (const receipt of unreadReceipts)
                store.markSeen(receipt);
        }
        return { items, unreadCount: markRead ? 0 : unread.size };
    };
    const readInbox = async (markRead) => {
        if (uploader !== undefined) {
            try {
                await uploader.refreshReceipts();
            }
            catch {
                // No logging: network failures remain an unavailable state, not diagnostic data.
            }
        }
        const drafts = store.drafts();
        const queued = store.pending();
        const unread = store.unreadReceipts();
        if (drafts.length === 0 && queued.length === 0 && unread.length === 0)
            return '回执箱为空';
        const lines = [
            `回执箱：本地待确认 ${drafts.length} · 等待发送 ${queued.length} · 新进展 ${unread.length}`,
        ];
        for (const record of drafts.slice(-3)) {
            const event = record.event;
            lines.push('', `尚未发送：${fixedSummary(event.plugin, event.health, event.experience, event.category)}`);
        }
        for (const receipt of unread) {
            lines.push('', ...renderReceipt(receipt));
            if (markRead)
                store.markSeen(receipt);
        }
        return lines.join('\n');
    };
    const selectTrial = (agent, plugin) => {
        let parsed;
        try {
            const coordinate = `${plugin.moduleName}${plugin.version === undefined ? '' : `#${plugin.version}`}`;
            parsed = parseStartInput(coordinate);
        }
        catch {
            return { ok: false, text: '请选择插件清单中的公开插件。' };
        }
        const key = agentKey(agent);
        const previousDraftId = draftsBySession.get(key);
        if (previousDraftId !== undefined)
            store.discardDraft(previousDraftId);
        draftsBySession.delete(key);
        trials.set(key, { plugin: parsed.plugin });
        return {
            ok: true,
            text: `已选择 ${parsed.plugin.moduleName}${parsed.plugin.version === undefined ? '' : `#${parsed.plugin.version}`}`,
        };
    };
    const cancelCurrentDraft = (agent) => {
        const key = agentKey(agent);
        const eventId = draftsBySession.get(key);
        if (eventId !== undefined)
            store.discardDraft(eventId);
        draftsBySession.delete(key);
        trials.delete(key);
        return { ok: true, text: '已取消本地回执；没有发送任何内容。' };
    };
    const discardDraft = (agent, eventId) => {
        if (!/^[0-9a-f-]{36}$/iu.test(eventId) || !store.discardDraft(eventId)) {
            return { ok: false, text: '找不到这份本地待确认回执。' };
        }
        const key = agentKey(agent);
        if (draftsBySession.get(key) === eventId) {
            draftsBySession.delete(key);
            trials.delete(key);
        }
        return { ok: true, text: '已从本地回执箱移除。', eventId };
    };
    new PluginLabPanelService(ctx, {
        probe: panelProbe,
        select: selectTrial,
        record: recordFeedback,
        join: async (agent) => {
            const key = agentKey(agent);
            const eventId = draftsBySession.get(key);
            const result = await joinFeedback(eventId);
            if (result.ok) {
                draftsBySession.delete(key);
                trials.delete(key);
                await ctx.commands.execute(agent, '/omdsh-history', new AbortController().signal);
            }
            return result;
        },
        cancel: cancelCurrentDraft,
        discard: discardDraft,
        receipts: async (_agent, markRead) => receiptBox(markRead),
        inbox: async () => readInbox(true),
    });
    // Optional capability: headless command-only tests still work, while a normal
    // rc.6 Agent runtime receives the closed, zero-argument assessment tool.
    ctx.inject(['tools'], toolCtx => {
        toolCtx.tools.register(createAgentAssessmentTool(agent => assessTrial(agentSessionKey(agent))));
        toolCtx.tools.register(createAgentPreviewTool((agent, experience, category) => (previewTrial(agentSessionKey(agent), experience, category))));
        toolCtx.tools.register(createAgentPrepareTool(prepareFeedback));
    });
    const beginTrial = (invocation, input, retestOfReceiptId) => {
        const key = sessionKey(invocation);
        if (trials.has(key)) {
            return { kind: 'error', text: '当前任务已有进行中的插件试用；请先确认体验结果。' };
        }
        const state = {
            plugin: input.plugin,
            ...retestOfReceiptId === undefined ? {} : { retestOfReceiptId },
        };
        trials.set(key, state);
        return {
            kind: 'success',
            text: `正在试用：${input.plugin.moduleName}${input.plugin.version === undefined ? '' : `#${input.plugin.version}`} · ${healthText(health(ctx, input.plugin))}`,
        };
    };
    const startTrial = (invocation) => {
        try {
            return beginTrial(invocation, parseStartInput(invocation.rawInput));
        }
        catch {
            return { kind: 'error', text: START_USAGE };
        }
    };
    const startRetest = (invocation) => {
        const [receiptId, ...pluginParts] = invocation.rawInput.trim().split(/\s+/u).filter(Boolean);
        if (receiptId === undefined || pluginParts.length !== 1)
            return { kind: 'error', text: RETEST_USAGE };
        try {
            return beginTrial(invocation, parseStartInput(pluginParts[0] ?? ''), parseReceiptId(receiptId));
        }
        catch {
            return { kind: 'error', text: RETEST_USAGE };
        }
    };
    const probe = (invocation) => {
        return { kind: 'success', text: panelProbe(invocation.agent).text };
    };
    const submitResult = (invocation) => {
        let verdict;
        let category;
        try {
            const parsed = parseResultInput(invocation.rawInput);
            verdict = parsed.verdict;
            category = parsed.category;
        }
        catch {
            return { kind: 'error', text: RESULT_USAGE };
        }
        const result = recordFeedback(invocation.agent, verdict, category);
        return result.ok
            ? { kind: 'success', text: result.text }
            : { kind: 'error', text: `${result.text} 先运行 ${START_USAGE}` };
    };
    const joinFollowUp = async (invocation) => {
        let target;
        try {
            target = parseJoinTarget(invocation.rawInput);
        }
        catch {
            return { kind: 'error', text: JOIN_USAGE };
        }
        const eventId = target === 'latest' ? store.latestLocalRecord()?.event.eventId : target;
        const result = await joinFeedback(eventId);
        if (result.ok && eventId !== undefined) {
            const key = sessionKey(invocation);
            if (draftsBySession.get(key) === eventId) {
                draftsBySession.delete(key);
                trials.delete(key);
            }
        }
        return result.ok ? { kind: 'success', text: result.text } : { kind: 'error', text: result.text };
    };
    const inbox = async (invocation) => {
        return { kind: 'success', text: await readInbox(invocation.rawInput.trim() !== '--peek') };
    };
    const status = (invocation) => {
        const state = trials.get(sessionKey(invocation));
        const lines = state === undefined
            ? ['当前没有进行中的插件试用。']
            : [
                `插件：${state.plugin.moduleName}${state.plugin.version === undefined ? '' : `#${state.plugin.version}`}`,
                `运行状态：${healthText(health(ctx, state.plugin))}`,
                '主观体验：未确认',
            ];
        lines.push(`本地待确认回执：${store.drafts().length} 条。`, `等待发送：${store.pending().length} 条。`, `未读处理进展：${store.unreadReceipts().length} 条。`);
        return { kind: 'success', text: lines.join('\n') };
    };
    const privacy = () => ({
        kind: 'success',
        text: [
            `结构化分享：${uploader === undefined ? '未启用' : '只能由用户逐次运行 /omdsh-join 触发'}`,
            '探活：仅本地读取 DSH Host 的 Loader/Fiber 生命周期枚举，不访问插件对象或网络。',
            'Agent：只能读取公开插件名/版本和 Host 状态枚举，按固定规则建议大类；不读 Session 内容、日志或文件。',
            'Summary：只由有限枚举通过固定模板生成，服务端重建同一句，不接受自由文本 Summary。',
            '可发送字段：schemaVersion、type、随机单次 eventId、公开插件 ID/版本、health、experience、category、source。',
            '绝不读取或发送：日志、异常、堆栈、崩溃指纹、Prompt、回复正文、Tool 数据、文件、路径、环境、时间、用户/设备/安装/Session ID。',
            '网络仍会自然暴露传输元数据，因此本插件不宣称匿名；服务端必须禁止持久化 IP、User-Agent 和请求体日志。',
            `本地最小化数据：${store.dataDir}`,
        ].join('\n'),
    });
    const history = () => {
        const record = store.latestLocalRecord();
        if (record === undefined)
            return { kind: 'error', text: '没有可记录的体验回执。' };
        const event = record.event;
        const receipt = store.latestReceipts().find(item => item.eventId === event.eventId);
        const suffix = receipt?.status === undefined ? '已提交' : `已提交 · ${receipt.status}`;
        return {
            kind: 'success',
            text: `${fixedSummary(event.plugin, event.health, event.experience, event.category)} ${suffix}`,
        };
    };
    ctx.commands.register({
        name: 'omdsh-start',
        description: '开始一次单插件试用；不采集会话内容',
        input: { hint: '<public-module>[#version]' },
        recordInput: false,
        handler: startTrial,
    });
    ctx.commands.register({
        name: 'omdsh-probe',
        description: '一键查看当前插件的无日志运行状态',
        recordInput: false,
        handler: probe,
    });
    ctx.commands.register({
        name: 'omdsh-result',
        description: '由用户确认体验与脱敏大类，生成本地上传预览',
        input: { hint: `<good|mixed|bad> <${FEEDBACK_CATEGORIES.join('|')}>` },
        recordInput: false,
        handler: submitResult,
    });
    ctx.commands.register({
        name: 'omdsh-feedback',
        description: '兼容入口：由用户确认体验与脱敏大类，生成本地上传预览',
        input: { hint: `<good|mixed|bad> <${FEEDBACK_CATEGORIES.join('|')}>` },
        recordInput: false,
        handler: submitResult,
    });
    ctx.commands.register({
        name: 'omdsh-join',
        description: '明确发送已经显示给用户的有限状态字段',
        input: { hint: '<latest|event-id>' },
        recordInput: false,
        handler: joinFollowUp,
    });
    ctx.commands.register({
        name: 'omdsh-inbox',
        description: '查看本地待确认回执、聚合进展与复测邀请',
        input: { hint: '[--peek]' },
        recordInput: false,
        handler: inbox,
    });
    ctx.commands.register({
        name: 'omdsh-retest',
        description: '从问题回执开始一次零内容复测',
        input: { hint: '<receipt-id> <public-module>[#version]' },
        recordInput: false,
        handler: startRetest,
    });
    ctx.commands.register({
        name: 'omdsh-status',
        description: '查看当前试用与本地反馈状态',
        recordInput: false,
        handler: status,
    });
    ctx.commands.register({
        name: 'omdsh-privacy',
        description: '查看零日志数据边界与完整可发送字段',
        recordInput: false,
        handler: privacy,
    });
    ctx.commands.register({
        name: 'omdsh-history',
        description: '内部：在 Session 历史中保留一条已确认的体验回执卡片',
        recordInput: false,
        handler: history,
    });
    if (uploader !== undefined) {
        const flush = () => {
            void Promise.all([uploader.flushPending(), uploader.refreshReceipts()]).catch(() => {
                // Explicitly queued packets remain local; no exception text is logged.
            });
        };
        flush();
        ctx.effect(() => {
            const timer = setInterval(flush, config.retryIntervalMs);
            return () => clearInterval(timer);
        }, 'plugin-lab closed-packet retry');
    }
}
export default { name, inject, Config, apply };
//# sourceMappingURL=index.js.map