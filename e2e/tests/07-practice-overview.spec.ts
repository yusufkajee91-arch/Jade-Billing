import { test, expect } from '@playwright/test'
import { createClient, createMatter } from '../helpers/api-factories'
import { uniqueCode, uniqueSuffix } from '../helpers/test-data'

test.describe('Practice Overview', () => {
  const suffix = uniqueSuffix()
  const alphaClientName = `Overview Client Alpha ${suffix}`
  const betaClientName = `Overview Client Beta ${suffix}`
  const alphaMatterOne = `Alpha matter one ${suffix}`
  const alphaMatterTwo = `Alpha matter two ${suffix}`
  const betaMatterOne = `Beta matter one ${suffix}`

  test.beforeAll(async ({ request }) => {
    const client1 = await createClient(request, {
      clientName: alphaClientName,
      clientCode: uniqueCode('OCA'),
      emailGeneral: 'oca@example.com',
    })
    const client2 = await createClient(request, {
      clientName: betaClientName,
      clientCode: uniqueCode('OCB'),
      emailGeneral: 'ocb@example.com',
    })
    await createMatter(request, {
      clientId: client1.id,
      description: alphaMatterOne,
    })
    await createMatter(request, {
      clientId: client1.id,
      description: alphaMatterTwo,
    })
    await createMatter(request, {
      clientId: client2.id,
      description: betaMatterOne,
    })
  })

  test('practice overview page loads at /practice', async ({ page }) => {
    await page.goto('/practice')
    await expect(page).toHaveURL(/\/practice$/)
    await expect(page.getByRole('heading', { name: 'Practice Overview' })).toBeVisible({ timeout: 10000 })
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 })
  })

  test('table shows all open matters', async ({ page }) => {
    await page.goto('/practice')
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 })

    await expect(page.getByText(alphaMatterOne)).toBeVisible()
    await expect(page.getByText(alphaMatterTwo)).toBeVisible()
    await expect(page.getByText(betaMatterOne)).toBeVisible()
  })

  test('filter by text search', async ({ page }) => {
    await page.goto('/practice')
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 })

    const searchInput = page.locator('main').getByPlaceholder('Search matters…')
    await searchInput.fill(alphaClientName)

    await expect(page.getByText(alphaMatterOne)).toBeVisible()
    await expect(page.getByText(alphaMatterTwo)).toBeVisible()
    await expect(page.getByText(betaMatterOne)).not.toBeVisible()
  })

  test('sort by column', async ({ page }) => {
    await page.goto('/practice')
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 })

    // Click a sortable column header to toggle sort
    const header = page.locator('table th').filter({ hasText: /matter/i }).first()
    await header.click()

    // After clicking, the table should still be visible and contain data
    await expect(page.locator('table tbody tr').first()).toBeVisible()
  })

  test('matter count shown', async ({ page }) => {
    await page.goto('/practice')
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 })

    // The page header should display a matter count
    await expect(
      page
        .locator('main')
        .locator('p')
        .filter({ hasText: /^\d+\s+matters?$/ })
        .first(),
    ).toBeVisible()
  })
})
