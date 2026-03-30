import { test, expect } from '@playwright/test'
import {
  createClient,
  createMatter,
  createFeeEntry,
  createBusinessEntry,
} from '../helpers/api-factories'
import { todayISO } from '../helpers/test-data'

const BASE = 'http://localhost:3001'

test.describe('US-023: Client Statements', () => {
  let clientId: string
  let matterId: string
  let invoiceId: string

  test.beforeAll(async ({ request }) => {
    const client = await createClient(request, {
      clientName: 'Statement Client (Pty) Ltd',
      clientCode: 'STM',
      entityType: 'company_pty',
      emailGeneral: 'statement@example.com',
    })
    clientId = client.id

    const matter = await createMatter(request, {
      clientId,
      description: 'Statement test matter',
    })
    matterId = matter.id

    // Create fee entry and invoice
    const entry = await createFeeEntry(request, {
      matterId,
      narration: 'Statement test work',
      billedMinutes: 120,
      rateCents: 200000,
    })

    const invRes = await request.post(`${BASE}/api/invoices`, {
      data: {
        matterId,
        feeEntryIds: [entry.id],
        invoiceType: 'invoice',
        invoiceDate: todayISO(),
      },
    })
    expect(invRes.ok()).toBeTruthy()
    const invoice = await invRes.json()
    invoiceId = invoice.id

    // Transition invoice to sent so it appears on statement
    await request.patch(`${BASE}/api/invoices/${invoiceId}`, {
      data: { action: 'transition', status: 'sent_invoice' },
    })

    // Create a business receipt (payment) for the client
    await createBusinessEntry(request, {
      entryType: 'matter_receipt',
      amountCents: 1500000,
      narration: 'Payment received from Statement Client',
      matterId,
    })
  })

  test('navigate to client detail page', async ({ page }) => {
    await page.goto(`/clients/${clientId}`)
    await expect(page.locator('body')).toContainText('Statement Client')
  })

  test('statement tab exists on client detail page', async ({ page }) => {
    await page.goto(`/clients/${clientId}`)

    // Look for the Statement tab (exact match to avoid matching "Load Statement" button)
    const statementTab = page.getByRole('button', { name: /^statement$/i })
    await expect(statementTab).toBeVisible()
  })

  test('statement shows invoices and payments via API', async ({ request }) => {
    const res = await request.get(`${BASE}/api/clients/${clientId}/statement`)
    expect(res.ok()).toBeTruthy()
    const data = await res.json()

    expect(data.client).toBeTruthy()
    expect(data.client.clientName).toBe('Statement Client (Pty) Ltd')

    expect(data.entries).toBeTruthy()
    expect(Array.isArray(data.entries)).toBeTruthy()

    // Should have at least 1 invoice entry and 1 receipt entry
    const invoiceEntries = data.entries.filter(
      (e: { type: string }) => e.type === 'invoice',
    )
    const receiptEntries = data.entries.filter(
      (e: { type: string }) => e.type === 'receipt',
    )

    expect(invoiceEntries.length).toBeGreaterThanOrEqual(1)
    expect(receiptEntries.length).toBeGreaterThanOrEqual(1)

    // Invoice entries should have debit amounts
    expect(invoiceEntries[0].debitCents).toBeGreaterThan(0)
    expect(invoiceEntries[0].creditCents).toBe(0)

    // Receipt entries should have credit amounts
    expect(receiptEntries[0].creditCents).toBeGreaterThan(0)
    expect(receiptEntries[0].debitCents).toBe(0)
  })

  test('running balance calculates correctly', async ({ request }) => {
    const res = await request.get(`${BASE}/api/clients/${clientId}/statement`)
    const data = await res.json()

    // Verify running balance is correct
    let runningBalance = 0
    for (const entry of data.entries) {
      runningBalance += entry.debitCents - entry.creditCents
      expect(entry.balanceCents).toBe(runningBalance)
    }

    // Closing balance should match last entry balance
    if (data.entries.length > 0) {
      const lastEntry = data.entries[data.entries.length - 1]
      expect(data.totals.closingBalanceCents).toBe(lastEntry.balanceCents)
    }

    // Totals should be correct
    expect(data.totals.closingBalanceCents).toBe(
      data.totals.debitCents - data.totals.creditCents,
    )
  })

  test('statement tab shows data on client page', async ({ page }) => {
    await page.goto(`/clients/${clientId}?tab=statement`)

    // Click the statement tab (exact match to avoid matching "Load Statement")
    const statementTab = page.getByRole('button', { name: /^statement$/i })
    await statementTab.click()

    // Click Load Statement button
    const loadBtn = page.getByRole('button', { name: /load statement/i })
    await expect(loadBtn).toBeVisible()
    await loadBtn.click()

    // Wait for statement data to load
    await page.waitForTimeout(2000)

    // Should show invoice and payment data
    await expect(page.locator('body')).toContainText('Statement test matter')
  })

  test('statement date range filter works via API', async ({ request }) => {
    const today = todayISO()
    const res = await request.get(
      `${BASE}/api/clients/${clientId}/statement?from=${today}&to=${today}`,
    )
    expect(res.ok()).toBeTruthy()
    const data = await res.json()

    // Should only include entries from today
    expect(data.entries).toBeTruthy()
    for (const entry of data.entries) {
      expect(entry.date).toBe(today)
    }
  })
})
