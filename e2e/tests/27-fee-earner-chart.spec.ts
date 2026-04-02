import { test, expect } from '../helpers/console-capture'
import { createClient, createMatter, createFeeEntry } from '../helpers/api-factories'
import { todayISO, uniqueCode, uniqueSuffix } from '../helpers/test-data'

test.describe('US-027: Fee Earner Chart', () => {
  test.beforeAll(async ({ request }) => {
    const clientCode = uniqueCode('CHT')

    // Create client and matter
    const client = await createClient(request, {
      clientName: `Chart Test Client ${uniqueSuffix()}`,
      clientCode,
      emailGeneral: 'chart@test.co.za',
    })

    const matter = await createMatter(request, {
      clientId: client.id,
      description: 'Chart test matter',
    })

    // Create multiple fee entries for current month to populate the chart
    const today = todayISO()
    for (let i = 0; i < 5; i++) {
      await createFeeEntry(request, {
        matterId: matter.id,
        narration: `Chart fee entry ${i + 1}`,
        billedMinutes: 30 + i * 15,
        rateCents: 200000,
        entryDate: today,
      })
    }
  })

  test('dashboard loads', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test('fee chart section visible', async ({ page }) => {
    await page.goto('/dashboard')

    // Fee chart widget label should be present (label text is "Fees Recorded")
    const chartWidget = page.locator('.glass-card', { hasText: 'Fees Recorded' }).first()
    await expect(chartWidget).toBeVisible({ timeout: 10000 })
  })

  test('chart renders with data (SVG elements present)', async ({ page }) => {
    await page.goto('/dashboard')

    const chartWidget = page.locator('.glass-card', { hasText: 'Fees Recorded' }).first()
    await expect(chartWidget).toBeVisible({ timeout: 10000 })

    // Scope assertions to the Fees Recorded widget so other dashboard charts do not interfere.
    const svg = chartWidget.locator('.recharts-wrapper svg').first()
    await expect(svg).toBeVisible({ timeout: 15000 })

    // Recharts should render plotted paths for the scoped widget.
    const areaCurves = chartWidget.locator('.recharts-area-curve')
    await expect(areaCurves.first()).toBeAttached({ timeout: 10000 })
    expect(await areaCurves.count()).toBeGreaterThan(0)
  })

  test('chart has axis labels', async ({ page }) => {
    await page.goto('/dashboard')

    const chartWidget = page.locator('.glass-card', { hasText: 'Fees Recorded' }).first()
    const svg = chartWidget.locator('.recharts-wrapper svg').first()
    await svg.waitFor({ timeout: 15000 })

    // Axis tick labels should exist within the fee chart widget.
    const axisTicks = chartWidget.locator('.recharts-cartesian-axis-tick-value')
    const tickCount = await axisTicks.count()
    expect(tickCount).toBeGreaterThan(0)
  })
})
