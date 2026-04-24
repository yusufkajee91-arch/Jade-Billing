import { test, expect } from '../helpers/console-capture'
import { FEE_EARNER_STORAGE } from '../helpers/auth'

test.describe('Fees chart Recorded/Billed toggle', () => {
  test('admin: API returns both series and toggle switches aria-pressed', async ({ page }) => {
    const chartResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url())
      return url.pathname === '/api/dashboard/fees-chart' && response.status() === 200
    })

    await page.goto('/dashboard')
    const response = await chartResponsePromise
    const body = await response.json()

    expect(body.series).toBeDefined()
    expect(Array.isArray(body.series.recorded)).toBe(true)
    expect(Array.isArray(body.series.billed)).toBe(true)

    const toggle = page.locator('[aria-label="Fee chart series"]')
    await expect(toggle).toBeVisible()

    const recordedBtn = toggle.getByRole('button', { name: 'Fees Recorded' })
    const billedBtn = toggle.getByRole('button', { name: 'Fees Billed' })

    await expect(recordedBtn).toHaveAttribute('aria-pressed', 'true')
    await expect(billedBtn).toHaveAttribute('aria-pressed', 'false')

    await billedBtn.click()
    await expect(billedBtn).toHaveAttribute('aria-pressed', 'true')
    await expect(recordedBtn).toHaveAttribute('aria-pressed', 'false')

    await recordedBtn.click()
    await expect(recordedBtn).toHaveAttribute('aria-pressed', 'true')
    await expect(billedBtn).toHaveAttribute('aria-pressed', 'false')
  })

  test('admin: all-earners chart (if present) exposes its own Recorded/Billed toggle', async ({ page }) => {
    await page.goto('/dashboard')

    const earnersToggle = page.locator('[aria-label="All earners chart series"]')
    const count = await earnersToggle.count()
    test.skip(count === 0, 'All Earners chart widget not in default dashboard layout')

    await expect(earnersToggle).toBeVisible()

    const recordedBtn = earnersToggle.getByRole('button', { name: 'Fees Recorded' })
    const billedBtn = earnersToggle.getByRole('button', { name: 'Fees Billed' })

    await expect(recordedBtn).toHaveAttribute('aria-pressed', 'true')
    await billedBtn.click()
    await expect(billedBtn).toHaveAttribute('aria-pressed', 'true')
    await expect(recordedBtn).toHaveAttribute('aria-pressed', 'false')
  })

  test.describe('fee earner view', () => {
    test.use({ storageState: FEE_EARNER_STORAGE })

    test('fee earner sees series toggle but no admin scope toggle', async ({ page }) => {
      await page.goto('/dashboard')

      const toggle = page.locator('[aria-label="Fee chart series"]')
      await expect(toggle).toBeVisible()

      const recordedBtn = toggle.getByRole('button', { name: 'Fees Recorded' })
      const billedBtn = toggle.getByRole('button', { name: 'Fees Billed' })

      await expect(recordedBtn).toBeVisible()
      await expect(billedBtn).toBeVisible()
      await expect(recordedBtn).toHaveAttribute('aria-pressed', 'true')

      await expect(page.getByRole('button', { name: 'My Fees' })).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'All Earners' })).toHaveCount(0)

      await billedBtn.click()
      await expect(billedBtn).toHaveAttribute('aria-pressed', 'true')
      await expect(recordedBtn).toHaveAttribute('aria-pressed', 'false')
    })
  })
})
