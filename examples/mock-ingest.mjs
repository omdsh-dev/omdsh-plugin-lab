import { createServer } from 'node:http'

const port = Number(process.env.PORT ?? 8787)
const reports = new Map()
const allowed = new Set([
  'schemaVersion', 'type', 'eventId', 'plugin', 'health', 'experience', 'category',
  'summary', 'summarySource', 'source', 'retestOfReceiptId',
])
const categories = new Set([
  'installation', 'startup', 'invocation', 'compatibility',
  'reliability', 'performance', 'result_quality', 'general',
])

const server = createServer((request, response) => {
  if (request.method !== 'POST' || request.url !== '/v1/experience-events') {
    return json(response, 404, { error: 'not found' })
  }
  let raw = ''
  request.setEncoding('utf8')
  request.on('data', chunk => {
    raw += chunk
    if (Buffer.byteLength(raw) > 1_024) request.destroy()
  })
  request.on('end', () => {
    try {
      const event = JSON.parse(raw)
      if ((event?.schemaVersion !== 3 && event?.schemaVersion !== 4) || event?.type !== 'feedback.signal') throw new TypeError()
      if (Object.keys(event).some(key => !allowed.has(key))) throw new TypeError()
      if (event.schemaVersion === 3 && ('summary' in event || 'summarySource' in event)) throw new TypeError()
      if (event.schemaVersion === 4) {
        if (typeof event.summary !== 'string' || event.summary.length === 0 || event.summary.length > 320) throw new TypeError()
        if (event.summarySource !== 'template' && event.summarySource !== 'user_edited') throw new TypeError()
        if (/\r|\n|https?:\/\/|\/Users\/|\b(?:token|secret|password|api[ _-]?key)\s*[:=]/iu.test(event.summary)) throw new TypeError()
      }
      if (event?.source !== 'user_confirmed') throw new TypeError()
      if (!categories.has(event?.category)) throw new TypeError()
      const plugin = event?.plugin?.moduleName
      if (typeof plugin !== 'string' || plugin.length === 0) throw new TypeError()
      const version = typeof event.plugin.version === 'string' ? event.plugin.version : 'unknown'
      const key = `${plugin}#${version}:${event.health}:${event.experience}:${event.category}`
      const similarReports = (reports.get(key) ?? 0) + 1
      reports.set(key, similarReports)
      return json(response, 200, {
        receiptId: crypto.randomUUID(),
        status: similarReports > 1 ? 'clustered' : 'received',
        similarReports,
      })
    } catch {
      return json(response, 400, { error: 'invalid closed packet' })
    }
  })
})

function json(response, status, value) {
  const body = JSON.stringify(value)
  response.writeHead(status, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  response.end(body)
}

server.listen(port, '127.0.0.1', () => {
  console.log(`Plugin Lab demo ingest listening on http://127.0.0.1:${port}/v1/experience-events`)
})
