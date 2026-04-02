import { test, expect } from '../helpers/console-capture'
import {
  createClient,
  createMatter,
  createFeeEntry,
  createDiaryEntry,
  createTrustEntry,
} from '../helpers/api-factories'
import { todayISO } from '../helpers/test-data'
import { ADMIN_USER } from '../helpers/auth'

test.describe('US-026: Dashboard', () => {
  let clientId: string
  let matterId: string

  test.beforeAll(async ({ request }) => {
    // Create client
    const client = await createClient(request, {
      clientName: 'Dashboard Test Client',
      clientCode: 'DTC',
      emailGeneral: 'dash@test.co.za',
    })
    clientId = client.id

    // Create matter
    const matter = await createMatter(request, {
      clientId,
      description: 'Dashboard test matter',
    })
    matterId = matter.id

    // Create fee entries (unbilled WIP)
    await createFeeEntry(request, {
      matterId,
      narration: 'Dashboard WIP consultation',
      billedMinutes: 90,
      rateCents: 200000,
    })

    // Create trust entry
    await createTrustEntry(request, {
      matterId,
      entryType: 'trust_receipt',
      amountCents: 10000000,
      narration: 'Trust deposit for dashboard test',
    })

    // Create diary entry for today
    await createDiaryEntry(request, {
      title: 'Dashboard diary task for today',
      matterId,
      dueDate: todayISO(),
    })
  })

  test('dashboard loads at /dashboard', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test('greeting shows user first name', async ({ page }) => {
    await page.goto('/dashboard')

    // The greeting contains the admin user's first name
    const greeting = page.locator('h1', { hasText: ADMIN_USER.firstName })
    await expect(greeting).toBeVisible()

    // Should contain a time-based greeting phrase
    const greetingText = await greeting.textContent()
    expect(
      greetingText?.includes('Good morning') ||
        greetingText?.includes('Good afternoon') ||
        greetingText?.includes('Good evening'),
    ).toBeTruthy()
  })

  test('KPI cards visible for admin', async ({ page }) => {
    await page.goto('/dashboard')

    // Scope KPI assertions to the Firm KPIs widget to avoid matching similarly named widgets.
    const firmKpis = page.locator('.glass-card', { hasText: 'Firm KPIs' }).first()
    await expect(firmKpis).toBeVisible({ timeout: 10000 })
    await expect(firmKpis.getByText('Held in Trust', { exact: true })).toBeVisible()
    await expect(firmKpis.getByText('Debtors Outstanding', { exact: true })).toBeVisible()
    await expect(firmKpis.getByText('Unsent Invoices', { exact: true })).toBeVisible()
    await expect(firmKpis.getByText('FICA Issues', { exact: true })).toBeVisible()
  })

  test('fee chart area renders with recharts SVG', async ({ page }) => {
    await page.goto('/dashboard')

    // The fee chart widget renders via recharts inside a ResponsiveContainer
    const chartSection = page.locator('.recharts-responsive-container, .recharts-wrapper').first()
    await expect(chartSection).toBeVisible({ timeout: 15000 })
  })

  test('calendar widget renders', async ({ page }) => {
    await page.goto('/dashboard')

    // Calendar widget should show day labels (Mon-start calendar with 2-letter abbreviations)
    await expect(page.getByText('Mo').first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Tu').first()).toBeVisible()
    await expect(page.getByText('We').first()).toBeVisible()
  })

  test('WIP card shows unbilled matters', async ({ page }) => {
    await page.goto('/dashboard')

    // Unbilled Work widget should be visible (header label is "Unbilled Work", title is "My WIP")
    const wipSection = page.getByText('My WIP').first()
    await expect(wipSection).toBeVisible({ timeout: 10000 })
  })

  test('diary entries card shows today tasks', async ({ page }) => {
    await page.goto('/dashboard')

    // Today's tasks widget (the heading text is "Today")
    const tasksSection = page.locator('h2', { hasText: 'Today' }).first()
    await expect(tasksSection).toBeVisible({ timeout: 10000 })

    // Our created diary entry should appear
    await expect(
      page.getByText('Dashboard diary task for today').first(),
    ).toBeVisible({ timeout: 10000 })
  })
})
