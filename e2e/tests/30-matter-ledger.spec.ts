import { test, expect } from '@playwright/test'
import { createClient, createMatter, createTrustEntry } from '../helpers/api-factories'
import { todayISO } from '../helpers/test-data'

test.describe('US-030: Matter Trust Ledger Report', () => {
  let matterId: string
  let matterCode: string

  test.beforeAll(async ({ request }) => {
    const client = await createClient(request, {
      clientName: 'Matter Ledger Test Client',
      clientCode: 'MLT',
      emailGeneral: 'mledger@test.co.za',
    })

    const matter = await createMatter(request, {
      clientId: client.id,
      description: 'Matter ledger test matter',
    })
    matterId = matter.id
    matterCode = matter.matterCode

    // Create multiple trust transactions
    await createTrustEntry(request, {
      matterId,
      entryType: 'trust_receipt',
      amountCents: 10000000,
      narration: 'Initial trust deposit',
    })

    await createTrustEntry(request, {
      matterId,
      entryType: 'trust_payment',
      amountCents: 3000000,
      narration: 'Trust payment for counsel fees',
    })

    await createTrustEntry(request, {
      matterId,
      entryType: 'trust_receipt',
      amountCents: 5000000,
      narration: 'Additional trust deposit',
    })
  })

  test('navigate to reports and select Matter Trust Ledger', async ({ page }) => {
    await page.goto('/reports')

    await page.getByText('Matter Trust Ledger').first().click()
    await expect(page.getByText('Matter Trust Ledger').first()).toBeVisible()
  })

  test('report shows per-matter transactions', async ({ page }) => {
    await page.goto('/reports')
    await page.getByText('Matter Trust Ledger').first().click()

    // Search for the matter
    const matterInput = page.locator('input[placeholder*="Search by code"]').first()
    await matterInput.fill('Matter ledger test')

    // Select the matter from the dropdown
    await page.getByText('Matter ledger test matter').first().click({ timeout: 10000 })

    // Run the report
    const runButton = page.getByRole('button', { name: /run report/i })
    await runButton.click()

    // Should render transaction rows
    await expect(page.getByText('Initial trust deposit').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Trust payment for counsel fees').first()).toBeVisible()
    await expect(page.getByText('Additional trust deposit').first()).toBeVisible()
  })

  test('opening balance, transaction rows, closing balance present', async ({ page }) => {
    await page.goto('/reports')
    await page.getByText('Matter Trust Ledger').first().click()

    // Search and select the matter
    const matterInput = page.locator('input[placeholder*="Search by code"]').first()
    await matterInput.fill('Matter ledger test')
    await page.getByText('Matter ledger test matter').first().click({ timeout: 10000 })

    // Run the report
    const runButton = page.getByRole('button', { name: /run report/i })
    await runButton.click()

    // Wait for report to render
    await expect(page.getByText('Initial trust deposit').first()).toBeVisible({ timeout: 15000 })

    // Opening balance row
    await expect(page.getByText(/opening/i).first()).toBeVisible()

    // Closing balance row
    await expect(page.getByText(/closing/i).first()).toBeVisible()
  })

  test('date range filter works', async ({ page }) => {
    await page.goto('/reports')
    await page.getByText('Matter Trust Ledger').first().click()

    // Search and select the matter
    const matterInput = page.locator('input[placeholder*="Search by code"]').first()
    await matterInput.fill('Matter ledger test')
    await page.getByText('Matter ledger test matter').first().click({ timeout: 10000 })

    // Set date range filters
    const dateInputs = page.locator('input[type="date"]')
    const fromInput = dateInputs.first()
    const toInput = dateInputs.nth(1)

    // Set from/to to today to capture all entries
    const today = todayISO()
    await fromInput.fill(today)
    await toInput.fill(today)

    // Run the report
    const runButton = page.getByRole('button', { name: /run report/i })
    await runButton.click()

    // Should still show our entries (created today)
    await expect(page.getByText('Initial trust deposit').first()).toBeVisible({ timeout: 15000 })
  })
})
