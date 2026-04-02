import { test, expect } from '../helpers/console-capture'
import { createClient, createMatter, createFeeEntry } from '../helpers/api-factories'
import { TEST_CLIENT, TEST_MATTER, todayISO } from '../helpers/test-data'

const BASE = 'http://localhost:3001'

test.describe('US-025: Collections / Age Analysis', () => {
  let clientId: string
  let matterId: string
  let invoiceId: string

  test.beforeAll(async ({ request }) => {
    // Create client and matter
    const client = await createClient(request, {
      clientName: 'Collections Test Client',
      clientCode: 'CTC',
      emailGeneral: 'collections@test.co.za',
    })
    clientId = client.id

    const matter = await createMatter(request, {
      clientId,
      description: 'Collections test matter',
    })
    matterId = matter.id

    // Create fee entries to invoice
    const fee1 = await createFeeEntry(request, {
      matterId,
      narration: 'Overdue fee entry 1',
      billedMinutes: 120,
      rateCents: 200000,
    })

    const fee2 = await createFeeEntry(request, {
      matterId,
      narration: 'Overdue fee entry 2',
      billedMinutes: 60,
      rateCents: 200000,
    })

    // Create an invoice from the fee entries
    const invoiceDate = new Date()
    invoiceDate.setDate(invoiceDate.getDate() - 45) // 45 days ago for 31-60 bucket
    const invoiceDateStr = invoiceDate.toISOString().split('T')[0]

    const invoiceRes = await request.post(`${BASE}/api/invoices`, {
      data: {
        matterId,
        feeEntryIds: [fee1.id, fee2.id],
        invoiceType: 'invoice',
        invoiceDate: invoiceDateStr,
      },
    })
    const invoice = await invoiceRes.json()
    invoiceId = invoice.id

    // Transition invoice to sent so it appears in debtors
    await request.patch(`${BASE}/api/invoices/${invoiceId}`, {
      data: { action: 'transition', status: 'sent_invoice' },
    })
  })

  test('collections page loads at /collections', async ({ page }) => {
    await page.goto('/collections')
    await expect(page).toHaveURL(/\/collections$/)
    await expect(page.locator('h1')).toContainText('Collections')
  })

  test('KPI cards show totals for each age bucket', async ({ page }) => {
    await page.goto('/collections')

    // Wait for data to load (skeleton disappears)
    await page.waitForSelector('table.brand-table tbody tr', {
      timeout: 15000,
    })

    // Four KPI bucket cards should be visible
    await expect(page.getByText('0\u201330 days')).toBeVisible()
    await expect(page.getByText('31\u201360 days')).toBeVisible()
    await expect(page.getByText('61\u201390 days')).toBeVisible()
    await expect(page.getByText('90+ days')).toBeVisible()
  })

  test('client rows in table with expandable detail', async ({ page }) => {
    await page.goto('/collections')

    // Wait for table to load
    await page.waitForSelector('table.brand-table tbody tr', {
      timeout: 15000,
    })

    // Our test client should appear
    const clientRow = page.locator('tr', { hasText: 'Collections Test Client' })
    await expect(clientRow.first()).toBeVisible()

    // Click to expand
    await clientRow.first().click()

    // After expansion, the invoice detail rows should be visible
    await page.waitForTimeout(500)
    await expect(page.locator('body')).toContainText(/INV-\d+/)
  })

  test('invoice links navigate to invoice detail', async ({ page }) => {
    await page.goto('/collections')

    // Wait for table to load
    await page.waitForSelector('table.brand-table tbody tr', {
      timeout: 15000,
    })

    // Expand the client row
    const clientRow = page.locator('tr', { hasText: 'Collections Test Client' })
    await clientRow.first().click()

    // Find an invoice link in the expanded section
    const invoiceLink = page.locator(`a[href*="/invoices/"]`).first()
    await expect(invoiceLink).toBeVisible()

    // Click and verify navigation
    await invoiceLink.click()
    await expect(page).toHaveURL(/\/invoices\//)
  })
})
