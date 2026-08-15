import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import pg from 'pg'

const databaseUrl = process.env.DATABASE_URL
if (databaseUrl === undefined) throw new Error('DATABASE_URL is required')
const directory = resolve(process.cwd(), 'server/migrations')
const migrations = (await readdir(directory)).filter(file => file.endsWith('.sql')).sort()
const pool = new pg.Pool({ connectionString: databaseUrl })
try {
  for (const migration of migrations) {
    await pool.query(await readFile(resolve(directory, migration), 'utf8'))
  }
  console.log(`database migration complete (${migrations.length} files)`)
} finally {
  await pool.end()
}
