/** Public, versioned protocol shared by the DSH plugin and an ingest backend. */
export const EXPERIENCE_SCHEMA_VERSION = 1;
/** Remove the local-only note unless the user explicitly chose --share-note. */
export function uploadPayload(record) {
    if (record.shareNote || record.event.feedback.note === undefined)
        return record.event;
    const { note: _localOnlyNote, ...feedback } = record.event.feedback;
    return {
        ...record.event,
        feedback,
        sharing: { transcript: 'none', noteIncluded: false },
    };
}
//# sourceMappingURL=protocol.js.map