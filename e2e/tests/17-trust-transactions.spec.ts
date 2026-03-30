import { test, expect } from '@playwright/test'
import {
  createClient,
  createMatter,
  createTrustEntry,
} from '../helpers/api-factories'
import { TEST_CLIENT, TEST_MATTER, TEST_MATTER_2, todayISO } from '../helpers/test-data'

const BASE = 'http://localhost:3001'

test.describe('US-017: Trust Transactions', () => {
  let clientId: string
  let matter1Id: string
  let matter2Id: string

  test.beforeAll(async ({ request }) => {
    const client = await createClient(request, {
      ...TEST_CLIENT,
      clientCode: 'TRU',
      clientName: 'Trust Transaction Client (Pty) Ltd',
    })
    clientId = client.id

    const matter1 = await createMatter(request, {
      clientId,
      description: 'Trust test matter 1',
    })
    matter1Id = matter1.id

    const matter2 = await createMatter(request, {
      clientId,
      description: 'Trust test matter 2',
    })
    matter2Id = matter2.id
  })

  test('trust page loads at /trust', async ({ page }) => {
    await page.goto('/trust')
    await expect(page.locator('h1')).toContainText('Trust Account')
  })

  test('trust page shows Trust Register and Recent Entries tabs', async ({ page }) => {
    await page.goto('/trust')
    await expect(page.locator('body')).toContainText('Trust Register')
    await expect(page.locator('body')).toContainText('Recent Entries')
  })

  test('trust page shows Inter-Matter Transfer button', async ({ page }) => {
    await page.goto('/trust')
    const transferBtn = page.getByRole('button', { name: /inter-matter transfer/i })
    await expect(transferBtn).toBeVisible()
  })

  test('create trust receipt via API, verify it appears', async ({ request, page }) => {
    const receipt = await createTrustEntry(request, {
      matterId: matter1Id,
      entryType: 'trust_receipt',
      amountCents: 5000000,
      narration: 'Trust deposit for matter 1',
    })
    expect(receipt.id).toBeTruthy()
    expect(receipt.entryType).toBe('trust_receipt')

    // Verify on the trust page journal tab
    await page.goto('/trust')

    // Click Recent Entries tab
    const journalTab = page.getByRole('button', { name: /recent entries/i })
    await journalTab.click()

    await expect(page.locator('body')).toContainText('Trust deposit for matter 1')
  })

  test('trust balance updates after receipt', async ({ request }) => {
    // Check trust register
    const res = await request.get(`${BASE}/api/trust-register`)
    expect(res.ok()).toBeTruthy()
    const register = await res.json()

    const matterRow = register.matters.find(
      (m: { matterId: string }) => m.matterId === matter1Id,
    )
    expect(matterRow).toBeTruthy()
    expect(matterRow.balanceCents).toBeGreaterThan(0)
  })

  test('create trust payment, verify balance decreases', async ({ request }) => {
    // Get current balance
    const beforeRes = await request.get(`${BASE}/api/trust-register`)
    const beforeRegister = await beforeRes.json()
    const beforeBalance = beforeRegister.matters.find(
      (m: { matterId: string }) => m.matterId === matter1Id,
    )?.balanceCents ?? 0

    // Create a trust payment
    const payment = await createTrustEntry(request, {
      matterId: matter1Id,
      entryType: 'trust_payment',
      amountCents: 1000000,
      narration: 'Trust payment for services',
    })
    expect(payment.id).toBeTruthy()
    expect(payment.entryType).toBe('trust_payment')

    // Check balance decreased
    const afterRes = await request.get(`${BASE}/api/trust-register`)
    const afterRegister = await afterRes.json()
    const afterBalance = afterRegister.matters.find(
      (m: { matterId: string }) => m.matterId === matter1Id,
    )?.balanceCents ?? 0

    expect(afterBalance).toBe(beforeBalance - 1000000)
  })

  test('inter-matter transfer creates paired entries', async ({ request }) => {
    // Fund matter 1 first (it may already have funds from previous tests)
    await createTrustEntry(request, {
      matterId: matter1Id,
      entryType: 'trust_receipt',
      amountCents: 2000000,
      narration: 'Pre-transfer funding',
    })

    // Perform inter-matter transfer
    const res = await request.post(`${BASE}/api/trust-entries/transfer`, {
      data: {
        fromMatterId: matter1Id,
        toMatterId: matter2Id,
        entryDate: todayISO(),
        amountCents: 1000000,
        narration: 'Inter-matter transfer test',
      },
    })
    expect(res.ok()).toBeTruthy()
    const { outEntry, inEntry } = await res.json()

    // Verify paired entries
    expect(outEntry.entryType).toBe('trust_transfer_out')
    expect(outEntry.matterId).toBe(matter1Id)
    expect(outEntry.amountCents).toBe(1000000)

    expect(inEntry.entryType).toBe('trust_transfer_in')
    expect(inEntry.matterId).toBe(matter2Id)
    expect(inEntry.amountCents).toBe(1000000)
  })

  test('trust-to-business transfer (admin only)', async ({ request }) => {
    // Fund matter 1
    await createTrustEntry(request, {
      matterId: matter1Id,
      entryType: 'trust_receipt',
      amountCents: 3000000,
      narration: 'Funding for trust-to-business transfer',
    })

    const res = await request.post(`${BASE}/api/bookkeeping/trust-to-business`, {
      data: {
        matterId: matter1Id,
        entryDate: todayISO(),
        amountCents: 500000,
        narration: 'Trust to business transfer',
      },
    })
    expect(res.ok()).toBeTruthy()
    const { trustEntry, businessEntry } = await res.json()

    expect(trustEntry.entryType).toBe('trust_transfer_out')
    expect(trustEntry.amountCents).toBe(500000)

    expect(businessEntry.entryType).toBe('trust_to_business')
    expect(businessEntry.amountCents).toBe(500000)
  })
})
