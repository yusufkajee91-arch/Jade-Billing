import { test, expect } from '@playwright/test'
import { createClient, createMatter } from '../helpers/api-factories'
import { uniqueCode, uniqueSuffix } from '../helpers/test-data'

test.describe('Matters', () => {
  let clientId: string
  let matterId: string
  let matterCode: string
  const suffix = uniqueSuffix()
  const clientName = `Matter Test Client ${suffix}`
  const uiDescription = `UI commercial advisory ${suffix}`
  const initialDescription = `General commercial advisory ${suffix}`
  const updatedDescription = `Updated commercial advisory ${suffix}`

  test.beforeAll(async ({ request }) => {
    const client = await createClient(request, {
      clientName,
      clientCode: uniqueCode('MTC'),
      entityType: 'company_pty',
      emailGeneral: 'mtc@example.com',
    })
    expect(client.id).toBeTruthy()
    clientId = client.id

    const matter = await createMatter(request, {
      clientId,
      description: initialDescription,
    })
    expect(matter.id).toBeTruthy()
    matterId = matter.id
    matterCode = matter.matterCode
  })

  test('matters page loads', async ({ page }) => {
    await page.goto('/matters')
    await expect(page).toHaveURL(/\/matters$/)
    await expect(page.locator('.brand-table')).toBeVisible({ timeout: 10000 })
  })

  test('create matter via UI: select client, fill description, submit', async ({ page }) => {
    await page.goto('/matters')
    await expect(page.locator('.brand-table')).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: /new matter/i }).click()

    // Wait for the sheet to open
    await expect(page.getByRole('heading', { name: 'New Matter' })).toBeVisible({ timeout: 5000 })

    // Search for client using the search input (placeholder: "Search clients\u2026")
    await page.getByPlaceholder(/search clients/i).fill(clientName)

    // Click the Select trigger to open the client dropdown
    // The trigger shows "Select client" placeholder
    await page.locator('[data-slot="select-trigger"]').filter({ hasText: 'Select client' }).click()
    await page.getByRole('option', { name: new RegExp(clientName, 'i') }).click()

    // Fill description — it's a <textarea> with name="description"
    await page.locator('textarea[name="description"]').fill(uiDescription)

    await page.getByRole('button', { name: /create matter/i }).click()

    // Verify matter appears in the table
    await expect(page.getByText(uiDescription)).toBeVisible({ timeout: 5000 })
  })

  test('matter code is auto-generated in correct format', async ({ page }) => {
    await page.goto(`/matters/${matterId}`)
    await expect(page.getByText(matterCode)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(matterCode)).toContainText(/\//)
  })

  test('matter detail page loads', async ({ page }) => {
    await page.goto(`/matters/${matterId}`)
    await expect(page).toHaveURL(/\/matters\/[a-zA-Z0-9-]+$/)
    await expect(page.getByText(initialDescription)).toBeVisible()
  })

  test('edit matter description', async ({ page }) => {
    await page.goto(`/matters/${matterId}`)
    await expect(page).toHaveURL(/\/matters\//)

    // Click the Edit button in the header (styled button with Pencil icon + "Edit" text)
    await page.getByRole('button', { name: /edit/i }).first().click()

    // Wait for the edit sheet to open — title says "Edit Matter"
    await expect(page.getByRole('heading', { name: 'Edit Matter' })).toBeVisible({ timeout: 5000 })

    // Fill the description textarea
    const descField = page.locator('textarea[name="description"]')
    await descField.clear()
    await descField.fill(updatedDescription)

    const updateResponsePromise = page.waitForResponse((response) =>
      response.request().method() === 'PATCH' &&
      response.url().endsWith(`/api/matters/${matterId}`)
    )

    await page.getByRole('button', { name: /update matter/i }).click()
    const updateResponse = await updateResponsePromise
    expect(updateResponse.ok()).toBeTruthy()

    await expect(page.getByText(updatedDescription)).toBeVisible({ timeout: 5000 })

    await page.reload()
    await expect(page.getByText(updatedDescription)).toBeVisible({ timeout: 5000 })
  })

  test('status defaults to open', async ({ page }) => {
    await page.goto(`/matters/${matterId}`)
    // The MatterStatusBadge renders the status text — "Open" for open status
    await expect(page.getByText('Open', { exact: true })).toBeVisible()
  })

  test('close matter, verify status changes', async ({ page }) => {
    await page.goto(`/matters/${matterId}`)
    await expect(page).toHaveURL(/\/matters\//)

    // Click "Close Matter" button in the header
    await page.getByRole('button', { name: /close matter/i }).click()

    // Confirm in the dialog — the dialog uses base-ui Dialog with role="dialog"
    // The confirm button also says "Close Matter"
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 5000 })
    const closeResponsePromise = page.waitForResponse((response) =>
      response.request().method() === 'PATCH' &&
      response.url().endsWith(`/api/matters/${matterId}`)
    )
    await dialog.getByRole('button', { name: /close matter/i }).click()
    const closeResponse = await closeResponsePromise
    expect(closeResponse.ok()).toBeTruthy()

    await expect(page.getByText('Closed', { exact: true })).toBeVisible({ timeout: 5000 })

    await page.reload()
    await expect(page.getByText('Closed', { exact: true })).toBeVisible()
  })
})
