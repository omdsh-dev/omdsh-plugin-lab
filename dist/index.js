/** Consent-first plugin trial feedback loop for DeepSeek Harness. */
import { createRequire } from 'node:module';
import z from '@deepseek-ai/schemastery';
import { runtimeCrashSignal } from './crash.js';
import { diagnoseExperience } from './diagnosis.js';
import { FEEDBACK_USAGE, JOIN_USAGE, parseFeedbackInput, parseResultInput, parseStartInput, RESULT_USAGE, RETEST_USAGE, retentionForOutcome, START_USAGE, } from './input.js';
import { EXPERIENCE_SCHEMA_VERSION, } from './protocol.js';
import { ExperienceStore } from './storage.js';
import { ExperienceUploader } from './uploader.js';
export const name = 'omdsh-plugin-lab';
export const inject = ['commands', 'sessions'];
const require = createRequire(import.meta.url);
function dshVersion() {
    try {
        return require('@deepseek-ai/dsh-session/package.json').version;
    }
    catch {
        return 'unknown';
    }
}
export const Config = z.object({
    dataDir: z.string(),
    ingestUrl: z.string(),
    allowAnonymousShare: z.boolean().default(false),
    authorizationEnv: z.string().default('OMDSH_PLUGIN_LAB_TOKEN'),
    profileLabel: z.string().default('default'),
    requestTimeoutMs: z.number().default(5_000),
    retryIntervalMs: z.number().default(30_000),
});
function emptyMetrics() {
    return {
        assistantMessages: 0,
        turnsStarted: 0,
        turnsCompleted: 0,
        toolCalls: 0,
        toolErrors: 0,
        agentErrors: 0,
        processCrashes: 0,
        crashes: [],
        crashIds: new Set(),
    };
}
function snapshotMetrics(metrics) {
    return {
        assistantMessages: metrics.assistantMessages,
        turnsStarted: metrics.turnsStarted,
        turnsCompleted: metrics.turnsCompleted,
        toolCalls: metrics.toolCalls,
        toolErrors: metrics.toolErrors,
        agentErrors: metrics.agentErrors,
        processCrashes: metrics.processCrashes,
        ...metrics.crashes.length === 0 ? {} : { crashes: [...metrics.crashes] },
        ...metrics.firstReplyMs === undefined ? {} : { firstReplyMs: metrics.firstReplyMs },
        ...metrics.lastTurnReason === undefined ? {} : { lastTurnReason: metrics.lastTurnReason },
    };
}
function reasonKind(value) {
    if (typeof value !== 'object' || value === null || !('kind' in value))
        return undefined;
    return typeof value.kind === 'string' ? value.kind : undefined;
}
function recordCrash(state, record) {
    if (record.trialId !== state.trialId || state.metrics.crashIds.has(record.crashId))
        return;
    state.metrics.crashIds.add(record.crashId);
    state.metrics.processCrashes += 1;
    if (state.metrics.crashes.length < 8
        && !state.metrics.crashes.some(crash => crash.fingerprint === record.crash.fingerprint)) {
        state.metrics.crashes.push(record.crash);
    }
}
function observe(state, event) {
    if (event.seq <= state.startSeq)
        return;
    switch (event.type) {
        case 'turn/start':
            state.metrics.turnsStarted += 1;
            return;
        case 'turn/end':
            state.metrics.turnsCompleted += 1;
            state.metrics.lastTurnReason = reasonKind(event.data.reason) ?? 'unknown';
            return;
        case 'assistant/message':
            state.metrics.assistantMessages += 1;
            state.metrics.firstReplyMs ??= Math.max(0, event.time - state.startedAt);
            return;
        case 'tool/call':
            state.metrics.toolCalls += 1;
            return;
        case 'tool/result':
            if (event.data.error !== undefined)
                state.metrics.toolErrors += 1;
            return;
        case 'omdsh/runtime-crashed':
            recordCrash(state, event.data);
            return;
        default:
            return;
    }
}
const FIBER_PHASE = {
    0: 'pending',
    1: 'loading',
    2: 'active',
    3: 'failed',
    4: 'unknown',
    5: 'unloading',
};
function loaderHealth(ctx, moduleName) {
    const loader = ctx.get('loader');
    if (loader === undefined || typeof loader.entries !== 'function')
        return 'unknown';
    const matches = [...loader.entries()].filter(entry => {
        const name = entry.options?.name;
        return entry.options?.group !== true
            && (name === moduleName || name?.startsWith(`${moduleName}/`) === true);
    });
    if (matches.length === 0)
        return 'missing';
    if (matches.every(entry => entry.disabled === true))
        return 'disabled';
    const phases = matches.filter(entry => entry.disabled !== true)
        .map(entry => entry.fiber?.state === undefined ? 'unknown' : FIBER_PHASE[entry.fiber.state] ?? 'unknown');
    if (phases.includes('active'))
        return 'active';
    if (phases.includes('failed'))
        return 'failed';
    return phases[0] ?? 'unknown';
}
function renderReceipt(receipt) {
    const lines = ['已匿名加入跟进。'];
    if (receipt.caseId !== undefined)
        lines.push(`问题回执：${receipt.caseId}`);
    if (receipt.similarReports !== undefined)
        lines.push(`相似反馈：${receipt.similarReports} 条。`);
    if (receipt.status !== undefined)
        lines.push(`状态：${receipt.status}。`);
    if (receipt.recommendedVersion !== undefined)
        lines.push(`建议版本：${receipt.recommendedVersion}。`);
    if (receipt.message !== undefined)
        lines.push(receipt.message);
    if (receipt.trackingUrl !== undefined)
        lines.push(`跟踪地址：${receipt.trackingUrl}`);
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
        allowAnonymousShare: config.allowAnonymousShare ?? false,
        authorizationEnv,
        profileLabel: config.profileLabel ?? 'default',
        requestTimeoutMs,
        retryIntervalMs,
    };
}
export function apply(ctx, rawConfig) {
    const config = validateConfig(rawConfig);
    const store = new ExperienceStore(config.dataDir);
    const uploader = config.allowAnonymousShare && config.ingestUrl !== undefined
        ? new ExperienceUploader(store, {
            ingestUrl: config.ingestUrl,
            authorizationEnv: config.authorizationEnv,
            requestTimeoutMs: config.requestTimeoutMs,
        })
        : undefined;
    const trials = new Map();
    const sessionKey = (session) => String(session.id);
    const adopt = (session) => {
        let state;
        for (const event of session.events) {
            if (event.type === 'omdsh/trial-started') {
                state = {
                    trialId: event.data.trialId,
                    plugin: event.data.plugin,
                    ...event.data.taskId === undefined ? {} : { taskId: event.data.taskId },
                    ...event.data.retestOfReceiptId === undefined ? {} : { retestOfReceiptId: event.data.retestOfReceiptId },
                    startedAt: event.data.startedAt,
                    startSeq: event.seq,
                    loaderHealthAtStart: event.data.loaderHealth,
                    metrics: emptyMetrics(),
                };
            }
            else if (event.type === 'omdsh/feedback-recorded' && state?.trialId === event.data.trialId) {
                state = undefined;
            }
            else if (state !== undefined) {
                observe(state, event);
            }
        }
        if (state !== undefined) {
            for (const record of store.crashRecords(state.trialId))
                recordCrash(state, record);
            trials.set(sessionKey(session), state);
        }
    };
    ctx.on('session/created', adopt);
    ctx.on('session/disposed', session => { trials.delete(sessionKey(session)); });
    ctx.on('session/event', (session, event) => {
        const state = trials.get(sessionKey(session));
        if (state !== undefined)
            observe(state, event);
    });
    ctx.on('agent/error', ({ agent }) => {
        const state = trials.get(sessionKey(agent.session));
        if (state !== undefined)
            state.metrics.agentErrors += 1;
    });
    for (const session of ctx.sessions.list())
        adopt(session);
    const monitorCrash = (error, origin) => {
        const crash = runtimeCrashSignal(error, origin);
        const occurredAt = Date.now();
        for (const session of ctx.sessions.list()) {
            const state = trials.get(sessionKey(session));
            if (state === undefined)
                continue;
            const record = {
                crashId: crypto.randomUUID(),
                trialId: state.trialId,
                occurredAt,
                crash,
            };
            try {
                store.appendCrash(record);
            }
            catch {
                // Keep monitoring best-effort: never replace the original process failure.
            }
            recordCrash(state, record);
            try {
                session.append('omdsh/runtime-crashed', record);
            }
            catch {
                // The synchronous journal above remains recoverable if Session persistence cannot run.
            }
        }
    };
    process.on('uncaughtExceptionMonitor', monitorCrash);
    ctx.effect(() => () => { process.off('uncaughtExceptionMonitor', monitorCrash); }, 'plugin-lab crash monitor');
    const beginTrial = (invocation, input, retestOfReceiptId) => {
        const key = sessionKey(invocation.agent.session);
        if (trials.has(key)) {
            return { kind: 'error', text: '当前 Session 已有进行中的 Trial；请先提交体验结果，或换一个 Session。' };
        }
        const startedAt = Date.now();
        const health = loaderHealth(ctx, input.plugin.moduleName);
        const event = invocation.agent.session.append('omdsh/trial-started', {
            trialId: crypto.randomUUID(),
            plugin: input.plugin,
            ...input.taskId === undefined ? {} : { taskId: input.taskId },
            ...retestOfReceiptId === undefined ? {} : { retestOfReceiptId },
            startedAt,
            loaderHealth: health,
        });
        trials.set(key, {
            trialId: event.data.trialId,
            plugin: input.plugin,
            ...input.taskId === undefined ? {} : { taskId: input.taskId },
            ...retestOfReceiptId === undefined ? {} : { retestOfReceiptId },
            startedAt,
            startSeq: event.seq,
            loaderHealthAtStart: health,
            metrics: emptyMetrics(),
        });
        return {
            kind: 'success',
            text: [
                `Trial 已开始：${input.plugin.moduleName}${input.plugin.version === undefined ? '' : `#${input.plugin.version}`}`,
                `Loader 状态：${health}`,
                retestOfReceiptId === undefined
                    ? '现在正常使用 Agent。完成后在最新回复旁选择结果；默认只保存在本机。'
                    : `这是回执 ${retestOfReceiptId} 的修复复测；完成后请选择结果。`,
            ].join('\n'),
            sourceEventSeq: event.seq,
        };
    };
    const startTrial = (invocation) => {
        try {
            return beginTrial(invocation, parseStartInput(invocation.rawInput));
        }
        catch (error) {
            return { kind: 'error', text: error instanceof Error ? error.message : START_USAGE };
        }
    };
    const startRetest = (invocation) => {
        const [receiptId, ...trialParts] = invocation.rawInput.trim().split(/\s+/u).filter(Boolean);
        if (receiptId === undefined || trialParts.length === 0)
            return { kind: 'error', text: RETEST_USAGE };
        try {
            return beginTrial(invocation, parseStartInput(trialParts.join(' ')), receiptId);
        }
        catch (error) {
            return { kind: 'error', text: error instanceof Error ? error.message : RETEST_USAGE };
        }
    };
    const submitFeedback = async (invocation) => {
        const state = trials.get(sessionKey(invocation.agent.session));
        if (state === undefined) {
            return { kind: 'error', text: `没有进行中的 Trial。先运行 ${START_USAGE}` };
        }
        let input;
        try {
            input = parseFeedbackInput(invocation.rawInput);
        }
        catch (error) {
            return { kind: 'error', text: error instanceof Error ? error.message : FEEDBACK_USAGE };
        }
        if (input.share && uploader === undefined) {
            return {
                kind: 'error',
                text: '匿名分享未启用。当前不会上传任何数据；请移除 --share，或由部署者同时配置 allowAnonymousShare 和 ingestUrl。',
            };
        }
        const currentHealth = loaderHealth(ctx, state.plugin.moduleName);
        const event = {
            schemaVersion: EXPERIENCE_SCHEMA_VERSION,
            type: 'feedback.submitted',
            eventId: crypto.randomUUID(),
            occurredAt: Date.now(),
            participantId: store.participantId(),
            trial: {
                id: state.trialId,
                plugin: state.plugin,
                ...state.taskId === undefined ? {} : { taskId: state.taskId },
                startedAt: state.startedAt,
                durationMs: Math.max(0, Date.now() - state.startedAt),
                ...state.retestOfReceiptId === undefined ? {} : { retestOfReceiptId: state.retestOfReceiptId },
            },
            environment: {
                dshVersion: dshVersion(),
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
                locale: Intl.DateTimeFormat().resolvedOptions().locale,
                profileLabel: config.profileLabel,
            },
            signals: {
                ...snapshotMetrics(state.metrics),
                loaderHealth: currentHealth === 'unknown' ? state.loaderHealthAtStart : currentHealth,
            },
            feedback: {
                outcome: input.outcome,
                retention: input.retention,
                ...input.note === undefined ? {} : { note: input.note },
            },
            sharing: {
                transcript: 'none',
                noteIncluded: input.shareNote,
            },
        };
        const record = {
            event,
            requestedShare: input.share,
            shareNote: input.shareNote,
        };
        if (input.dryRun) {
            const preview = input.shareNote || event.feedback.note === undefined
                ? event
                : { ...event, feedback: { outcome: event.feedback.outcome, retention: event.feedback.retention } };
            return {
                kind: 'success',
                text: `预览：不会保存或上传。\n${JSON.stringify(preview, null, 2)}`,
            };
        }
        store.append(record);
        const feedbackEvent = invocation.agent.session.append('omdsh/feedback-recorded', {
            eventId: event.eventId,
            trialId: state.trialId,
            outcome: input.outcome,
            retention: input.retention,
            requestedShare: input.share,
            noteShared: input.shareNote,
        });
        trials.delete(sessionKey(invocation.agent.session));
        const diagnosis = diagnoseExperience(event, input.outcome, input.retention);
        const lines = [diagnosis.headline, ...diagnosis.actions.map(action => `- ${action}`)];
        lines.push(`已保存到本机：${store.eventsPath}`);
        lines.push('记录不包含 Prompt、会话正文、Tool 参数/结果或工作目录。');
        if (input.note !== undefined && !input.shareNote)
            lines.push('文字备注仅保存在本机。');
        if (input.share && uploader !== undefined) {
            try {
                const receipts = await uploader.flushPending(event.eventId);
                const receipt = receipts.get(event.eventId);
                if (receipt !== undefined) {
                    lines.push(...renderReceipt(receipt));
                    store.markSeen(receipt);
                }
            }
            catch (error) {
                lines.push(`匿名上传暂时失败，已留在本地队列并会重试：${error instanceof Error ? error.message : String(error)}`);
            }
        }
        else {
            lines.push('本次只保存在本机。选择“加入跟进”或运行 /omdsh-join latest 才会匿名发送结构化体感。');
        }
        return { kind: 'success', text: lines.join('\n'), sourceEventSeq: feedbackEvent.seq };
    };
    const submitResult = async (invocation) => {
        let input;
        try {
            input = parseResultInput(invocation.rawInput);
        }
        catch (error) {
            return { kind: 'error', text: error instanceof Error ? error.message : RESULT_USAGE };
        }
        const note = input.note === undefined ? '' : ` ${input.note}`;
        return await submitFeedback({
            ...invocation,
            rawInput: `${input.outcome} ${retentionForOutcome(input.outcome)}${note}`,
        });
    };
    const joinFollowUp = async (invocation) => {
        if (uploader === undefined) {
            return {
                kind: 'error',
                text: '匿名跟进未启用。部署者需要同时配置 allowAnonymousShare 和 ingestUrl。',
            };
        }
        const parts = invocation.rawInput.trim().split(/\s+/u).filter(Boolean);
        const target = parts.shift();
        if (target === undefined || parts.some(part => part !== '--share-note')) {
            return { kind: 'error', text: JOIN_USAGE };
        }
        const latestSessionEvent = invocation.agent.session.events.findLast(event => event.type === 'omdsh/feedback-recorded');
        const eventId = target === 'latest'
            ? latestSessionEvent?.data.eventId
            : target;
        if (eventId === undefined || store.record(eventId) === undefined) {
            return { kind: 'error', text: '找不到这条本地体验记录。请先提交一次结果。' };
        }
        const existing = store.latestReceipts().find(receipt => receipt.eventId === eventId);
        if (existing !== undefined)
            return { kind: 'success', text: renderReceipt(existing).join('\n') };
        const shareNote = parts.includes('--share-note');
        store.requestShare(eventId, shareNote);
        try {
            const receipt = (await uploader.flushPending(eventId)).get(eventId);
            if (receipt === undefined)
                return { kind: 'error', text: '没有生成远端回执，请稍后运行 /omdsh-inbox。' };
            store.markSeen(receipt);
            return { kind: 'success', text: renderReceipt(receipt).join('\n') };
        }
        catch (error) {
            return {
                kind: 'success',
                text: `已加入本地发送队列；网络恢复后会自动重试。\n${error instanceof Error ? error.message : String(error)}`,
            };
        }
    };
    const inbox = async (invocation) => {
        if (uploader !== undefined) {
            try {
                await uploader.refreshReceipts();
            }
            catch (error) {
                ctx.logger.warn(`plugin-lab: receipt refresh failed: ${String(error)}`);
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
        const state = trials.get(sessionKey(invocation.agent.session));
        if (state === undefined) {
            return {
                kind: 'success',
                text: [
                    '当前没有进行中的 Trial。',
                    `待发送匿名记录：${store.pending().length} 条。`,
                    `未读处理进展：${store.unreadReceipts().length} 条。`,
                ].join('\n'),
            };
        }
        const metrics = snapshotMetrics(state.metrics);
        return {
            kind: 'success',
            text: [
                `Trial：${state.plugin.moduleName}${state.plugin.version === undefined ? '' : `#${state.plugin.version}`}`,
                `Loader：${loaderHealth(ctx, state.plugin.moduleName)}`,
                `Assistant 回复：${metrics.assistantMessages}`,
                `Tool：${metrics.toolCalls} 次，错误 ${metrics.toolErrors} 次`,
                `Turn：${metrics.turnsCompleted}/${metrics.turnsStarted}`,
                `进程崩溃：${metrics.processCrashes} 次${metrics.crashes?.[0] === undefined ? '' : `（${metrics.crashes[0].name} / ${metrics.crashes[0].fingerprint}）`}`,
                `首回复：${metrics.firstReplyMs === undefined ? '尚未产生' : `${metrics.firstReplyMs} ms`}`,
            ].join('\n'),
        };
    };
    const privacy = () => ({
        kind: 'success',
        text: [
            `匿名分享：${uploader === undefined ? '未启用' : '可由用户逐次通过 --share 触发'}`,
            '默认：仅本地保存。',
            '匿名结构化字段：插件名/版本、DSH/Node/OS、任务 ID、加载状态、时延和错误计数、结果与保留意愿。',
            '永不自动发送：Prompt、回复正文、Tool 参数/结果、cwd、Session ID。',
            '备注默认不发送；只有 --share-note 会发送备注。',
            '进行中 Trial 若遇到进程崩溃，只记录错误类型、错误码、归一化首帧和指纹；不记录原始 message、完整 stack 或绝对路径。',
            `本地数据：${store.dataDir}`,
            '结果先用 /omdsh-result 存在本机；/omdsh-join latest 才加入匿名跟进。',
            '发送前也可在 /omdsh-feedback 参数末尾加 --dry-run 查看完整 JSON。',
        ].join('\n'),
    });
    const resetId = (invocation) => {
        if (invocation.rawInput.trim() !== 'confirm') {
            return { kind: 'error', text: 'Usage: /omdsh-reset-id confirm' };
        }
        store.resetParticipantId();
        return {
            kind: 'success',
            text: '已生成新的 Plugin Lab 匿名 ID。此前已经上传的数据不会因此被远端删除。',
        };
    };
    ctx.commands.register({
        name: 'omdsh-start',
        description: '开始一次有明确目标插件的体验 Trial',
        input: { hint: '<module>[#version] [task-id]' },
        recordInput: false,
        handler: startTrial,
    });
    ctx.commands.register({
        name: 'omdsh-feedback',
        description: '兼容入口：提交结构化插件体感；默认仅本地保存',
        input: { hint: '<worked|partial|failed> <keep|unsure|remove> [flags] [note]' },
        recordInput: false,
        handler: submitFeedback,
    });
    ctx.commands.register({
        name: 'omdsh-result',
        description: '记录这次插件是否做成；只保存在本机',
        input: { hint: '<worked|partial|failed> [note]' },
        recordInput: false,
        handler: submitResult,
    });
    ctx.commands.register({
        name: 'omdsh-join',
        description: '匿名加入相似问题、获取处理回执和后续通知',
        input: { hint: '<latest|event-id> [--share-note]' },
        recordInput: false,
        handler: joinFollowUp,
    });
    ctx.commands.register({
        name: 'omdsh-inbox',
        description: '查看问题确认、修复发布与复测邀请',
        input: { hint: '[--peek]' },
        recordInput: false,
        handler: inbox,
    });
    ctx.commands.register({
        name: 'omdsh-retest',
        description: '从问题回执启动一次修复复测',
        input: { hint: '<receipt-id> <module>[#version] [task-id]' },
        recordInput: false,
        handler: startRetest,
    });
    ctx.commands.register({
        name: 'omdsh-status',
        description: '查看当前 Trial 的无内容运行指标',
        recordInput: false,
        handler: status,
    });
    ctx.commands.register({
        name: 'omdsh-privacy',
        description: '查看 Plugin Lab 的本地存储与分享边界',
        recordInput: false,
        handler: privacy,
    });
    ctx.commands.register({
        name: 'omdsh-reset-id',
        description: '重置 Plugin Lab 自己的匿名安装 ID',
        input: { hint: 'confirm' },
        recordInput: false,
        handler: resetId,
    });
    if (uploader !== undefined) {
        const flush = () => {
            void Promise.all([
                uploader.flushPending(),
                uploader.refreshReceipts(),
            ]).catch(error => {
                ctx.logger.warn(`plugin-lab: background exchange failed: ${String(error)}`);
            });
        };
        flush();
        ctx.effect(() => {
            const timer = setInterval(flush, config.retryIntervalMs);
            return () => clearInterval(timer);
        }, 'plugin-lab upload retry');
    }
}
export default { name, inject, Config, apply };
//# sourceMappingURL=index.js.map