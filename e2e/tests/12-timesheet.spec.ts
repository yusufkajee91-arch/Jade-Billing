import { test, expect } from '@playwright/test'
import { createClient, createMatter, createFeeEntry } from '../helpers/api-factories'
import { uniqueCode, uniqueSuffix } from '../helpers/test-data'

test.describe('Timesheet', () => {
  let mondayEntry: string
  let tuesdayEntry: string
  let wednesdayEntry: string
  let timesheetMatterDescription: string

  test.beforeAll(async ({ request }) => {
    const suffix = uniqueSuffix()
    const client = await createClient(request, {
      clientName: `Timesheet Client ${suffix}`,
      clientCode: uniqueCode('TSC'),
      emailGeneral: `timesheet-${suffix}@example.com`,
    })
    const matter = await createMatter(request, {
      clientId: client.id,
      description: `Timesheet test matter ${suffix}`,
    })
    timesheetMatterDescription = `Timesheet test matter ${suffix}`
    mondayEntry = `Monday research task ${suffix}`
    tuesdayEntry = `Tuesday drafting session ${suffix}`
    wednesdayEntry = `Wednesday client meeting ${suffix}`

    const today = new Date()
    const dayOfWeek = today.getDay()

    // Create entries across the current week
    // Monday of current week
    const monday = new Date(today)
    monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7))

    await createFeeEntry(request, {
      matterId: matter.id,
      narration: mondayEntry,
      entryType: 'time',
      billedMinutes: 120,
      rateCents: 200000,
      entryDate: monday.toISOString().split('T')[0],
    })

    const tuesday = new Date(monday)
    tuesday.setDate(monday.getDate() + 1)
    await createFeeEntry(request, {
      matterId: matter.id,
      narration: tuesdayEntry,
      entryType: 'time',
      billedMinutes: 180,
      rateCents: 200000,
      entryDate: tuesday.toISOString().split('T')[0],
    })

    const wednesday = new Date(monday)
    wednesday.setDate(monday.getDate() + 2)
    await createFeeEntry(request, {
      matterId: matter.id,
      narration: wednesdayEntry,
      entryType: 'time',
      billedMinutes: 60,
      rateCents: 200000,
      entryDate: wednesday.toISOString().split('T')[0],
    })
  })

  test('timesheet page loads at /timesheet', async ({ page }) => {
    await page.goto('/timesheet')
    await expect(page).toHaveURL(/\/timesheet$/)
    // Page should have loaded with content
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 })
  })

  test('shows entries grouped by day', async ({ page }) => {
    await page.goto('/timesheet')
    const main = page.locator('main')
    await expect(main).toBeVisible({ timeout: 10000 })
    await expect(main).toContainText(timesheetMatterDescription)
    await expect(main).toContainText(mondayEntry)
    await expect(main).toContainText(tuesdayEntry)
    await expect(main).toContainText(wednesdayEntry)
    await expect(main).toContainText(/Monday|Tuesday|Wednesday/i)
  })

  test('week navigation works', async ({ page }) => {
    await page.goto('/timesheet')
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 })

    // Navigation uses icon-only buttons with inline styles
    // The header contains a navigation group with two buttons around a date label
    // The ChevronLeft and ChevronRight are rendered inside buttons with style padding:6, borderRadius:8
    // Use the page-dark-header container to scope the nav buttons
    const header = page.locator('.page-dark-header')
    const periodLabel = header.locator('span').filter({ hasText: /\d{1,2}\s\w{3}\s[-–]\s\d{1,2}\s\w{3}/ }).first()
    const initialLabel = (await periodLabel.textContent())?.trim()

    const buttons = header.getByRole('button')
    const previousButton = buttons.nth(2)
    const nextButton = buttons.nth(3)

    // Click the first SVG button (ChevronLeft = previous)
    await previousButton.click()
    await expect(periodLabel).not.toHaveText(initialLabel ?? '', { timeout: 5000 })
    await expect(header.getByRole('button', { name: 'Today' })).toBeVisible()

    // Click the second SVG button (ChevronRight = next)
    await nextButton.click()
    await expect(periodLabel).toHaveText(initialLabel ?? '', { timeout: 5000 })
    await expect(header.getByRole('button', { name: 'Today' })).toHaveCount(0)

    // Entries should be visible again
    const main = page.locator('main')
    await expect(main).toContainText(mondayEntry)
    await expect(main).toContainText(tuesdayEntry)
    await expect(main).toContainText(wednesdayEntry)
  })

  test('day totals shown', async ({ page }) => {
    await page.goto('/timesheet')
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 })

    // Day totals show hours/minutes via formatMinutes() which outputs "Xh XX min" or "Xh" or "X min"
    // and currency amounts via formatCurrency() which outputs "R X,XXX.XX"
    // Match any of: "2h", "30 min", "1h 30 min"
    await expect(
      page.getByText(/\d+h\s*\d*\s*min|\d+h|\d+\s*min/).first()
    ).toBeVisible({ timeout: 5000 })
  })
})
