import { test, expect } from '../helpers/console-capture'
import { request as playwrightRequest } from '@playwright/test'
import { createClient, createMatter, createTrustEntry } from '../helpers/api-factories'
import {
  ADMIN_STORAGE,
  FEE_EARNER_STORAGE,
  ASSISTANT_STORAGE,
} from '../helpers/auth'
import { uniqueCode, uniqueSuffix } from '../helpers/test-data'

const BASE = 'http://localhost:3001'

// ─── Shared setup (admin context) ─────────────────────────────────────────────
// Provision a client + matter + trust entry as admin so the non-admin tests
// have something real to bounce off.

let matterId: string

test.beforeAll(async () => {
  const adminCtx = await playwrightRequest.newContext({
    baseURL: BASE,
    storageState: ADMIN_STORAGE,
  })

  try {
    const suffix = uniqueSuffix()
    const client = await createClient(adminCtx, {
      clientName: `Trust Admin Only ${suffix}`,
      clientCode: uniqueCode('TAO'),
    })
    const matter = await createMatter(adminCtx, {
      clientId: client.id,
      description: `Trust admin-only matter ${suffix}`,
      ownerId: 'seed-fee-earner', // assigned to fee earner so per-matter access is allowed
    })
    matterId = matter.id

    await createTrustEntry(adminCtx, {
      matterId,
      entryType: 'trust_receipt',
      amountCents: 5000000,
      narration: 'Setup deposit',
    })
  } finally {
    await adminCtx.dispose()
  }
})

// ─── Admin ────────────────────────────────────────────────────────────────────

test.describe('Trust access — admin', () => {
  test.use({ storageState: ADMIN_STORAGE })

  test('admin can load /trust', async ({ page }) => {
    await page.goto('/trust')
    await expect(page).toHaveURL(/\/trust(\?|$)/)
    await expect(page.locator('body')).toContainText('Trust Register')
  })

  test('admin GET /api/trust-register returns 200', async ({ request }) => {
    const res = await request.get(`${BASE}/api/trust-register`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.matters)).toBe(true)
  })

  test('admin GET /api/trust-entries (firm-wide) returns 200', async ({ request }) => {
    const res = await request.get(`${BASE}/api/trust-entries?limit=10`)
    expect(res.status()).toBe(200)
    expect(Array.isArray(await res.json())).toBe(true)
  })

  test('admin sidebar shows Trust Account link', async ({ page }) => {
    await page.goto('/dashboard')
    const link = page.getByRole('link', { name: 'Trust Account' })
    await expect(link).toBeVisible()
  })

  test('admin Reports view lists Trust Register report', async ({ page }) => {
    await page.goto('/reports')
    await expect(page.getByText(/^Trust Register$/).first()).toBeVisible()
  })
})

// ─── Fee earner ───────────────────────────────────────────────────────────────

test.describe('Trust access — fee earner', () => {
  test.use({ storageState: FEE_EARNER_STORAGE })

  test('fee earner is redirected from /trust to /dashboard', async ({ page }) => {
    await page.goto('/trust')
    await expect(page).toHaveURL(/\/dashboard(\?|$)/)
  })

  test('fee earner GET /api/trust-register returns 403', async ({ request }) => {
    const res = await request.get(`${BASE}/api/trust-register`)
    expect(res.status()).toBe(403)
  })

  test('fee earner GET /api/trust-entries (no matterId) returns 403', async ({ request }) => {
    const res = await request.get(`${BASE}/api/trust-entries?limit=10`)
    expect(res.status()).toBe(403)
  })

  test('fee earner GET /api/trust-entries?matterId=... still works', async ({ request }) => {
    const res = await request.get(`${BASE}/api/trust-entries?matterId=${matterId}`)
    expect(res.status()).toBe(200)
    const entries = await res.json()
    expect(Array.isArray(entries)).toBe(true)
    expect(entries.length).toBeGreaterThan(0)
  })

  test('fee earner sidebar hides Trust Account link', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByRole('link', { name: 'Trust Account' })).toHaveCount(0)
  })

  test('fee earner Reports view does not list Trust Register report', async ({ page }) => {
    await page.goto('/reports')
    await expect(page.getByText(/^Trust Register$/)).toHaveCount(0)
  })
})

// ─── Assistant ────────────────────────────────────────────────────────────────

test.describe('Trust access — assistant', () => {
  test.use({ storageState: ASSISTANT_STORAGE })

  test('assistant is redirected from /trust to /dashboard', async ({ page }) => {
    await page.goto('/trust')
    await expect(page).toHaveURL(/\/dashboard(\?|$)/)
  })

  test('assistant GET /api/trust-register returns 403', async ({ request }) => {
    const res = await request.get(`${BASE}/api/trust-register`)
    expect(res.status()).toBe(403)
  })

  test('assistant GET /api/trust-entries (no matterId) returns 403', async ({ request }) => {
    const res = await request.get(`${BASE}/api/trust-entries?limit=10`)
    expect(res.status()).toBe(403)
  })

  test('assistant sidebar hides Trust Account link', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByRole('link', { name: 'Trust Account' })).toHaveCount(0)
  })
})
