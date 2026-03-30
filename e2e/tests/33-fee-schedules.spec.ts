import { test, expect } from '@playwright/test'

test.describe('US-033: Fee Schedules', () => {
  test('fee schedules page loads at /fee-schedules', async ({ page }) => {
    await page.goto('/fee-schedules')
    await expect(page).toHaveURL(/\/fee-schedules$/)
    await expect(page.locator('h1')).toContainText('Fee Schedules')
  })

  test('Trade Marks category visible with items', async ({ page }) => {
    await page.goto('/fee-schedules')

    // Wait for categories to load
    await page.waitForTimeout(2000)

    // Category tabs should be visible (seeded data includes Trade Marks)
    const tradeMarksTab = page.getByText('Trade Marks', { exact: false }).first()
    await expect(tradeMarksTab).toBeVisible({ timeout: 10000 })
  })

  test('items table shows Description, Official Fee, Professional Fee columns', async ({ page }) => {
    await page.goto('/fee-schedules')

    // Wait for items to load
    await page.waitForTimeout(3000)

    // Table headers
    await expect(page.getByText('Description', { exact: false }).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Official Fee', { exact: false }).first()).toBeVisible()
    await expect(page.getByText('Professional Fee', { exact: false }).first()).toBeVisible()
  })

  test('admin can add new item inline', async ({ page }) => {
    await page.goto('/fee-schedules')

    // Wait for items to load
    await page.waitForTimeout(3000)

    // Click "Add item" button in a section (it's a small button with Plus icon + "Add item" text)
    const addButton = page.locator('button', { hasText: 'Add item' }).first()
    await expect(addButton).toBeVisible({ timeout: 10000 })
    await addButton.click()

    // Inline add row should appear with input fields
    // The description input has placeholder "Description\u2026" (unicode ellipsis)
    const descriptionInput = page.locator('input[placeholder="Description\u2026"]')
    await expect(descriptionInput).toBeVisible()

    // Fill in new item
    await descriptionInput.fill('E2E Test Fee Item')

    // Fill professional fee - the add row has 2 number inputs (official fee and professional fee)
    // The professional fee input is the second number input in the add row
    const addRow = descriptionInput.locator('xpath=ancestor::tr')
    const profFeeInput = addRow.locator('input[type="number"]').last()
    await profFeeInput.fill('1500')

    // Click the confirm/save button (Check icon) - first button in the add row's action cell
    const actionButtons = addRow.locator('button')
    await actionButtons.first().click()

    // The new item should now appear in the table
    await expect(page.getByText('E2E Test Fee Item').first()).toBeVisible({ timeout: 10000 })
  })

  test('admin can edit item inline', async ({ page }) => {
    await page.goto('/fee-schedules')

    // Wait for items to load
    await page.waitForTimeout(3000)

    // Hover over a row to reveal edit button, then click it
    const tableRows = page.locator('tbody tr')
    const firstDataRow = tableRows.first()
    await firstDataRow.hover()

    // Click the edit (pencil) button
    const editButton = firstDataRow.locator('.row-actions button').first()
    await editButton.click({ force: true })

    // Input fields should appear for editing
    const editInputs = page.locator('input[type="number"]')
    await expect(editInputs.first()).toBeVisible()

    // Cancel the edit (click the X button)
    const cancelButton = page.locator('button:has(svg)').filter({
      has: page.locator('svg'),
    })
    // Find the cancel button in the edit row
    const editRow = page.locator('tr').filter({
      has: page.locator('input[type="number"]'),
    })
    await editRow.locator('button').nth(1).click()
  })

  test('admin can delete item', async ({ page }) => {
    await page.goto('/fee-schedules')

    // Wait for items to load
    await page.waitForTimeout(3000)

    // Verify our test item exists
    await expect(page.getByText('E2E Test Fee Item').first()).toBeVisible({ timeout: 10000 })

    // Set up dialog handler for the confirm prompt
    page.on('dialog', (dialog) => dialog.accept())

    // Hover over the test item row to reveal action buttons (they have opacity: 0 by default)
    const testRow = page.locator('tr', { hasText: 'E2E Test Fee Item' })
    await testRow.hover()

    // Click the delete (Trash2) button - it's the last button in the row-actions div
    // Use force: true since the buttons are hidden with opacity: 0 until hover (CSS may not trigger in test)
    const deleteButton = testRow.locator('.row-actions button').last()
    await deleteButton.click({ force: true })

    // Item should be removed
    await expect(page.getByText('E2E Test Fee Item')).toBeHidden({ timeout: 10000 })
  })
})
