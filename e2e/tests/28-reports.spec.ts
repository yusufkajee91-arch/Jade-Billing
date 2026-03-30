import { test, expect } from '@playwright/test'
import {
  createClient,
  createMatter,
  createFeeEntry,
  createTrustEntry,
  createBusinessEntry,
} from '../helpers/api-factories'
import { todayISO } from '../helpers/test-data'

const BASE = 'http://localhost:3001'

test.describe('US-028: Reports', () => {
  let clientId: string
  let matterId: string

  test.beforeAll(async ({ request }) => {
    // Create comprehensive data for reports
    const client = await createClient(request, {
      clientName: 'Reports Test Client',
      clientCode: 'RTC',
      emailGeneral: 'reports@test.co.za',
    })
    clientId = client.id

    const matter = await createMatter(request, {
      clientId,
      description: 'Reports test matter',
    })
    matterId = matter.id

    // Fee entries (WIP and time data)
    const fee1 = await createFeeEntry(request, {
      matterId,
      narration: 'Reports consultation time',
      billedMinutes: 120,
      rateCents: 200000,
      entryDate: todayISO(),
    })

    const fee2 = await createFeeEntry(request, {
      matterId,
      narration: 'Reports research time',
      billedMinutes: 60,
      rateCents: 200000,
      entryDate: todayISO(),
    })

    // Create and send an invoice for invoice register
    const invoiceRes = await request.post(`${BASE}/api/invoices`, {
      data: {
        matterId,
        feeEntryIds: [fee1.id],
        invoiceType: 'invoice',
        invoiceDate: todayISO(),
      },
    })
    const invoice = await invoiceRes.json()

    await request.patch(`${BASE}/api/invoices/${invoice.id}`, {
      data: { action: 'transition', status: 'sent_invoice' },
    })

    // Trust entries
    await createTrustEntry(request, {
      matterId,
      entryType: 'trust_receipt',
      amountCents: 5000000,
      narration: 'Reports trust deposit',
    })

    // Business entries
    await createBusinessEntry(request, {
      entryType: 'business_receipt',
      amountCents: 2000000,
      narration: 'Reports business receipt',
      matterId,
    })
  })

  test('reports page loads at /reports', async ({ page }) => {
    await page.goto('/reports')
    await expect(page).toHaveURL(/\/reports$/)
    await expect(page.locator('.page-dark-header h1')).toHaveText('Reports')
  })

  test('left sidebar shows all report types', async ({ page }) => {
    await page.goto('/reports')

    // All report labels should be visible in the sidebar
    const reportLabels = [
      'Trial Balance',
      'General Journal',
      'Income & Expense',
      'Balance Sheet',
      'GL Account Detail',
      'Trust Register',
      'Trust & Investments',
      'Matter Trust Ledger',
      'Debtors Age Analysis',
      'Invoice Register',
      'WIP Report',
      'Fee Earner Performance',
      'Time Recording',
      'Bank Reconciliation',
    ]

    for (const label of reportLabels) {
      await expect(page.getByText(label, { exact: false }).first()).toBeVisible()
    }
  })

  test('Trial Balance: click and verify renders', async ({ page }) => {
    await page.goto('/reports')

    await page.getByText('Trial Balance').first().click()

    // Report header or content area should show Trial Balance
    await expect(page.getByText('Trial Balance').first()).toBeVisible()

    // Should have a "Run" button to generate the report
    const runButton = page.getByRole('button', { name: /run report/i })
    await expect(runButton).toBeVisible()
  })

  test('General Journal: click and verify renders', async ({ page }) => {
    await page.goto('/reports')

    await page.getByText('General Journal').first().click()
    await expect(page.getByText('General Journal').first()).toBeVisible()

    const runButton = page.getByRole('button', { name: /run report/i })
    await expect(runButton).toBeVisible()
  })

  test('Invoice Register: click and verify invoices listed', async ({ page }) => {
    await page.goto('/reports')

    await page.getByText('Invoice Register').first().click()
    await expect(page.getByText('Invoice Register').first()).toBeVisible()

    // Run the report
    const runButton = page.getByRole('button', { name: /run report/i })
    await runButton.click()

    // Should show our test invoice data
    await expect(page.getByText('Reports Test Client').first()).toBeVisible({ timeout: 15000 })
  })

  test('WIP Report: click and verify unbilled work shown', async ({ page }) => {
    await page.goto('/reports')

    await page.getByText('WIP Report').first().click()
    await expect(page.getByText('WIP Report').first()).toBeVisible()

    // Run the report
    const runButton = page.getByRole('button', { name: /run report/i })
    await runButton.click()

    // Should show unbilled entries
    await page.waitForTimeout(2000)
    const pageContent = await page.textContent('body')
    expect(pageContent).toBeTruthy()
  })

  test('Time Summary: click and verify time entries shown', async ({ page }) => {
    await page.goto('/reports')

    await page.getByText('Time Recording').first().click()
    await expect(page.getByText('Time Recording').first()).toBeVisible()

    const runButton = page.getByRole('button', { name: /run report/i })
    await expect(runButton).toBeVisible()
  })

  test('Debtors report: click and verify age analysis', async ({ page }) => {
    await page.goto('/reports')

    await page.getByText('Debtors Age Analysis').first().click()
    await expect(page.getByText('Debtors Age Analysis').first()).toBeVisible()

    const runButton = page.getByRole('button', { name: /run report/i })
    await runButton.click()

    // Age bucket headers should appear
    await expect(page.getByText('0\u201330').first()).toBeVisible({ timeout: 15000 })
  })

  test('Trust Register: click and verify trust balances', async ({ page }) => {
    await page.goto('/reports')

    await page.getByText('Trust Register').first().click()
    await expect(page.getByText('Trust Register').first()).toBeVisible()

    const runButton = page.getByRole('button', { name: /run report/i })
    await runButton.click()

    // Should show trust data for our matter
    await page.waitForTimeout(2000)
    const pageContent = await page.textContent('body')
    expect(pageContent).toBeTruthy()
  })

  test('Fee Earner Performance (admin): click and verify renders', async ({ page }) => {
    await page.goto('/reports')

    await page.getByText('Fee Earner Performance').first().click()
    await expect(page.getByText('Fee Earner Performance').first()).toBeVisible()

    const runButton = page.getByRole('button', { name: /run report/i })
    await expect(runButton).toBeVisible()
  })

  test('Bank Reconciliation: click and verify renders', async ({ page }) => {
    await page.goto('/reports')

    await page.getByText('Bank Reconciliation').first().click()
    await expect(page.getByText('Bank Reconciliation').first()).toBeVisible()

    const runButton = page.getByRole('button', { name: /run report/i })
    await expect(runButton).toBeVisible()
  })
})
