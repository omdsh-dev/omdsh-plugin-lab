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
export function fixedSummary(plugin, health, experience, category) {
    const coordinate = `${plugin.moduleName}${plugin.version === undefined ? '' : `#${plugin.version}`}`;
    return `${coordinate} 在“${CATEGORY_TEXT[category]}”方面：${HEALTH_TEXT[health]}，用户体验为“${VERDICT_TEXT[experience]}”。`;
}
/** Every readable preview line is derived from the exact closed upload packet. */
export function renderUploadPreview(event) {
    return [
        '待确认的脱敏摘要（尚未发送）：',
        `摘要：${fixedSummary(event.plugin, event.health, event.experience, event.category)}`,
        `插件：${event.plugin.moduleName}`,
        `版本：${event.plugin.version ?? '未提供'}`,
        `运行状态：${HEALTH_TEXT[event.health]}`,
        `体验大类：${CATEGORY_TEXT[event.category]}（${event.category}）`,
        `主观体验：${VERDICT_TEXT[event.experience]}（由你确认）`,
        `单次报告 ID：${event.eventId}`,
        ...event.retestOfReceiptId === undefined ? [] : [`复测回执 ID：${event.retestOfReceiptId}`],
        '不会上传：当前任务、对话、Prompt、回复、日志、报错详情、堆栈、文件、路径、环境或身份信息。',
    ];
}
//# sourceMappingURL=summary.js.map