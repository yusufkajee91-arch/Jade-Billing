import { test as setup, expect } from '@playwright/test'
import { execSync } from 'child_process'
import pg from 'pg'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
import os from 'os'
import path from 'path'

dotenv.config({ path: process.env.E2E_ENV_FILE ?? '.env.test' })
setup.setTimeout(120_000)

const dbStrategy = process.env.E2E_DB_STRATEGY ?? 'reset-local'
const defaultTestDb = 'dcco_billing_test'
const databaseUrl = process.env.DATABASE_URL ?? `postgresql://yusufkajee@localhost:5432/${defaultTestDb}`
const adminDatabaseUrl = process.env.E2E_ADMIN_DATABASE_URL ?? 'postgresql://yusufkajee@localhost:5432/postgres'
const migrationDatabaseUrl = process.env.E2E_MIGRATION_DATABASE_URL ?? databaseUrl
const schemaBootstrap =
  process.env.E2E_SCHEMA_BOOTSTRAP ?? (databaseUrl.includes('pgbouncer=true') ? 'sql-diff' : 'migrate')
const runMigrations = process.env.E2E_RUN_MIGRATIONS !== 'false'
const runSeed = process.env.E2E_RUN_SEED !== 'false'

function quoted(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

async function ensureSupportUsers(connectionString: string) {
  const dbClient = new pg.Client({ connectionString })
  await dbClient.connect()

  const feeEarnerHash = await bcrypt.hash('Earner1234!', 12)
  await dbClient.query(
    `INSERT INTO users (id, email, password_hash, first_name, last_name, initials, role, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
     ON CONFLICT (email) DO NOTHING`,
    ['seed-fee-earner', 'earner@dcco.law', feeEarnerHash, 'Fee', 'Earner', 'FE', 'fee_earner']
  )

  const assistantHash = await bcrypt.hash('Assist1234!', 12)
  await dbClient.query(
    `INSERT INTO users (id, email, password_hash, first_name, last_name, initials, role, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
     ON CONFLICT (email) DO NOTHING`,
    ['seed-assistant', 'assistant@dcco.law', assistantHash, 'Office', 'Assistant', 'OA', 'assistant']
  )

  await dbClient.end()
}

async function resetExistingDatabase(connectionString: string) {
  const dbClient = new pg.Client({ connectionString })
  await dbClient.connect()

  await dbClient.query('DROP SCHEMA IF EXISTS public CASCADE')
  await dbClient.query('CREATE SCHEMA public')
  await dbClient.query('GRANT ALL ON SCHEMA public TO postgres')
  await dbClient.query('GRANT ALL ON SCHEMA public TO public')

  await dbClient.end()
}

function applySchemaWithSqlDiff(connectionString: string) {
  const sqlFile = path.join(os.tmpdir(), 'dcco-e2e-schema.sql')
  const sqlDatabaseUrl = new URL(connectionString)
  sqlDatabaseUrl.search = ''

  execSync(`npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script --output "${sqlFile}"`, {
    cwd: '/Users/yusufkajee/Desktop/App Development/Development/dcco-billing',
    env: {
      ...process.env,
      DATABASE_URL: migrationDatabaseUrl,
      DOTENV_CONFIG_QUIET: 'true',
    },
    stdio: 'pipe',
  })

  execSync(`psql "$E2E_SQL_DATABASE_URL" -v ON_ERROR_STOP=1 -f "${sqlFile}"`, {
    cwd: '/Users/yusufkajee/Desktop/App Development/Development/dcco-billing',
    env: {
      ...process.env,
      E2E_SQL_DATABASE_URL: sqlDatabaseUrl.toString(),
    },
    stdio: 'pipe',
    shell: '/bin/zsh',
  })
}

setup('create test database and seed', async () => {
  if (dbStrategy === 'reset-local') {
    const dbName = process.env.E2E_TEST_DB_NAME ?? defaultTestDb
    const client = new pg.Client({ connectionString: adminDatabaseUrl })
    await client.connect()
    await client.query(`DROP DATABASE IF EXISTS ${quoted(dbName)}`)
    await client.query(`CREATE DATABASE ${quoted(dbName)}`)
    await client.end()
  }

  if (dbStrategy === 'reset-existing') {
    await resetExistingDatabase(databaseUrl)
  }

  if (runMigrations) {
    if (schemaBootstrap === 'sql-diff') {
      applySchemaWithSqlDiff(databaseUrl)
    } else {
      execSync('npx prisma migrate deploy', {
        cwd: '/Users/yusufkajee/Desktop/App Development/Development/dcco-billing',
        env: { ...process.env, DATABASE_URL: migrationDatabaseUrl },
        stdio: 'pipe',
      })
    }
  }

  if (runSeed) {
    execSync('npx tsx prisma/seed.ts', {
      cwd: '/Users/yusufkajee/Desktop/App Development/Development/dcco-billing',
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    })
  }

  await ensureSupportUsers(databaseUrl)
})

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('admin@dcco.law')
  await page.getByLabel('Password').fill('Admin1234!')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL('**/dashboard')
  await page.context().storageState({ path: 'e2e/.auth/admin.json' })
})

setup('authenticate as fee earner', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('earner@dcco.law')
  await page.getByLabel('Password').fill('Earner1234!')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL('**/dashboard')
  await page.context().storageState({ path: 'e2e/.auth/fee-earner.json' })
})

setup('authenticate as assistant', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('assistant@dcco.law')
  await page.getByLabel('Password').fill('Assist1234!')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL('**/dashboard')
  await page.context().storageState({ path: 'e2e/.auth/assistant.json' })
})
