import { appendFileSync, chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import type {
  IngestReceipt, LocalCrashRecord, LocalExperienceRecord, ReceiptSeen, ShareRequest,
} from './protocol.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

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

export class ExperienceStore {
  readonly dataDir: string
  readonly eventsPath: string
  readonly crashesPath: string
  readonly receiptsPath: string
  readonly shareRequestsPath: string
  readonly receiptSeenPath: string
  private readonly identityPath: string

  constructor(dataDir = defaultDataDir()) {
    if (!isAbsolute(dataDir)) throw new TypeError('plugin-lab: dataDir must be an absolute path')
    this.dataDir = dataDir
    this.eventsPath = join(dataDir, 'events.ndjson')
    this.crashesPath = join(dataDir, 'crashes.ndjson')
    this.receiptsPath = join(dataDir, 'receipts.ndjson')
    this.shareRequestsPath = join(dataDir, 'share-requests.ndjson')
    this.receiptSeenPath = join(dataDir, 'receipt-seen.ndjson')
    this.identityPath = join(dataDir, '.install-id')
    mkdirSync(dataDir, { recursive: true, mode: 0o700 })
    chmodSync(dataDir, 0o700)
  }

  participantId(): string {
    try {
      const existing = readFileSync(this.identityPath, 'utf8').trim()
      if (UUID.test(existing)) return existing
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    return this.resetParticipantId()
  }

  resetParticipantId(): string {
    const id = crypto.randomUUID()
    writeFileSync(this.identityPath, `${id}\n`, { encoding: 'utf8', mode: 0o600 })
    chmodSync(this.identityPath, 0o600)
    return id
  }

  append(record: LocalExperienceRecord): void {
    appendJson(this.eventsPath, record)
  }

  /** This deliberately uses synchronous append: the process may exit immediately afterward. */
  appendCrash(record: LocalCrashRecord): void {
    appendJson(this.crashesPath, record)
  }

  crashRecords(trialId?: string): LocalCrashRecord[] {
    const records = readLines<LocalCrashRecord>(this.crashesPath)
    return trialId === undefined ? records : records.filter(record => record.trialId === trialId)
  }

  appendReceipt(receipt: IngestReceipt): void {
    appendJson(this.receiptsPath, receipt)
  }

  requestShare(eventId: string, shareNote = false): void {
    if (this.record(eventId) === undefined) throw new Error(`unknown local event: ${eventId}`)
    appendJson(this.shareRequestsPath, { eventId, requestedAt: Date.now(), shareNote } satisfies ShareRequest)
  }

  markSeen(receipt: IngestReceipt): void {
    if (receipt.receiptId === undefined) return
    appendJson(this.receiptSeenPath, {
      receiptId: receipt.receiptId,
      ...receipt.status === undefined ? {} : { status: receipt.status },
      ...receipt.updatedAt === undefined ? {} : { updatedAt: receipt.updatedAt },
      seenAt: Date.now(),
    } satisfies ReceiptSeen)
  }

  records(): LocalExperienceRecord[] {
    return readLines<LocalExperienceRecord>(this.eventsPath)
  }

  receipts(): IngestReceipt[] {
    return readLines<IngestReceipt>(this.receiptsPath)
  }

  record(eventId: string): LocalExperienceRecord | undefined {
    return this.records().findLast(record => record.event.eventId === eventId)
  }

  latestLocalRecord(): LocalExperienceRecord | undefined {
    return this.records().at(-1)
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

  pending(): LocalExperienceRecord[] {
    const delivered = new Set(this.receipts().map(receipt => receipt.eventId))
    const requests = new Map<string, ShareRequest>()
    for (const request of readLines<ShareRequest>(this.shareRequestsPath)) requests.set(request.eventId, request)
    return this.records().flatMap(record => {
      if (delivered.has(record.event.eventId)) return []
      const request = requests.get(record.event.eventId)
      if (!record.requestedShare && request === undefined) return []
      return [{
        ...record,
        requestedShare: true,
        shareNote: record.shareNote || request?.shareNote === true,
      }]
    })
  }
}
