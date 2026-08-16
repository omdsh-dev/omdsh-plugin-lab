/** Bounded, user-previewed summary protocol shared by the DSH plugin and ingest backend. */
export const FEEDBACK_SCHEMA_VERSION = 4;
export const MAX_FEEDBACK_SUMMARY_LENGTH = 320;
export const FEEDBACK_CATEGORIES = [
    'installation',
    'startup',
    'invocation',
    'compatibility',
    'reliability',
    'performance',
    'result_quality',
    'general',
];
const SUMMARY_GUARDS = [
    [/\r|\n|[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u, '摘要只能是一段文字'],
    [/\b(?:https?:\/\/|www\.)/iu, '摘要不能包含链接'],
    [/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/u, '摘要不能包含邮箱'],
    [/(?:^|[\s'"`])(?:\/(?:Users|home|private|tmp|var|etc)\/|[A-Za-z]:[\\/])/u, '摘要不能包含本地路径'],
    [/\b(?:sk|ghp|github_pat|AKIA|AIza)[-_A-Za-z0-9]{8,}\b/u, '摘要不能包含疑似密钥'],
    [/\b(?:token|secret|password|api[ _-]?key)\s*[:=]/iu, '摘要不能包含凭据字段'],
    [/(?:\bat\s+\S+\s*\(|(?:Error|Exception):|\.[cm]?[jt]sx?:\d+(?::\d+)?|\.py:\d+)/u, '摘要不能包含堆栈或异常正文'],
    [/^\[?\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/u, '摘要不能包含日志行'],
];
/** Normalize and reject common pasted-secret, path, log and stack shapes before storage or upload. */
export function normalizeFeedbackSummary(value) {
    if (typeof value !== 'string')
        throw new TypeError('摘要格式无效');
    const normalized = value.normalize('NFC').trim().replace(/[\t ]+/gu, ' ');
    if (normalized.length === 0)
        throw new TypeError('摘要不能为空');
    if (normalized.length > MAX_FEEDBACK_SUMMARY_LENGTH) {
        throw new TypeError(`摘要不能超过 ${MAX_FEEDBACK_SUMMARY_LENGTH} 个字符`);
    }
    for (const [pattern, message] of SUMMARY_GUARDS) {
        if (pattern.test(normalized))
            throw new TypeError(message);
    }
    return normalized;
}
/** The local record is already the exact network packet; no projection can add fields. */
export function uploadPayload(record) {
    return record.event;
}
//# sourceMappingURL=protocol.js.map