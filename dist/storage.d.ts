import type { IngestReceipt, LocalFeedbackRecord } from './protocol.js';
export declare function defaultDataDir(): string;
/** Local outbox for the same bounded packet sent over the wire. It stores no logs or identifiers. */
export declare class FeedbackStore {
    readonly dataDir: string;
    readonly eventsPath: string;
    readonly legacyEventsPath: string;
    readonly receiptsPath: string;
    readonly shareRequestsPath: string;
    readonly receiptSeenPath: string;
    readonly draftDiscardsPath: string;
    constructor(dataDir?: string);
    append(record: LocalFeedbackRecord): void;
    appendReceipt(receipt: IngestReceipt): void;
    requestShare(eventId: string): void;
    /** Hide one unsubmitted local draft; replacement text is validated before this call. */
    discardDraft(eventId: string): boolean;
    markSeen(receipt: IngestReceipt): void;
    records(): LocalFeedbackRecord[];
    receipts(): IngestReceipt[];
    record(eventId: string): LocalFeedbackRecord | undefined;
    latestLocalRecord(): LocalFeedbackRecord | undefined;
    visibleRecords(): LocalFeedbackRecord[];
    latestReceipts(): IngestReceipt[];
    unreadReceipts(): IngestReceipt[];
    /** Local previews that have never been approved for network sharing. */
    drafts(): LocalFeedbackRecord[];
    pending(): LocalFeedbackRecord[];
}
