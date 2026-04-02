import { test, expect } from '../helpers/console-capture'
import { createClient, createMatter, createDiaryEntry } from '../helpers/api-factories'
import { todayISO, uniqueCode, uniqueSuffix } from '../helpers/test-data'

test.describe('US-031: Diary Calendar', () => {
  let clientId: string
  let matterId: string
  let matterCode: string
  let diaryEntryId: string
  let matterDescription: string
  let existingEntryTitle: string
  let otherDayEntryTitle: string
  let createdEntryTitle: string

  test.beforeAll(async ({ request }) => {
    const suffix = uniqueSuffix()
    const client = await createClient(request, {
      clientName: `Diary Test Client ${suffix}`,
      clientCode: uniqueCode('DRY'),
      emailGeneral: `diary-${suffix}@test.co.za`,
    })
    clientId = client.id

    matterDescription = `Diary test matter ${suffix}`
    const matter = await createMatter(request, {
      clientId,
      description: matterDescription,
    })
    matterId = matter.id
    matterCode = matter.matterCode
    existingEntryTitle = `Existing diary entry for test ${suffix}`
    otherDayEntryTitle = `Diary entry on another day ${suffix}`
    createdEntryTitle = `E2E created diary entry ${suffix}`

    // Create diary entries for today
    const entry = await createDiaryEntry(request, {
      title: existingEntryTitle,
      matterId,
      dueDate: todayISO(),
    })
    diaryEntryId = entry.id

    // Create a diary entry for a different day this month
    const now = new Date()
    const otherDay = now.getDate() >= 15 ? 5 : 20
    const otherDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(otherDay).padStart(2, '0')}`
    await createDiaryEntry(request, {
      title: otherDayEntryTitle,
      matterId,
      dueDate: otherDate,
    })
  })

  test('diary page loads at /diary', async ({ page }) => {
    await page.goto('/diary')
    await expect(page).toHaveURL(/\/diary$/)
    await expect(page.locator('h1')).toContainText('Diary')
  })

  test('calendar renders with correct month', async ({ page }) => {
    await page.goto('/diary')

    // Calendar should show current month name
    const now = new Date()
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ]
    const currentMonth = monthNames[now.getMonth()]

    await expect(page.getByText(currentMonth).first()).toBeVisible({ timeout: 10000 })

    // Day labels should be visible (Monday-start calendar)
    await expect(page.getByText('Mon').first()).toBeVisible()
    await expect(page.getByText('Tue').first()).toBeVisible()
    await expect(page.getByText('Wed').first()).toBeVisible()
    await expect(page.getByText('Thu').first()).toBeVisible()
    await expect(page.getByText('Fri').first()).toBeVisible()
  })

  test('month navigation (prev/next) works', async ({ page }) => {
    await page.goto('/diary')

    const now = new Date()
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ]
    const currentMonth = monthNames[now.getMonth()]
    await expect(page.getByText(currentMonth).first()).toBeVisible({ timeout: 10000 })

    // The month navigation has prev/next buttons flanking the month name heading.
    // The month name is inside an h2 between the two nav buttons.
    const monthHeading = page.locator('h2', { hasText: currentMonth })
    const navContainer = monthHeading.locator('..')
    const prevButton = navContainer.locator('button').first()
    const nextButton = navContainer.locator('button').last()

    // Click next month
    await nextButton.click()

    // Should show next month
    const nextMonthIdx = (now.getMonth() + 1) % 12
    const nextMonth = monthNames[nextMonthIdx]
    await expect(page.getByText(nextMonth).first()).toBeVisible({ timeout: 5000 })

    // Click previous month to go back to current month
    const updatedMonthHeading = page.locator('h2', { hasText: nextMonth })
    const updatedNavContainer = updatedMonthHeading.locator('..')
    await updatedNavContainer.locator('button').first().click()

    // Should be back to current month
    await expect(page.getByText(currentMonth).first()).toBeVisible({ timeout: 5000 })
  })

  test('click a day and verify entries show', async ({ page }) => {
    await page.goto('/diary')

    // Today is pre-selected by default, so entries should already be visible.
    // Click today's date to deselect first, then click again to re-select and
    // verify that entries are shown.
    const now = new Date()
    const todayNum = now.getDate().toString()
    const dayCell = page.locator(`text="${todayNum}"`).first()

    // Deselect today
    await dayCell.click()
    await page.waitForTimeout(300)
    // Re-select today
    await dayCell.click()

    // Our diary entry should appear in the entries panel
    await expect(
      page.getByText(existingEntryTitle).first(),
    ).toBeVisible({ timeout: 10000 })
  })

  test('create new diary entry via form', async ({ page }) => {
    await page.goto('/diary')

    // Click "New Entry" button (styled as inline button, not a role="button")
    const newButton = page.locator('button', { hasText: 'New Entry' })
    await newButton.click()

    // Form should appear
    await expect(page.getByText('New Diary Entry')).toBeVisible()

    // Fill in the title input (first text input in the form, labelled "Title *")
    const titleInput = page.locator('input[placeholder="e.g. File lodgement deadline"]')
    await titleInput.fill(createdEntryTitle)

    // Search and select matter (placeholder uses unicode ellipsis)
    const matterInput = page.locator('input[placeholder="Search matters\u2026"]')
    await matterInput.fill(matterDescription)
    // Wait for the dropdown to appear and click the matter option
    await page.getByRole('button', { name: new RegExp(matterDescription) }).first().click({ timeout: 10000 })

    // Set due date
    const dueDateInput = page.locator('input[type="date"]').first()
    await dueDateInput.fill(todayISO())

    // Submit - the button text is "Add Entry"
    await page.getByRole('button', { name: 'Add Entry', exact: true }).click()

    // Entry should appear after save
    await expect(
      page.getByText(createdEntryTitle).first(),
    ).toBeVisible({ timeout: 10000 })
  })

  test('toggle entry complete/incomplete', async ({ page }) => {
    await page.goto('/diary')

    // Today is pre-selected by default, so entries for today should already be visible
    // in the day detail panel on the right side
    await expect(
      page.getByText(existingEntryTitle).first(),
    ).toBeVisible({ timeout: 10000 })

    // Find the toggle button next to our entry using the title attribute
    // The EntryCard has a button with title="Mark complete" or title="Mark incomplete"
    const entryCard = page.locator('div').filter({
      has: page.getByText(existingEntryTitle),
    }).filter({
      has: page.locator('button[title="Mark complete"], button[title="Mark incomplete"]'),
    }).first()
    const toggleButton = entryCard.locator('button[title="Mark complete"], button[title="Mark incomplete"]').first()
    await toggleButton.click()

    // After toggling, wait for the API response to update the entry
    await page.waitForTimeout(1500)

    // Toggle back
    const toggleButton2 = entryCard.locator('button[title="Mark complete"], button[title="Mark incomplete"]').first()
    await toggleButton2.click()
  })

  test('delete entry', async ({ page, request }) => {
    const deleteEntryTitle = `E2E delete diary entry ${uniqueSuffix()}`
    await createDiaryEntry(request, {
      title: deleteEntryTitle,
      matterId,
      dueDate: todayISO(),
    })

    await page.goto('/diary')

    // Today is pre-selected by default, so entries for today should already be visible
    await expect(
      page.getByText(deleteEntryTitle).first(),
    ).toBeVisible({ timeout: 10000 })

    // Set up dialog handler for the confirm prompt
    page.on('dialog', (dialog) => dialog.accept())

    // Find the entry card containing our text, then find the Trash2 (delete) button
    // The EntryCard has edit (Pencil) and delete (Trash2) buttons as the last two buttons
    const entryTitle = page.locator('p').filter({ hasText: deleteEntryTitle }).first()
    const entryCardDiv = entryTitle.locator(
      'xpath=ancestor::div[.//button[@title="Mark complete" or @title="Mark incomplete"]][1]',
    )
    const deletePromise = page.waitForResponse(
      (response) => response.url().includes('/api/diary/') && response.request().method() === 'DELETE',
      { timeout: 10000 },
    )
    // Buttons in the card are: toggle, edit, delete
    const deleteButton = entryCardDiv.locator('button').nth(2)
    await deleteButton.click()
    await deletePromise

    // Entry should be removed
    await expect(
      page.getByText(deleteEntryTitle).first(),
    ).toBeHidden({ timeout: 10000 })
  })
})
