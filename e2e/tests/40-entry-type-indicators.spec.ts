import { test, expect } from '../helpers/console-capture'
import { createClient, createMatter } from '../helpers/api-factories'
import { uniqueCode, uniqueSuffix } from '../helpers/test-data'

const API_BASE = 'http://localhost:3001'

test.describe('Matter detail: T / U / D indicator letters removed', () => {
  let matterId: string
  let matterDescription: string
  const timeNarration = `Time entry indicator check ${uniqueSuffix()}`
  const unitNarration = `Unitary entry indicator check ${uniqueSuffix()}`
  const disbNarration = `Disbursement entry indicator check ${uniqueSuffix()}`

  test.beforeAll(async ({ request }) => {
    const suffix = uniqueSuffix()
    const client = await createClient(request, {
      clientName: `Indicator Removal Client ${suffix}`,
      clientCode: uniqueCode('IND'),
    })
    const matter = await createMatter(request, {
      clientId: client.id,
      description: `Indicator removal matter ${suffix}`,
    })
    matterId = matter.id
    matterDescription = matter.description

    const today = new Date().toISOString().slice(0, 10)
    const base = {
      matterId,
      entryDate: today,
      feeEarnerId: 'seed-admin-user',
      discountPct: 0,
      isBillable: true,
    }

    const timeRes = await request.post(`${API_BASE}/api/fee-entries`, {
      data: {
        ...base,
        entryType: 'time',
        narration: timeNarration,
        durationMinutesRaw: 60,
        rateCents: 200000,
      },
    })
    expect(timeRes.status()).toBe(201)

    const unitRes = await request.post(`${API_BASE}/api/fee-entries`, {
      data: {
        ...base,
        entryType: 'unitary',
        narration: unitNarration,
        unitQuantityThousandths: 2000,
        rateCents: 15000,
      },
    })
    expect(unitRes.status()).toBe(201)

    const disbRes = await request.post(`${API_BASE}/api/fee-entries`, {
      data: {
        ...base,
        entryType: 'disbursement',
        narration: disbNarration,
        rateCents: 12000,
      },
    })
    expect(disbRes.status()).toBe(201)
  })

  test('no row carries a bare "T", "U", or "D" indicator letter', async ({ page }) => {
    await page.goto(`/matters/${matterId}`)
    await expect(page.getByRole('heading', { name: matterDescription })).toBeVisible()

    for (const narration of [timeNarration, unitNarration, disbNarration]) {
      const row = page
        .getByText(narration, { exact: false })
        .locator('xpath=ancestor::div[contains(@class, "border-b")][1]')

      await expect(row).toBeVisible()
      await expect(row.getByText(/^T$/)).toHaveCount(0)
      await expect(row.getByText(/^U$/)).toHaveCount(0)
      await expect(row.getByText(/^D$/)).toHaveCount(0)
    }
  })

  test('duration column still distinguishes the three entry types', async ({ page }) => {
    await page.goto(`/matters/${matterId}`)
    await expect(page.getByRole('heading', { name: matterDescription })).toBeVisible()

    const timeRow = page
      .getByText(timeNarration, { exact: false })
      .locator('xpath=ancestor::div[contains(@class, "border-b")][1]')
    const unitRow = page
      .getByText(unitNarration, { exact: false })
      .locator('xpath=ancestor::div[contains(@class, "border-b")][1]')
    const disbRow = page
      .getByText(disbNarration, { exact: false })
      .locator('xpath=ancestor::div[contains(@class, "border-b")][1]')

    // Time → formatMinutes output (contains "h" or "min"); unitary → "×N.NNN"; disbursement → em dash
    await expect(timeRow).toContainText(/\b\d+\s*h|\b\d+\s*min/)
    await expect(unitRow).toContainText('×')
    await expect(disbRow).toContainText('—')
  })
})
