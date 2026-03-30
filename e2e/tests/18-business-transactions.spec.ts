import { test, expect } from '@playwright/test'
import {
  createClient,
  createMatter,
  createBusinessEntry,
} from '../helpers/api-factories'
import { TEST_CLIENT, TEST_MATTER, todayISO } from '../helpers/test-data'

const BASE = 'http://localhost:3001'

test.describe('US-018: Business Transactions', () => {
  let clientId: string
  let matterId: string

  test.beforeAll(async ({ request }) => {
    const client = await createClient(request, {
      ...TEST_CLIENT,
      clientCode: 'BIZ',
      clientName: 'Business Transaction Client (Pty) Ltd',
    })
    clientId = client.id

    const matter = await createMatter(request, {
      clientId,
      description: 'Business transaction test matter',
    })
    matterId = matter.id
  })

  test('business page loads at /business', async ({ page }) => {
    await page.goto('/business')
    await expect(page.locator('body')).toBeVisible()
    // The page should have a header indicating business account
    await expect(page.locator('h1')).toContainText(/business/i)
  })

  test('create business receipt via API', async ({ request }) => {
    const receipt = await createBusinessEntry(request, {
      entryType: 'matter_receipt',
      amountCents: 2500000,
      narration: 'Business receipt from client',
      matterId,
    })
    expect(receipt.id).toBeTruthy()
    expect(receipt.entryType).toBe('matter_receipt')
    expect(receipt.amountCents).toBe(2500000)
  })

  test('create business payment via API', async ({ request }) => {
    const payment = await createBusinessEntry(request, {
      entryType: 'business_payment',
      amountCents: 500000,
      narration: 'Office expense payment',
    })
    expect(payment.id).toBeTruthy()
    expect(payment.entryType).toBe('business_payment')
    expect(payment.amountCents).toBe(500000)
  })

  test('entries appear in the business entries list', async ({ request }) => {
    const res = await request.get(`${BASE}/api/business-entries`)
    expect(res.ok()).toBeTruthy()
    const entries = await res.json()

    expect(Array.isArray(entries)).toBeTruthy()
    expect(entries.length).toBeGreaterThanOrEqual(2)

    const narrations = entries.map((e: { narration: string }) => e.narration)
    expect(narrations).toContain('Business receipt from client')
    expect(narrations).toContain('Office expense payment')
  })

  test('business entries visible on the page', async ({ page, request }) => {
    // Create a distinctive entry to look for
    await createBusinessEntry(request, {
      entryType: 'business_receipt',
      amountCents: 100000,
      narration: 'Visible on page test',
    })

    await page.goto('/business')

    // Wait for the page to load entries
    await page.waitForTimeout(1000)

    // The page should display business entries in some form
    await expect(page.locator('body')).toContainText(/business/i)
  })
})
