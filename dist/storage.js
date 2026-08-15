import { appendFileSync, chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
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
export class ExperienceStore {
    dataDir;
    eventsPath;
    receiptsPath;
    shareRequestsPath;
    receiptSeenPath;
    identityPath;
    constructor(dataDir = defaultDataDir()) {
        if (!isAbsolute(dataDir))
            throw new TypeError('plugin-lab: dataDir must be an absolute path');
        this.dataDir = dataDir;
        this.eventsPath = join(dataDir, 'events.ndjson');
        this.receiptsPath = join(dataDir, 'receipts.ndjson');
        this.shareRequestsPath = join(dataDir, 'share-requests.ndjson');
        this.receiptSeenPath = join(dataDir, 'receipt-seen.ndjson');
        this.identityPath = join(dataDir, '.install-id');
        mkdirSync(dataDir, { recursive: true, mode: 0o700 });
        chmodSync(dataDir, 0o700);
    }
    participantId() {
        try {
            const existing = readFileSync(this.identityPath, 'utf8').trim();
            if (UUID.test(existing))
                return existing;
        }
        catch (error) {
            if (error.code !== 'ENOENT')
                throw error;
        }
        return this.resetParticipantId();
    }
    resetParticipantId() {
        const id = crypto.randomUUID();
        writeFileSync(this.identityPath, `${id}\n`, { encoding: 'utf8', mode: 0o600 });
        chmodSync(this.identityPath, 0o600);
        return id;
    }
    append(record) {
        appendJson(this.eventsPath, record);
    }
    appendReceipt(receipt) {
        appendJson(this.receiptsPath, receipt);
    }
    requestShare(eventId, shareNote = false) {
        if (this.record(eventId) === undefined)
            throw new Error(`unknown local event: ${eventId}`);
        appendJson(this.shareRequestsPath, { eventId, requestedAt: Date.now(), shareNote });
    }
    markSeen(receipt) {
        if (receipt.receiptId === undefined)
            return;
        appendJson(this.receiptSeenPath, {
            receiptId: receipt.receiptId,
            ...receipt.status === undefined ? {} : { status: receipt.status },
            ...receipt.updatedAt === undefined ? {} : { updatedAt: receipt.updatedAt },
            seenAt: Date.now(),
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
        const requests = new Map();
        for (const request of readLines(this.shareRequestsPath))
            requests.set(request.eventId, request);
        return this.records().flatMap(record => {
            if (delivered.has(record.event.eventId))
                return [];
            const request = requests.get(record.event.eventId);
            if (!record.requestedShare && request === undefined)
                return [];
            return [{
                    ...record,
                    requestedShare: true,
                    shareNote: record.shareNote || request?.shareNote === true,
                }];
        });
    }
}
//# sourceMappingURL=storage.js.map