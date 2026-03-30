import { test as setup, expect } from '@playwright/test'
import { execSync } from 'child_process'
import pg from 'pg'
import bcrypt from 'bcryptjs'

const TEST_DB = 'dcco_billing_test'
const TEST_DB_URL = `postgresql://yusufkajee@localhost:5432/${TEST_DB}`

setup('create test database and seed', async () => {
  // Connect to default postgres db to create test db
  const client = new pg.Client({ connectionString: 'postgresql://yusufkajee@localhost:5432/postgres' })
  await client.connect()

  // Drop and recreate for clean state
  await client.query(`DROP DATABASE IF EXISTS ${TEST_DB}`)
  await client.query(`CREATE DATABASE ${TEST_DB}`)
  await client.end()

  // Run migrations
  execSync('npx prisma migrate deploy', {
    cwd: '/Users/yusufkajee/Desktop/App Development/Development/dcco-billing',
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: 'pipe',
  })

  // Seed via the seed script
  execSync('npx tsx prisma/seed.ts', {
    cwd: '/Users/yusufkajee/Desktop/App Development/Development/dcco-billing',
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: 'pipe',
  })

  // Create fee_earner user
  const dbClient = new pg.Client({ connectionString: TEST_DB_URL })
  await dbClient.connect()
  const hash = await bcrypt.hash('Earner1234!', 12)
  await dbClient.query(
    `INSERT INTO users (id, email, password_hash, first_name, last_name, initials, role, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
     ON CONFLICT (email) DO NOTHING`,
    ['seed-fee-earner', 'earner@dcco.law', hash, 'Fee', 'Earner', 'FE', 'fee_earner']
  )
  await dbClient.end()
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
