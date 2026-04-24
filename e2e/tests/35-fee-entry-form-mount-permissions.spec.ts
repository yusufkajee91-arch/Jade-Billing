import { test, expect } from '../helpers/console-capture'
import { createClient, createMatter } from '../helpers/api-factories'
import { FEE_EARNER_STORAGE } from '../helpers/auth'
import { uniqueCode, uniqueSuffix } from '../helpers/test-data'

test.describe('Fee entry form mount permissions', () => {
  test.use({ storageState: FEE_EARNER_STORAGE })

  let matterId: string
  let matterDescription: string

  test.beforeAll(async ({ request }) => {
    const suffix = uniqueSuffix()
    const client = await createClient(request, {
      clientName: `Disbursement Permission ${suffix}`,
      clientCode: uniqueCode('DPM'),
    })
    const matter = await createMatter(request, {
      clientId: client.id,
      description: `Fee earner disbursement permission ${suffix}`,
      ownerId: 'seed-fee-earner',
    })

    matterId = matter.id
    matterDescription = matter.description
  })

  test('fee earner can submit a disbursement without forbidden responses', async ({ page }) => {
    const forbiddenResponses: string[] = []
    const narration = `Disbursement permission check ${uniqueSuffix()}`

    page.on('response', (response) => {
      if (response.status() !== 403) return

      const url = new URL(response.url())
      forbiddenResponses.push(`${response.request().method()} ${url.pathname}${url.search}`)
    })

    await page.goto(`/matters/${matterId}`)
    await expect(page.getByRole('heading', { name: matterDescription })).toBeVisible()

    await page.locator('main').getByRole('button', { name: /^Record Time$/i }).first().click()

    await expect(page.getByRole('heading', { name: 'Record Time' })).toBeVisible()
    await expect(page.getByPlaceholder('Describe the work done…')).toBeVisible()
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Disbursement' }).click()
    await page.getByPlaceholder('Describe the work done…').fill(narration)
    await page.locator('input[type="number"]').first().fill('240')

    const saveResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url())
      return response.request().method() === 'POST' && url.pathname === '/api/fee-entries'
    })

    await page.getByRole('button', { name: /Save & Add Another/i }).click()
    const saveResponse = await saveResponsePromise

    expect(saveResponse.status()).toBe(201)
    expect(forbiddenResponses).toEqual([])

    await page.getByRole('button', { name: 'Cancel' }).click()
    await page.reload()
    await expect(page.getByText(narration)).toBeVisible()
  })

  test('posting code dropdown shows readable descriptions without horizontal overflow at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 })

    await page.goto(`/matters/${matterId}`)
    await expect(page.getByRole('heading', { name: matterDescription })).toBeVisible()

    await page.getByRole('heading', { name: matterDescription }).click()
    await page.keyboard.press('t')

    const dialog = page
      .getByRole('heading', { name: 'Record Time' })
      .locator('xpath=ancestor::*[@role="dialog" or @data-slot="sheet-content"][1]')

    await expect(dialog.getByPlaceholder('Describe the work done…')).toBeVisible()

    const postingCodeTrigger = dialog
      .locator('label:has-text("Posting Code")')
      .locator('..')
      .locator('[data-slot="select-trigger"]')

    await postingCodeTrigger.click()

    const dropdown = page.locator('[data-slot="select-content"]')
    const emailOption = dropdown.getByRole('option', { name: 'EMAIL Email to client' })
    const reviewOption = dropdown.getByRole('option', { name: 'REVIEW Review and advice' })

    await expect(dropdown).toBeVisible()
    await expect(emailOption).toBeVisible()
    await expect(reviewOption).toBeVisible()

    const dimensions = await dropdown.evaluate((el) => ({
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
    }))
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)

    await reviewOption.click()
    await expect(postingCodeTrigger).toContainText('REVIEW')

    await postingCodeTrigger.click()
    await expect(dropdown).toBeVisible()
    await expect(reviewOption).toBeVisible()
  })
})
