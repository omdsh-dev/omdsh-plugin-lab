import { appendFileSync, chmodSync, mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import type {
  DraftDiscard, IngestReceipt, LocalFeedbackRecord, ReceiptSeen, ShareRequest,
} from './protocol.js'

function readLines<T>(path: string): T[] {
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  const rows: T[] = []
  for (const line of text.split('\n')) {
    if (line.trim().length === 0) continue
    try {
      rows.push(JSON.parse(line) as T)
    } catch {
      // A torn or user-edited line is ignored; valid later rows remain usable.
    }
  }
  return rows
}

function appendJson(path: string, value: unknown): void {
  appendFileSync(path, `${JSON.stringify(value)}\n`, { encoding: 'utf8', mode: 0o600 })
  chmodSync(path, 0o600)
}

export function defaultDataDir(): string {
  const dshHome = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(dshHome, 'omdsh-plugin-lab')
}

/** Local outbox for the same bounded packet sent over the wire. It stores no logs or identifiers. */
export class FeedbackStore {
  readonly dataDir: string
  readonly eventsPath: string
  readonly legacyEventsPath: string
  readonly receiptsPath: string
  readonly shareRequestsPath: string
  readonly receiptSeenPath: string
  readonly draftDiscardsPath: string

  constructor(dataDir = defaultDataDir()) {
    if (!isAbsolute(dataDir)) throw new TypeError('plugin-lab: dataDir must be an absolute path')
    this.dataDir = dataDir
    this.eventsPath = join(dataDir, 'feedback-v4.ndjson')
    this.legacyEventsPath = join(dataDir, 'feedback-v3.ndjson')
    this.receiptsPath = join(dataDir, 'receipts-v3.ndjson')
    this.shareRequestsPath = join(dataDir, 'share-requests-v3.ndjson')
    this.receiptSeenPath = join(dataDir, 'receipt-seen-v3.ndjson')
    this.draftDiscardsPath = join(dataDir, 'draft-discards-v3.ndjson')
    mkdirSync(dataDir, { recursive: true, mode: 0o700 })
    chmodSync(dataDir, 0o700)
  }

  append(record: LocalFeedbackRecord): void {
    appendJson(this.eventsPath, record)
  }

  appendReceipt(receipt: IngestReceipt): void {
    appendJson(this.receiptsPath, receipt)
  }

  requestShare(eventId: string): void {
    if (this.record(eventId) === undefined) throw new Error('unknown local feedback event')
    appendJson(this.shareRequestsPath, { eventId } satisfies ShareRequest)
  }

  /** Hide one unsubmitted local draft; replacement text is validated before this call. */
  discardDraft(eventId: string): boolean {
    if (!this.drafts().some(record => record.event.eventId === eventId)) return false
    appendJson(this.draftDiscardsPath, { eventId } satisfies DraftDiscard)
    return true
  }

  markSeen(receipt: IngestReceipt): void {
    if (receipt.receiptId === undefined) return
    appendJson(this.receiptSeenPath, {
      receiptId: receipt.receiptId,
      ...receipt.status === undefined ? {} : { status: receipt.status },
      ...receipt.updatedAt === undefined ? {} : { updatedAt: receipt.updatedAt },
    } satisfies ReceiptSeen)
  }

  records(): LocalFeedbackRecord[] {
    return [
      ...readLines<LocalFeedbackRecord>(this.legacyEventsPath),
      ...readLines<LocalFeedbackRecord>(this.eventsPath),
    ]
  }

  receipts(): IngestReceipt[] {
    return readLines<IngestReceipt>(this.receiptsPath)
  }

  record(eventId: string): LocalFeedbackRecord | undefined {
    return this.visibleRecords().findLast(record => record.event.eventId === eventId)
  }

  latestLocalRecord(): LocalFeedbackRecord | undefined {
    return this.visibleRecords().at(-1)
  }

  visibleRecords(): LocalFeedbackRecord[] {
    const discarded = new Set(readLines<DraftDiscard>(this.draftDiscardsPath).map(row => row.eventId))
    return this.records().filter(record => !discarded.has(record.event.eventId))
  }

  latestReceipts(): IngestReceipt[] {
    const latest = new Map<string, IngestReceipt>()
    for (const receipt of this.receipts()) latest.set(receipt.eventId, receipt)
    return [...latest.values()]
  }

  unreadReceipts(): IngestReceipt[] {
    const seen = new Map<string, ReceiptSeen>()
    for (const row of readLines<ReceiptSeen>(this.receiptSeenPath)) seen.set(row.receiptId, row)
    return this.latestReceipts().filter(receipt => {
      if (receipt.receiptId === undefined) return false
      const marker = seen.get(receipt.receiptId)
      return marker === undefined
        || marker.status !== receipt.status
        || (marker.updatedAt ?? 0) < (receipt.updatedAt ?? 0)
    })
  }

  /** Local previews that have never been approved for network sharing. */
  drafts(): LocalFeedbackRecord[] {
    const delivered = new Set(this.receipts().map(receipt => receipt.eventId))
    const requests = new Set(readLines<ShareRequest>(this.shareRequestsPath).map(row => row.eventId))
    return this.visibleRecords().filter(record => (
      !delivered.has(record.event.eventId) && !record.requestedShare && !requests.has(record.event.eventId)
    ))
  }

  pending(): LocalFeedbackRecord[] {
    const delivered = new Set(this.receipts().map(receipt => receipt.eventId))
    const requests = new Set(readLines<ShareRequest>(this.shareRequestsPath).map(row => row.eventId))
    return this.visibleRecords().flatMap(record => {
      if (delivered.has(record.event.eventId)) return []
      if (!record.requestedShare && !requests.has(record.event.eventId)) return []
      return [{ ...record, requestedShare: true }]
    })
  }
}
