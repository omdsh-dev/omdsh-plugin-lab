/** Closed, zero-content protocol shared by the DSH plugin and ingest backend. */
export const FEEDBACK_SCHEMA_VERSION = 2;
/** The local record is already the exact network packet; no projection can add fields. */
export function uploadPayload(record) {
    return record.event;
}
//# sourceMappingURL=protocol.js.map