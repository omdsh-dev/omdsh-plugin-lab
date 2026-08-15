/** Task-agnostic plugin health and user-confirmed feedback loop for DeepSeek Harness. */
import z from '@deepseek-ai/schemastery';
import { createAgentAssessmentTool, createAgentPreviewTool } from './agent-tool.js';
import { healthText, probeLoaderHealth } from './health.js';
import { JOIN_USAGE, parseJoinTarget, parseReceiptId, parseResultInput, parseStartInput, RESULT_USAGE, RETEST_USAGE, START_USAGE, } from './input.js';
import { FEEDBACK_SCHEMA_VERSION, FEEDBACK_CATEGORIES, } from './protocol.js';
import { FeedbackStore } from './storage.js';
import { fixedSummary, renderUploadPreview } from './summary.js';
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
function health(ctx, plugin) {
    return probeLoaderHealth(ctx.get('loader'), plugin.moduleName);
}
function assessment(status) {
    return {
        health: status,
        experience: 'unknown',
        feedbackCategories: FEEDBACK_CATEGORIES,
        summaryIsTemplateOnly: true,
        userConfirmationRequired: true,
    };
}
function renderReceipt(receipt) {
    const lines = ['已发送严格最小化反馈。'];
    if (receipt.caseId !== undefined)
        lines.push(`问题回执：${receipt.caseId}`);
    if (receipt.similarReports !== undefined)
        lines.push(`同类反馈：${receipt.similarReports} 条。`);
    if (receipt.status !== undefined)
        lines.push(`状态：${receipt.status}。`);
    if (receipt.recommendedVersion !== undefined)
        lines.push(`建议版本：${receipt.recommendedVersion}。`);
    if (receipt.trackingUrl !== undefined)
        lines.push(`聚合跟踪：${receipt.trackingUrl}`);
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
    const assessTrial = (key) => {
        const state = key === undefined ? undefined : trials.get(key);
        return assessment(state === undefined ? 'unknown' : health(ctx, state.plugin));
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
    // Optional capability: headless command-only tests still work, while a normal
    // rc.6 Agent runtime receives the closed, zero-argument assessment tool.
    ctx.inject(['tools'], toolCtx => {
        toolCtx.tools.register(createAgentAssessmentTool(agent => assessTrial(agentSessionKey(agent))));
        toolCtx.tools.register(createAgentPreviewTool((agent, experience, category) => (previewTrial(agentSessionKey(agent), experience, category))));
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
            text: [
                `试用已开始：${input.plugin.moduleName}${input.plugin.version === undefined ? '' : `#${input.plugin.version}`}`,
                `运行状态：${healthText(health(ctx, input.plugin))}`,
                '完成后由你选择体验和一个脱敏大类；Agent 只能用有限枚举生成固定模板预览。',
            ].join('\n'),
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
        const state = trials.get(sessionKey(invocation));
        const result = assessTrial(sessionKey(invocation));
        return {
            kind: 'success',
            text: state === undefined
                ? `${healthText(result.health)}：当前没有选中的插件试用。`
                : [
                    `插件：${state.plugin.moduleName}`,
                    `运行状态：${healthText(result.health)}`,
                    '主观体验：未确认。探活没有读取日志、会话、异常或文件。Agent 可建议大类，但不能提交任务摘要。',
                ].join('\n'),
        };
    };
    const submitResult = (invocation) => {
        const key = sessionKey(invocation);
        const state = trials.get(key);
        if (state === undefined)
            return { kind: 'error', text: `没有进行中的插件试用。先运行 ${START_USAGE}` };
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
        trials.delete(key);
        return {
            kind: 'success',
            text: [
                ...renderUploadPreview(event),
                `已只保存到本机：${store.eventsPath}`,
                '请检查以上预览；只有运行 /omdsh-join latest 才会发送这组有限字段。',
            ].join('\n'),
        };
    };
    const joinFollowUp = async (invocation) => {
        if (uploader === undefined) {
            return { kind: 'error', text: '结构化分享未启用；当前不会产生反馈网络请求。' };
        }
        let target;
        try {
            target = parseJoinTarget(invocation.rawInput);
        }
        catch {
            return { kind: 'error', text: JOIN_USAGE };
        }
        const eventId = target === 'latest' ? store.latestLocalRecord()?.event.eventId : target;
        if (eventId === undefined || store.record(eventId) === undefined) {
            return { kind: 'error', text: '找不到这条本地体验记录。请先确认一次结果。' };
        }
        const existing = store.latestReceipts().find(receipt => receipt.eventId === eventId);
        if (existing !== undefined)
            return { kind: 'success', text: renderReceipt(existing).join('\n') };
        store.requestShare(eventId);
        try {
            const receipt = (await uploader.flushPending(eventId)).get(eventId);
            if (receipt === undefined)
                return { kind: 'error', text: '反馈服务没有返回回执。' };
            store.markSeen(receipt);
            return { kind: 'success', text: renderReceipt(receipt).join('\n') };
        }
        catch {
            return { kind: 'success', text: '已加入本地发送队列；网络恢复后只会重试同一份有限字段。' };
        }
    };
    const inbox = async (invocation) => {
        if (uploader !== undefined) {
            try {
                await uploader.refreshReceipts();
            }
            catch {
                // No logging: network failures remain an unavailable state, not diagnostic data.
            }
        }
        const unread = store.unreadReceipts();
        if (unread.length === 0)
            return { kind: 'success', text: 'Plugin Lab 暂无新的处理进展。' };
        const lines = [`Plugin Lab 有 ${unread.length} 条新进展：`];
        for (const receipt of unread) {
            lines.push('', ...renderReceipt(receipt));
            if (invocation.rawInput.trim() !== '--peek')
                store.markSeen(receipt);
        }
        return { kind: 'success', text: lines.join('\n') };
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
        lines.push(`待发送记录：${store.pending().length} 条。`, `未读处理进展：${store.unreadReceipts().length} 条。`);
        return { kind: 'success', text: lines.join('\n') };
    };
    const privacy = () => ({
        kind: 'success',
        text: [
            `结构化分享：${uploader === undefined ? '未启用' : '只能由用户逐次运行 /omdsh-join 触发'}`,
            '探活：仅本地读取 DSH Host 的 Loader/Fiber 生命周期枚举，不访问插件对象或网络。',
            'Agent：探活工具零参数；预览工具只接受体验和大类枚举，固定模板预览不会存储或发送。',
            '可发送字段：schemaVersion、type、随机单次 eventId、公开插件 ID/版本、health、experience、category、source。',
            '绝不读取或发送：日志、异常、堆栈、崩溃指纹、Prompt、回复、Tool 数据、文件、路径、环境、时间、用户/设备/安装/Session ID。',
            '网络仍会自然暴露传输元数据，因此本插件不宣称匿名；服务端必须禁止持久化 IP、User-Agent 和请求体日志。',
            `本地最小化数据：${store.dataDir}`,
        ].join('\n'),
    });
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
        description: '查看聚合问题、修复版本与复测邀请',
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