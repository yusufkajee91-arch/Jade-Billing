import { test, expect } from '@playwright/test'
import { createClient, createMatter } from '../helpers/api-factories'
import { uniqueCode, uniqueSuffix } from '../helpers/test-data'

test.describe('Global Search', () => {
  let matterId: string
  const suffix = uniqueSuffix()
  const clientName = `Acme Holdings ${suffix}`
  const matterDescription = `Acme corporate restructuring ${suffix}`

  test.beforeAll(async ({ request }) => {
    const client = await createClient(request, {
      clientName,
      clientCode: uniqueCode('ACM'),
      emailGeneral: 'info@acme.co.za',
    })
    const matter = await createMatter(request, {
      clientId: client.id,
      description: matterDescription,
    })
    matterId = matter.id
  })

  test('search input visible in layout', async ({ page }) => {
    await page.goto('/dashboard')
    // The GlobalSearch component renders a native <input> with placeholder
    // "Search matters and clients..." (with three dots, not ellipsis)
    const searchInput = page.getByPlaceholder(/search matters and clients/i)
    await expect(searchInput).toBeVisible()
  })

  test('type "Acme", results appear', async ({ page }) => {
    await page.goto('/dashboard')
    // GlobalSearch input has placeholder "Search matters and clients..."
    const searchInput = page.getByPlaceholder(/search matters and clients/i)
    await searchInput.click()
    await searchInput.fill('Acme')

    // Wait for debounced search results to appear in the dropdown
    await expect(page.getByText(matterDescription)).toBeVisible({ timeout: 5000 })
  })

  test('click result navigates to matter', async ({ page }) => {
    await page.goto('/dashboard')
    const searchInput = page.getByPlaceholder(/search matters and clients/i)
    await searchInput.click()
    await searchInput.fill('Acme')

    await page.getByText(matterDescription).click()
    await expect(page).toHaveURL(/\/matters\//)
  })

  test('Cmd+K opens command palette', async ({ page }) => {
    await page.goto('/dashboard')
    await page.keyboard.press('Meta+k')

    // The command palette input has placeholder with unicode ellipsis
    const paletteInput = page.getByPlaceholder('Search matters, clients, actions\u2026')
    await expect(paletteInput).toBeVisible({ timeout: 5000 })
  })

  test('type in command palette, results appear', async ({ page }) => {
    await page.goto('/dashboard')
    await page.keyboard.press('Meta+k')

    // The command palette input placeholder uses a unicode ellipsis
    const paletteInput = page.getByPlaceholder('Search matters, clients, actions\u2026')
    await expect(paletteInput).toBeVisible({ timeout: 5000 })
    await paletteInput.fill('Acme')

    // Command palette should show matching clients and matters
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByLabel('Clients').getByText(clientName)).toBeVisible({ timeout: 5000 })
    await expect(dialog.getByLabel('Matters').getByText(matterDescription)).toBeVisible()
  })
})
