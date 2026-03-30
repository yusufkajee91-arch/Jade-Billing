import { test, expect } from '@playwright/test'
import { createClient } from '../helpers/api-factories'
import { uniqueCode, uniqueSuffix } from '../helpers/test-data'

test.describe('Clients', () => {
  const suffix = uniqueSuffix()
  let setupClientName = ''
  const uiClient = {
    name: `Widget Corp ${suffix} (Pty) Ltd`,
    updatedName: `Widget Corp ${suffix} Updated`,
    code: uniqueCode('WID'),
    email: `info.${suffix}@widgetcorp.co.za`,
  }

  test.beforeAll(async ({ request }) => {
    setupClientName = `Reference Client ${suffix}`
    const client = await createClient(request, {
      clientName: setupClientName,
      clientCode: uniqueCode('REF'),
      entityType: 'company_pty',
      emailGeneral: `reference.${suffix}@example.com`,
    })
    expect(client.id).toBeTruthy()
  })

  test('clients page loads', async ({ page }) => {
    await page.goto('/clients')
    await expect(page).toHaveURL(/\/clients$/)
    await expect(page.locator('.brand-table')).toBeVisible({ timeout: 10000 })
  })

  test('create client via UI, verify in table', async ({ page }) => {
    await page.goto('/clients')
    await expect(page.locator('.brand-table')).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: /new client/i }).click()

    // Wait for the sheet to open — title is "New Client"
    await expect(page.getByRole('heading', { name: 'New Client' })).toBeVisible({ timeout: 5000 })

    // Form inputs use register() so have name attributes
    await page.locator('input[name="clientName"]').fill(uiClient.name)
    await page.locator('input[name="clientCode"]').fill(uiClient.code)

    // Select entity type — click the trigger (which shows placeholder "Select entity type")
    await page.locator('[data-slot="select-trigger"]').filter({ hasText: 'Select entity type' }).click()
    await page.getByRole('option', { name: 'Company (Pty) Ltd' }).click()

    await page.locator('input[name="emailGeneral"]').fill(uiClient.email)

    await page.getByRole('button', { name: /create client/i }).click()

    // Verify the client appears in the table
    await expect(page.getByText(uiClient.name)).toBeVisible({ timeout: 5000 })
  })

  test('search clients by name', async ({ page }) => {
    await page.goto('/clients')
    await expect(page.locator('.brand-table')).toBeVisible({ timeout: 10000 })

    // The search input has placeholder "Search by name or code\u2026"
    const searchInput = page.getByPlaceholder(/search by name or code/i)
    await searchInput.fill(setupClientName)

    // Filtered table should show the matching client
    await expect(page.getByText(setupClientName)).toBeVisible()
  })

  test('client detail page loads when clicking a client', async ({ page }) => {
    await page.goto('/clients')
    await expect(page.locator('.brand-table')).toBeVisible({ timeout: 10000 })

    // The client name is a <button> that navigates via router.push
    await page.getByRole('button', { name: setupClientName, exact: true }).click()

    await expect(page).toHaveURL(/\/clients\/[a-zA-Z0-9-]+$/)
    await expect(page.getByText(setupClientName)).toBeVisible()
  })

  test('FICA status badge shows "Not Compliant" by default', async ({ page }) => {
    await page.goto('/clients')
    await expect(page.locator('.brand-table')).toBeVisible({ timeout: 10000 })

    // Navigate to client detail via the "View" button or the client name button
    await page.getByRole('button', { name: setupClientName, exact: true }).click()
    await expect(page).toHaveURL(/\/clients\//)

    // The FicaBadge renders "Not Compliant" for ficaStatus "not_compliant"
    await expect(page.getByText('Not Compliant')).toBeVisible()
  })

  test('edit client, verify changes', async ({ page }) => {
    await page.goto('/clients')
    await expect(page.locator('.brand-table')).toBeVisible({ timeout: 10000 })

    // Navigate to client detail
    await page.getByRole('button', { name: setupClientName, exact: true }).click()
    await expect(page).toHaveURL(/\/clients\//)

    // The client detail page has an "Edit" button (with Pencil icon) in the header
    await page.getByRole('button', { name: /edit/i }).first().click()

    // Wait for the edit sheet to open — title is "Edit Client"
    await expect(page.getByRole('heading', { name: 'Edit Client' })).toBeVisible({ timeout: 5000 })

    // In the edit sheet, clear and fill the client name
    const nameField = page.locator('input[name="clientName"]')
    await nameField.clear()
    await nameField.fill(`${setupClientName} Updated`)

    await page.getByRole('button', { name: /update client/i }).click()

    // Reload and verify
    await page.reload()
    await expect(page.getByText(`${setupClientName} Updated`)).toBeVisible({ timeout: 5000 })
  })
})
