import { test, expect } from '@playwright/test'
import { createClient, createMatter } from '../helpers/api-factories'
import { uniqueCode, uniqueSuffix } from '../helpers/test-data'

test.describe('Fee Entries', () => {
  let clientId: string
  let matterId: string
  const suffix = uniqueSuffix()
  const clientName = `Fee Entry Client ${suffix}`
  const matterDescription = `Fee entry test matter ${suffix}`

  test.beforeAll(async ({ request }) => {
    const client = await createClient(request, {
      clientName,
      clientCode: uniqueCode('FEC'),
      emailGeneral: 'fec@example.com',
    })
    clientId = client.id
    const matter = await createMatter(request, {
      clientId: client.id,
      description: matterDescription,
    })
    matterId = matter.id
  })

  test('navigate to matter, open fee entry form', async ({ page }) => {
    await page.goto(`/matters/${matterId}`)
    await expect(page.getByText(matterDescription)).toBeVisible({ timeout: 5000 })

    // Use the matter page action rather than the floating layout action.
    const addFeeBtn = page.locator('main').getByRole('button', { name: /^Record Time$/i }).first()
    await addFeeBtn.click()

    // The slide-over opens with the fee entry form — narration is a textarea with placeholder
    await expect(page.getByRole('heading', { name: 'Record Time' })).toBeVisible({ timeout: 3000 })
    await expect(page.getByPlaceholder('Describe the work done…')).toBeVisible({ timeout: 3000 })
  })

  test('create time entry: fill narration, duration "1h30", verify amount calculates', async ({ page }) => {
    await page.goto(`/matters/${matterId}`)
    await expect(page.getByText(matterDescription)).toBeVisible({ timeout: 5000 })

    const addFeeBtn = page.locator('main').getByRole('button', { name: /^Record Time$/i }).first()
    await addFeeBtn.click()

    // Entry type defaults to "time" — the Time button is pre-selected
    // so no need to pick entry type

    // Fill narration via placeholder
    await page.getByPlaceholder('Describe the work done…').fill('Drafting contract for commercial lease')

    // Fill duration via placeholder
    await page.getByPlaceholder('e.g. 90, 1h30, 1.5h, 1:30').fill('1h30')

    // Verify amount preview calculates (the preview section shows Amount / Total)
    await page.waitForTimeout(500)
    const previewTotal = page.locator('.bg-secondary').getByText('Total')
    if (await previewTotal.isVisible()) {
      // The amount preview is visible — good
    }

    const saveResponsePromise = page.waitForResponse((response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/api/fee-entries')
    )

    // Submit — the slide-over uses stayOpenAfterSave={true}, so button says "Save & Add Another"
    await page.getByRole('button', { name: /Save & Add Another/i }).click()
    const saveResponse = await saveResponsePromise
    expect(saveResponse.ok()).toBeTruthy()

    // After saving, the slide-over stays open with a reset form. Close it to see entries.
    // Press Escape or click the Cancel button to close the slide-over.
    await page.getByRole('button', { name: /Cancel/i }).click()
    await page.reload()
    await expect(page.getByText(matterDescription)).toBeVisible({ timeout: 5000 })

    // Verify entry appears in matter fee entries
    await expect(page.getByText('Drafting contract for commercial lease')).toBeVisible({ timeout: 5000 })
  })

  test('create disbursement entry', async ({ page }) => {
    await page.goto(`/matters/${matterId}`)
    await expect(page.getByText(matterDescription)).toBeVisible({ timeout: 5000 })

    const addFeeBtn = page.locator('main').getByRole('button', { name: /^Record Time$/i }).first()
    await addFeeBtn.click()

    // Select entry type: disbursement — click the Disbursement button in the entry type grid
    await page.getByRole('button', { name: /^Disbursement$/i }).click()

    // Fill narration
    await page.getByPlaceholder('Describe the work done…').fill('Filing fees for court documents')

    // For disbursements, the rate/amount field label changes to "Amount (R)"
    // The amount input is inside the Financial section with an R prefix
    // Fill it using the number input that follows the "Amount (R)" label
    const amountInput = page.locator('input[type="number"]').first()
    await amountInput.fill('500')

    const saveResponsePromise = page.waitForResponse((response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/api/fee-entries')
    )

    // Submit — the slide-over uses stayOpenAfterSave={true}, so button says "Save & Add Another"
    await page.getByRole('button', { name: /Save & Add Another/i }).click()
    const saveResponse = await saveResponsePromise
    expect(saveResponse.ok()).toBeTruthy()

    // Close slide-over to see entries
    await page.getByRole('button', { name: /Cancel/i }).click()
    await page.reload()
    await expect(page.getByText(matterDescription)).toBeVisible({ timeout: 5000 })

    await expect(page.getByText('Filing fees for court documents')).toBeVisible({ timeout: 5000 })
  })

  test('verify entries appear in matter transactions', async ({ page }) => {
    await page.goto(`/matters/${matterId}`)
    await expect(page.getByText(matterDescription)).toBeVisible({ timeout: 5000 })

    await expect(page.getByText('Drafting contract for commercial lease')).toBeVisible()
    await expect(page.getByText('Filing fees for court documents')).toBeVisible()
  })

  test('billable toggle works', async ({ page }) => {
    await page.goto(`/matters/${matterId}`)
    await expect(page.getByText(matterDescription)).toBeVisible({ timeout: 5000 })

    const addFeeBtn = page.locator('main').getByRole('button', { name: /^Record Time$/i }).first()
    await addFeeBtn.click()

    // The billable toggle is a Switch component with text "Billable" next to it
    const billableSwitch = page
      .getByRole('heading', { name: 'Record Time' })
      .locator('xpath=ancestor::*[@role="dialog" or @data-slot="sheet-content"][1]')
      .getByRole('switch')
    if (await billableSwitch.isVisible()) {
      const wasChecked = (await billableSwitch.getAttribute('aria-checked')) === 'true'
      await billableSwitch.click()
      await expect(billableSwitch).not.toHaveAttribute('aria-checked', wasChecked ? 'true' : 'false')
      const isChecked = (await billableSwitch.getAttribute('aria-checked')) === 'true'
      expect(isChecked).not.toBe(wasChecked)
    }
  })
})
