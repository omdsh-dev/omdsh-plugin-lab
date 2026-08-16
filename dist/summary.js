const CATEGORY_TEXT = {
    installation: '安装',
    startup: '启动',
    invocation: '调用',
    compatibility: '兼容性',
    reliability: '稳定性',
    performance: '性能',
    result_quality: '结果质量',
    general: '整体体验',
};
const HEALTH_TEXT = {
    ok: '运行正常',
    unavailable: '当前不可用',
    error: '运行错误',
    unknown: '状态未知',
};
const VERDICT_TEXT = {
    good: '好用',
    mixed: '一般',
    bad: '不好用',
};
export function categoryText(category) {
    return CATEGORY_TEXT[category];
}
export function verdictText(verdict) {
    return VERDICT_TEXT[verdict];
}
/** Agent-facing recommendation derived without conversation, logs, or free text. */
export function suggestedCategory(health) {
    if (health === 'unavailable')
        return 'startup';
    if (health === 'error')
        return 'reliability';
    return 'general';
}
export function fixedSummary(plugin, health, experience, category) {
    const coordinate = `${plugin.moduleName}${plugin.version === undefined ? '' : `#${plugin.version}`}`;
    return `${coordinate} 在“${CATEGORY_TEXT[category]}”方面：${HEALTH_TEXT[health]}，用户体验为“${VERDICT_TEXT[experience]}”。`;
}
export function eventSummary(event) {
    return event.schemaVersion === 4
        ? event.summary
        : fixedSummary(event.plugin, event.health, event.experience, event.category);
}
/** The readable preview contains the exact bounded summary that will be uploaded. */
export function renderUploadPreview(event) {
    return [
        `脱敏 Summary：${eventSummary(event)}`,
        '这句 Summary 会随有限枚举一起发送；不会自动附带本地任务、对话、Prompt、回复、日志或文件。',
        '点击“确认发送这份回执”前不会产生网络请求。',
    ];
}
//# sourceMappingURL=summary.js.map