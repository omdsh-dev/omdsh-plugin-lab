import { createServer } from 'node:http'
import pg from 'pg'
import { loadConfig } from './config.js'
import { GitHubIssuePublisher } from './github.js'
import { createHandler } from './http.js'
import { PostgresRepository } from './postgres.js'
import { FeedbackService } from './service.js'

const config = loadConfig()
const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 })
const repository = new PostgresRepository(pool)
const publisher = config.githubToken !== undefined && config.githubRepository !== undefined
  ? new GitHubIssuePublisher(config.githubToken, config.githubRepository)
  : undefined
const service = new FeedbackService(repository, {
  privacyHashSecret: config.privacyHashSecret,
  followSecret: config.followSecret,
  publicBaseUrl: config.publicBaseUrl,
  githubThreshold: config.githubThreshold,
}, publisher)
const server = createServer(createHandler(service, {
  adminToken: config.adminToken,
  ...config.ingestToken === undefined ? {} : { ingestToken: config.ingestToken },
}))

server.listen(config.port, '0.0.0.0', () => {
  console.log(`omdsh-plugin-lab server listening on :${config.port}`)
})

async function shutdown(): Promise<void> {
  await new Promise<void>(resolve => server.close(() => resolve()))
  await pool.end()
}

process.once('SIGINT', () => { void shutdown().finally(() => process.exit(0)) })
process.once('SIGTERM', () => { void shutdown().finally(() => process.exit(0)) })
