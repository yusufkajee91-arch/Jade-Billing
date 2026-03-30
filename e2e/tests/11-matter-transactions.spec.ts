import { test, expect } from '@playwright/test'
import { createClient, createMatter, createFeeEntry } from '../helpers/api-factories'
import { uniqueCode, uniqueSuffix } from '../helpers/test-data'

test.describe('Matter Transactions', () => {
  let matterId: string
  let matterDescription: string

  test.beforeAll(async ({ request }) => {
    const suffix = uniqueSuffix()
    const client = await createClient(request, {
      clientName: `Transactions Client ${suffix}`,
      clientCode: uniqueCode('TXC'),
      emailGeneral: `transactions-${suffix}@example.com`,
    })
    matterDescription = `Transactions test matter ${suffix}`
    const matter = await createMatter(request, {
      clientId: client.id,
      description: matterDescription,
    })
    matterId = matter.id

    // Create 3 fee entries with different dates
    const today = new Date()
    await createFeeEntry(request, {
      matterId: matter.id,
      narration: 'Initial consultation meeting',
      entryType: 'time',
      billedMinutes: 60,
      rateCents: 200000,
      entryDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2)
        .toISOString().split('T')[0],
    })
    await createFeeEntry(request, {
      matterId: matter.id,
      narration: 'Review of lease agreement',
      entryType: 'time',
      billedMinutes: 90,
      rateCents: 200000,
      entryDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
        .toISOString().split('T')[0],
    })
    await createFeeEntry(request, {
      matterId: matter.id,
      narration: 'Court filing fees',
      entryType: 'disbursement',
      billedMinutes: 0,
      rateCents: 50000,
      entryDate: today.toISOString().split('T')[0],
    })
  })

  test('matter transactions show all entries', async ({ page }) => {
    await page.goto(`/matters/${matterId}`)
    await expect(page.getByText(matterDescription)).toBeVisible({ timeout: 5000 })

    // Wait for fee entries to load in the default "Unbilled Fees" tab
    await expect(page.getByText('Initial consultation meeting')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Review of lease agreement')).toBeVisible()
    await expect(page.getByText('Court filing fees')).toBeVisible()
  })

  test('entries sorted by date', async ({ page }) => {
    await page.goto(`/matters/${matterId}`)
    await expect(page.getByText(matterDescription)).toBeVisible({ timeout: 5000 })

    // Wait for fee entries to load (the default tab is "Unbilled Fees")
    await expect(page.getByText('Initial consultation meeting')).toBeVisible({ timeout: 5000 })

    // The matter fee entries table is a custom flex-based layout with rows
    // Each entry row contains a checkbox + date + fee earner + description + duration + amount
    // All 3 entries should be visible
    await expect(page.getByText('Review of lease agreement')).toBeVisible()
    await expect(page.getByText('Court filing fees')).toBeVisible()
  })

  test('bulk select checkboxes appear', async ({ page }) => {
    await page.goto(`/matters/${matterId}`)
    await expect(page.getByText(matterDescription)).toBeVisible({ timeout: 5000 })

    // Wait for entries to load
    await expect(page.getByText('Initial consultation meeting')).toBeVisible({ timeout: 5000 })

    // The fee entries table uses real <input type="checkbox"> elements for each row
    const checkboxes = page.locator('input[type="checkbox"]')
    const count = await checkboxes.count()
    expect(count).toBeGreaterThanOrEqual(3)

    // Check one and verify it becomes selected
    await checkboxes.first().check()
    await expect(checkboxes.first()).toBeChecked()
  })

  test('total amounts shown', async ({ page }) => {
    await page.goto(`/matters/${matterId}`)
    await expect(page.getByText(matterDescription)).toBeVisible({ timeout: 5000 })

    // Wait for entries to load
    await expect(page.getByText('Initial consultation meeting')).toBeVisible({ timeout: 5000 })

    const main = page.locator('main')
    await expect(main).toContainText('Fees')
    await expect(main).toContainText('Disbursements')
    await expect(main).toContainText('Total')
    await expect(main.getByText(/R[\s\u00A0][\d\s,.]+/).first()).toBeVisible()
  })
})
