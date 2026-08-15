export interface RuntimeConfig {
  readonly databaseUrl: string
  readonly privacyHashSecret: string
  readonly followSecret: string
  readonly publicBaseUrl: string
  readonly adminToken: string
  readonly ingestToken?: string
  readonly githubToken?: string
  readonly githubRepository?: string
  readonly githubThreshold: number
  readonly port: number
}

function required(name: string): string {
  const value = process.env[name]
  if (value === undefined || value.length < 16) throw new Error(`${name} is required and must be at least 16 characters`)
  return value
}

export function loadConfig(): RuntimeConfig {
  const databaseUrl = process.env.DATABASE_URL
  const publicBaseUrl = process.env.PUBLIC_BASE_URL
  if (databaseUrl === undefined || databaseUrl.length === 0) throw new Error('DATABASE_URL is required')
  if (publicBaseUrl === undefined || !/^https?:\/\//u.test(publicBaseUrl)) throw new Error('PUBLIC_BASE_URL is required')
  const port = Number(process.env.PORT ?? 8787)
  const githubThreshold = Number(process.env.GITHUB_REPORT_THRESHOLD ?? 3)
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) throw new Error('PORT is invalid')
  if (!Number.isSafeInteger(githubThreshold) || githubThreshold < 1) throw new Error('GITHUB_REPORT_THRESHOLD is invalid')
  return {
    databaseUrl,
    privacyHashSecret: required('PRIVACY_HASH_SECRET'),
    followSecret: required('FOLLOW_SECRET'),
    publicBaseUrl,
    adminToken: required('ADMIN_TOKEN'),
    ...process.env.INGEST_TOKEN === undefined ? {} : { ingestToken: process.env.INGEST_TOKEN },
    ...process.env.GITHUB_TOKEN === undefined ? {} : { githubToken: process.env.GITHUB_TOKEN },
    ...process.env.GITHUB_REPOSITORY === undefined ? {} : { githubRepository: process.env.GITHUB_REPOSITORY },
    githubThreshold,
    port,
  }
}
