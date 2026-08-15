/** Closed, task-agnostic summary protocol shared by the DSH plugin and ingest backend. */
export const FEEDBACK_SCHEMA_VERSION = 3;
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
/** The local record is already the exact network packet; no projection can add fields. */
export function uploadPayload(record) {
    return record.event;
}
//# sourceMappingURL=protocol.js.map