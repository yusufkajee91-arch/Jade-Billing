import { test, expect } from '../helpers/console-capture'
import { createClient } from '../helpers/api-factories'
import { ASSISTANT_STORAGE } from '../helpers/auth'
import { uniqueCode, uniqueSuffix } from '../helpers/test-data'

test.describe('Quick actions', () => {
  const suffix = uniqueSuffix()
  const quickClient = {
    name: `Quick Action Client ${suffix}`,
    code: uniqueCode('QAC'),
    email: `quick.${suffix}@example.com`,
  }
  let matterClientName = ''

  test.beforeAll(async ({ request }) => {
    matterClientName = `Quick Matter Client ${suffix}`
    const client = await createClient(request, {
      clientName: matterClientName,
      clientCode: uniqueCode('QMC'),
      entityType: 'company_pty',
      emailGeneral: `matter.${suffix}@example.com`,
    })
    expect(client.id).toBeTruthy()
  })

  test('Add Client quick action opens route page and creates a client', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'Add Client' }).click()

    await expect(page).toHaveURL(/\/clients\/new$/, { timeout: 15000 })
    await expect(page.getByRole('heading', { name: 'New Client' })).toBeVisible({ timeout: 15000 })

    await page.locator('input[name="clientName"]').fill(quickClient.name)
    await page.locator('input[name="clientCode"]').fill(quickClient.code)
    await page.locator('[data-slot="select-trigger"]').filter({ hasText: 'Select entity type' }).click()
    await page.getByRole('option', { name: 'Company (Pty) Ltd' }).click()
    await page.locator('input[name="emailGeneral"]').fill(quickClient.email)

    const createResponsePromise = page.waitForResponse((response) =>
      response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/clients',
    )
    await page.getByRole('button', { name: /create client/i }).click()
    const createResponse = await createResponsePromise

    expect(createResponse.status()).toBe(201)
    await expect(page).toHaveURL(/\/clients$/)
    await expect(page.getByText(quickClient.name)).toBeVisible({ timeout: 5000 })
  })

  test('Add Matter quick action opens route page and creates a matter', async ({ page }) => {
    const description = `Quick action matter ${uniqueSuffix()}`

    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'Add Matter' }).click()

    await expect(page).toHaveURL(/\/matters\/new$/, { timeout: 15000 })
    await expect(page.getByRole('heading', { name: 'New Matter' })).toBeVisible({ timeout: 15000 })

    await page.getByPlaceholder(/search clients/i).fill(matterClientName)
    await page.locator('[data-slot="select-trigger"]').filter({ hasText: 'Select client' }).click()
    await page.getByRole('option', { name: new RegExp(matterClientName, 'i') }).click()
    await page.locator('textarea[name="description"]').fill(description)

    const createResponsePromise = page.waitForResponse((response) =>
      response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/matters',
    )
    await page.getByRole('button', { name: /create matter/i }).click()
    const createResponse = await createResponsePromise

    expect(createResponse.status()).toBe(201)
    await expect(page).toHaveURL(/\/matters\/[a-zA-Z0-9-]+$/)
    await expect(page.getByText(description)).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Quick actions role gating', () => {
  test.use({ storageState: ASSISTANT_STORAGE })

  test('assistant does not see create quick actions', async ({ page }) => {
    await page.goto('/dashboard')

    await expect(page.getByRole('button', { name: 'Add Client' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Add Matter' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Record time' })).toHaveCount(0)
  })
})
