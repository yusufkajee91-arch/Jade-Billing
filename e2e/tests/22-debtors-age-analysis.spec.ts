import { test, expect } from '../helpers/console-capture'
import {
  createClient,
  createMatter,
  createFeeEntry,
} from '../helpers/api-factories'
import { todayISO } from '../helpers/test-data'

const BASE = 'http://localhost:3001'

test.describe('US-022: Debtors Age Analysis', () => {
  let clientId: string
  let matterId: string

  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000)
    const client = await createClient(request, {
      clientName: 'Debtors Test Client (Pty) Ltd',
      clientCode: 'DBT',
      entityType: 'company_pty',
      emailGeneral: 'debtors@example.com',
    })
    clientId = client.id

    const matter = await createMatter(request, {
      clientId,
      description: 'Debtors age analysis test',
    })
    matterId = matter.id

    // Create and invoice entries with different dates to get entries in different age buckets

    // Current invoice (today)
    const currentEntry = await createFeeEntry(request, {
      matterId,
      narration: 'Current period work',
      billedMinutes: 60,
      rateCents: 200000,
    })
    const currentInvRes = await request.post(`${BASE}/api/invoices`, {
      data: {
        matterId,
        feeEntryIds: [currentEntry.id],
        invoiceType: 'invoice',
        invoiceDate: todayISO(),
      },
    })
    expect(currentInvRes.ok()).toBeTruthy()
    const currentInv = await currentInvRes.json()

    // Transition to sent_invoice so it appears in debtors
    await request.patch(`${BASE}/api/invoices/${currentInv.id}`, {
      data: { action: 'transition', status: 'sent_invoice' },
    })

    // Overdue invoice (45 days ago)
    const overdueEntry = await createFeeEntry(request, {
      matterId,
      narration: 'Overdue period work',
      billedMinutes: 120,
      rateCents: 200000,
    })
    const overdueDate = new Date()
    overdueDate.setDate(overdueDate.getDate() - 45)
    const overdueISO = overdueDate.toISOString().split('T')[0]

    const overdueInvRes = await request.post(`${BASE}/api/invoices`, {
      data: {
        matterId,
        feeEntryIds: [overdueEntry.id],
        invoiceType: 'invoice',
        invoiceDate: overdueISO,
      },
    })
    expect(overdueInvRes.ok()).toBeTruthy()
    const overdueInv = await overdueInvRes.json()

    await request.patch(`${BASE}/api/invoices/${overdueInv.id}`, {
      data: { action: 'transition', status: 'sent_invoice' },
    })

    // Very overdue invoice (100 days ago)
    const veryOverdueEntry = await createFeeEntry(request, {
      matterId,
      narration: 'Very overdue work',
      billedMinutes: 90,
      rateCents: 200000,
    })
    const veryOverdueDate = new Date()
    veryOverdueDate.setDate(veryOverdueDate.getDate() - 100)
    const veryOverdueISO = veryOverdueDate.toISOString().split('T')[0]

    const veryOverdueInvRes = await request.post(`${BASE}/api/invoices`, {
      data: {
        matterId,
        feeEntryIds: [veryOverdueEntry.id],
        invoiceType: 'invoice',
        invoiceDate: veryOverdueISO,
      },
    })
    expect(veryOverdueInvRes.ok()).toBeTruthy()
    const veryOverdueInv = await veryOverdueInvRes.json()

    await request.patch(`${BASE}/api/invoices/${veryOverdueInv.id}`, {
      data: { action: 'transition', status: 'sent_invoice' },
    })
  })

  test('debtors page loads at /debtors', async ({ page }) => {
    await page.goto('/debtors')
    await expect(page.locator('body')).toBeVisible()
    // Should show debtors-related content
    await expect(page.locator('body')).toContainText(/debtor/i)
  })

  test('age analysis table shows clients with outstanding invoices', async ({ request }) => {
    const res = await request.get(`${BASE}/api/debtors`)
    expect(res.ok()).toBeTruthy()
    const data = await res.json()

    expect(data.debtors).toBeTruthy()
    expect(Array.isArray(data.debtors)).toBeTruthy()

    const testDebtor = data.debtors.find(
      (d: { clientId: string }) => d.clientId === clientId,
    )
    expect(testDebtor).toBeTruthy()
    expect(testDebtor.clientName).toBe('Debtors Test Client (Pty) Ltd')
    expect(testDebtor.invoices.length).toBeGreaterThanOrEqual(3)
  })

  test('age buckets (0-30, 31-60, 61-90, 90+) display correctly', async ({ request }) => {
    const res = await request.get(`${BASE}/api/debtors`)
    const data = await res.json()

    const testDebtor = data.debtors.find(
      (d: { clientId: string }) => d.clientId === clientId,
    )
    expect(testDebtor).toBeTruthy()

    // Current (0-30) should have the today's invoice
    expect(testDebtor.currentCents).toBeGreaterThan(0)

    // 31-60 bucket should have the 45-day-old invoice
    expect(testDebtor.thirtyCents).toBeGreaterThan(0)

    // 90+ bucket should have the 100-day-old invoice
    expect(testDebtor.ninetyCents).toBeGreaterThan(0)

    // Total should be sum of all buckets
    const sum =
      testDebtor.currentCents +
      testDebtor.thirtyCents +
      testDebtor.sixtyCents +
      testDebtor.ninetyCents
    expect(testDebtor.totalCents).toBe(sum)
  })

  test('expandable rows show individual invoices on UI', async ({ page }) => {
    await page.goto('/debtors')

    // Wait for data to load
    await expect(page.locator('body')).toContainText('Debtors Test Client', {
      timeout: 10000,
    })

    // Click on the client row to expand it
    const clientRow = page.locator('tr', {
      hasText: 'Debtors Test Client',
    })
    await clientRow.first().click()

    // After expansion, invoice details should be visible
    await page.waitForTimeout(500)
    // The expanded rows should show invoice numbers
    await expect(page.locator('body')).toContainText(/INV-\d+/)
  })

  test('grand total row present', async ({ request }) => {
    const res = await request.get(`${BASE}/api/debtors`)
    const data = await res.json()

    expect(data.grandTotal).toBeDefined()
    expect(data.grandTotal).toBeGreaterThan(0)

    // Grand total should equal sum of all debtor totals
    const sum = data.debtors.reduce(
      (s: number, d: { totalCents: number }) => s + d.totalCents,
      0,
    )
    expect(data.grandTotal).toBe(sum)
  })
})
