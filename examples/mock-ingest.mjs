import { createServer } from 'node:http'

const port = Number(process.env.PORT ?? 8787)
const reports = new Map()

const server = createServer((request, response) => {
  if (request.method !== 'POST' || request.url !== '/v1/experience-events') {
    response.writeHead(404, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'not found' }))
    return
  }
  let raw = ''
  request.setEncoding('utf8')
  request.on('data', chunk => { raw += chunk })
  request.on('end', () => {
    try {
      const event = JSON.parse(raw)
      if (event?.schemaVersion !== 1 || event?.type !== 'feedback.submitted') {
        throw new TypeError('unsupported event')
      }
      const plugin = event.trial?.plugin?.moduleName
      if (typeof plugin !== 'string' || plugin.length === 0) throw new TypeError('missing plugin')
      const version = typeof event.trial.plugin.version === 'string' ? event.trial.plugin.version : 'unknown'
      const key = `${plugin}#${version}`
      const similarReports = (reports.get(key) ?? 0) + 1
      reports.set(key, similarReports)
      const failed = event.feedback?.outcome === 'failed'
        || Number(event.signals?.toolErrors ?? 0) > 0
        || event.signals?.loaderHealth === 'failed'
        || event.signals?.loaderHealth === 'missing'
      const receipt = failed
        ? {
            receiptId: `demo-${event.eventId}`,
            status: 'clustered',
            similarReports,
            message: '演示诊断：这条反馈包含失败信号，建议固定同一任务和版本复测。',
          }
        : {
            receiptId: `demo-${event.eventId}`,
            status: 'received',
            similarReports,
            message: '演示诊断：已形成一条正向独立体验记录；建议用相似任务再验证一次。',
          }
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify(receipt))
      process.stdout.write(`${JSON.stringify({ plugin, version, eventId: event.eventId, similarReports })}\n`)
    } catch (error) {
      response.writeHead(400, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
    }
  })
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Plugin Lab demo ingest listening on http://127.0.0.1:${port}/v1/experience-events`)
})
