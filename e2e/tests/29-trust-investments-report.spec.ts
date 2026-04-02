import { test, expect } from '../helpers/console-capture'
import { createClient, createMatter, createTrustEntry } from '../helpers/api-factories'
import { todayISO } from '../helpers/test-data'

test.describe('US-029: Trust & Investments Report', () => {
  let matterId: string

  test.beforeAll(async ({ request }) => {
    const client = await createClient(request, {
      clientName: 'Trust Invest Test Client',
      clientCode: 'TIT',
      emailGeneral: 'trustinvest@test.co.za',
    })

    const matter = await createMatter(request, {
      clientId: client.id,
      description: 'Trust investments test matter',
    })
    matterId = matter.id

    // Create trust entries
    await createTrustEntry(request, {
      matterId,
      entryType: 'trust_receipt',
      amountCents: 7500000,
      narration: 'Trust investment deposit',
    })

    await createTrustEntry(request, {
      matterId,
      entryType: 'trust_payment',
      amountCents: 2000000,
      narration: 'Trust payment out',
    })
  })

  test('navigate to reports and select Trust & Investments', async ({ page }) => {
    await page.goto('/reports')

    // Click Trust & Investments in sidebar
    await page.getByText('Trust & Investments').first().click()

    // Report title should appear in the panel
    await expect(page.getByText('Trust & Investments').first()).toBeVisible()
  })

  test('report renders with matter trust balances', async ({ page }) => {
    await page.goto('/reports')
    await page.getByText('Trust & Investments').first().click()

    // Run the report
    const runButton = page.getByRole('button', { name: /run report/i })
    await runButton.click()

    // Should show the matter and its trust balance
    await expect(
      page.getByText('Trust Invest Test Client').first(),
    ).toBeVisible({ timeout: 15000 })

    // Total row should be present
    await expect(page.getByText('Total').first()).toBeVisible()
  })

  test('as-at date filter works', async ({ page }) => {
    await page.goto('/reports')
    await page.getByText('Trust & Investments').first().click()

    // Set the as-at date to today
    const dateInput = page.locator('input[type="date"]').first()
    await dateInput.fill(todayISO())

    // Run the report
    const runButton = page.getByRole('button', { name: /run report/i })
    await runButton.click()

    // Report should render with data filtered by date
    await expect(
      page.getByText('Trust Invest Test Client').first(),
    ).toBeVisible({ timeout: 15000 })

    // The as-at date text should appear somewhere in the output
    await expect(page.getByText(todayISO()).first()).toBeVisible()
  })
})
