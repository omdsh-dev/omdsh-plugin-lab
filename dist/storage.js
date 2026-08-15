import { appendFileSync, chmodSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
function readLines(path) {
    let text;
    try {
        text = readFileSync(path, 'utf8');
    }
    catch (error) {
        if (error.code === 'ENOENT')
            return [];
        throw error;
    }
    const rows = [];
    for (const line of text.split('\n')) {
        if (line.trim().length === 0)
            continue;
        try {
            rows.push(JSON.parse(line));
        }
        catch {
            // A torn or user-edited line is ignored; valid later rows remain usable.
        }
    }
    return rows;
}
function appendJson(path, value) {
    appendFileSync(path, `${JSON.stringify(value)}\n`, { encoding: 'utf8', mode: 0o600 });
    chmodSync(path, 0o600);
}
export function defaultDataDir() {
    const dshHome = process.env.DSH_HOME ?? join(homedir(), '.dsh');
    return join(dshHome, 'omdsh-plugin-lab');
}
/** Local outbox for the same closed packet sent over the wire. It stores no logs or identifiers. */
export class FeedbackStore {
    dataDir;
    eventsPath;
    receiptsPath;
    shareRequestsPath;
    receiptSeenPath;
    constructor(dataDir = defaultDataDir()) {
        if (!isAbsolute(dataDir))
            throw new TypeError('plugin-lab: dataDir must be an absolute path');
        this.dataDir = dataDir;
        this.eventsPath = join(dataDir, 'feedback-v3.ndjson');
        this.receiptsPath = join(dataDir, 'receipts-v3.ndjson');
        this.shareRequestsPath = join(dataDir, 'share-requests-v3.ndjson');
        this.receiptSeenPath = join(dataDir, 'receipt-seen-v3.ndjson');
        mkdirSync(dataDir, { recursive: true, mode: 0o700 });
        chmodSync(dataDir, 0o700);
    }
    append(record) {
        appendJson(this.eventsPath, record);
    }
    appendReceipt(receipt) {
        appendJson(this.receiptsPath, receipt);
    }
    requestShare(eventId) {
        if (this.record(eventId) === undefined)
            throw new Error('unknown local feedback event');
        appendJson(this.shareRequestsPath, { eventId });
    }
    markSeen(receipt) {
        if (receipt.receiptId === undefined)
            return;
        appendJson(this.receiptSeenPath, {
            receiptId: receipt.receiptId,
            ...receipt.status === undefined ? {} : { status: receipt.status },
            ...receipt.updatedAt === undefined ? {} : { updatedAt: receipt.updatedAt },
        });
    }
    records() {
        return readLines(this.eventsPath);
    }
    receipts() {
        return readLines(this.receiptsPath);
    }
    record(eventId) {
        return this.records().findLast(record => record.event.eventId === eventId);
    }
    latestLocalRecord() {
        return this.records().at(-1);
    }
    latestReceipts() {
        const latest = new Map();
        for (const receipt of this.receipts())
            latest.set(receipt.eventId, receipt);
        return [...latest.values()];
    }
    unreadReceipts() {
        const seen = new Map();
        for (const row of readLines(this.receiptSeenPath))
            seen.set(row.receiptId, row);
        return this.latestReceipts().filter(receipt => {
            if (receipt.receiptId === undefined)
                return false;
            const marker = seen.get(receipt.receiptId);
            return marker === undefined
                || marker.status !== receipt.status
                || (marker.updatedAt ?? 0) < (receipt.updatedAt ?? 0);
        });
    }
    pending() {
        const delivered = new Set(this.receipts().map(receipt => receipt.eventId));
        const requests = new Set(readLines(this.shareRequestsPath).map(row => row.eventId));
        return this.records().flatMap(record => {
            if (delivered.has(record.event.eventId))
                return [];
            if (!record.requestedShare && !requests.has(record.event.eventId))
                return [];
            return [{ ...record, requestedShare: true }];
        });
    }
}
//# sourceMappingURL=storage.js.map