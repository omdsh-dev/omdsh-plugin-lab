import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import pg from 'pg'

const databaseUrl = process.env.DATABASE_URL
if (databaseUrl === undefined) throw new Error('DATABASE_URL is required')
const sql = await readFile(resolve(process.cwd(), 'server/migrations/001_initial.sql'), 'utf8')
const pool = new pg.Pool({ connectionString: databaseUrl })
try {
  await pool.query(sql)
  console.log('database migration complete')
} finally {
  await pool.end()
}
