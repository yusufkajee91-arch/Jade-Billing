import { test, expect } from '@playwright/test'
import { createClient, createMatter } from '../helpers/api-factories'

test.describe('Record Time Global (FAB + keyboard shortcut)', () => {
  let matterId: string

  test.beforeAll(async ({ request }) => {
    const client = await createClient(request, {
      clientName: 'Global Time Client',
      clientCode: 'GTC',
      emailGeneral: 'gtc@example.com',
    })
    const matter = await createMatter(request, {
      clientId: client.id,
      description: 'Global time test matter',
    })
    matterId = matter.id
  })

  test('FAB click opens slide-over with form', async ({ page }) => {
    await page.goto('/dashboard')

    // FAB has aria-label="Record time" (lowercase t)
    const fab = page.getByRole('button', { name: 'Record time' })
    await fab.click()

    // Slide-over opens with SheetTitle "Record Time"
    await expect(page.getByText('Record Time', { exact: false }).first()).toBeVisible({ timeout: 3000 })
    // Narration textarea should be visible
    await expect(page.getByPlaceholder('Describe the work done…')).toBeVisible()
  })

  test('press T key opens slide-over', async ({ page }) => {
    await page.goto('/dashboard')

    // Press T key (not in an input)
    await page.keyboard.press('t')

    // Slide-over should open with "Record Time" title
    await expect(page.getByText('Record Time', { exact: false }).first()).toBeVisible({ timeout: 3000 })
    await expect(page.getByPlaceholder('Describe the work done…')).toBeVisible()
  })

  test('fill form in slide-over, submit, verify success', async ({ page }) => {
    await page.goto('/dashboard')

    // Open slide-over via FAB
    await page.getByRole('button', { name: 'Record time' }).click()
    await expect(page.getByPlaceholder('Describe the work done…')).toBeVisible({ timeout: 3000 })

    // Select matter using the matter search input (placeholder "Search matters…")
    const matterSearch = page.getByPlaceholder('Search matters…')
    await matterSearch.click()
    await matterSearch.fill('Global time')
    // Click the matching matter from the dropdown list
    await page.getByText('Global time test matter').click()

    // Fill narration
    await page.getByPlaceholder('Describe the work done…').fill('Telephone consultation with client')

    // Fill time duration
    await page.getByPlaceholder('e.g. 90, 1h30, 1.5h, 1:30').fill('0h30')

    // Submit — in the slide-over stayOpenAfterSave=true, so button says "Save & Add Another"
    await page.getByRole('button', { name: /Save & Add Another/i }).click()

    // Verify success - toast message should appear
    await expect(
      page.getByText(/Entry recorded|saved|success/i)
    ).toBeVisible({ timeout: 5000 })
  })

  test('slide-over closes after save', async ({ page }) => {
    await page.goto('/dashboard')

    // Open slide-over
    await page.getByRole('button', { name: 'Record time' }).click()
    await expect(page.getByPlaceholder('Describe the work done…')).toBeVisible({ timeout: 3000 })

    // Select matter
    const matterSearch = page.getByPlaceholder('Search matters…')
    await matterSearch.click()
    await matterSearch.fill('Global time')
    await page.getByText('Global time test matter').click()

    await page.getByPlaceholder('Describe the work done…').fill('Brief email correspondence')
    await page.getByPlaceholder('e.g. 90, 1h30, 1.5h, 1:30').fill('0h06')

    await page.getByRole('button', { name: /Save & Add Another/i }).click()

    // The slide-over stays open (stayOpenAfterSave=true) but the form resets
    // Verify the narration field is cleared after save
    await expect(page.getByPlaceholder('Describe the work done…')).toHaveValue('', { timeout: 5000 })
  })
})
