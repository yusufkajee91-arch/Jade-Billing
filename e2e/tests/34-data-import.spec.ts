import { test, expect } from '../helpers/console-capture'

test.describe('US-034: Data Import', () => {
  test('import page loads at /settings/import-data', async ({ page }) => {
    await page.goto('/settings/import-data')
    await expect(page).toHaveURL(/\/settings\/import-data$/)
    await expect(page.locator('h1')).toContainText('Import Data')
  })

  test('import type dropdown has 4 options', async ({ page }) => {
    await page.goto('/settings/import-data')

    // The select element should be visible
    const select = page.locator('select')
    await expect(select).toBeVisible({ timeout: 10000 })

    // Should have the placeholder + 4 import type options
    const options = select.locator('option')
    const count = await options.count()
    // 1 placeholder ("Choose an import type...") + 4 actual types = 5
    expect(count).toBe(5)

    // Verify specific option labels
    await expect(options.nth(1)).toContainText('Clients')
    await expect(options.nth(2)).toContainText('Matters')
    await expect(options.nth(3)).toContainText('Invoice History')
    await expect(options.nth(4)).toContainText('Unbilled Fees')
  })

  test('file upload input accepts .xlsx/.csv', async ({ page }) => {
    await page.goto('/settings/import-data')

    // Select an import type to reveal the file upload
    const select = page.locator('select')
    await select.selectOption('clients')

    // File input should exist (hidden but present)
    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeAttached()

    // Verify accepted file types
    const accept = await fileInput.getAttribute('accept')
    expect(accept).toContain('.xlsx')
    expect(accept).toContain('.csv')

    // The "Choose File" label should be visible
    await expect(page.getByText('Choose File')).toBeVisible()
  })

  test('import button is disabled without file', async ({ page }) => {
    await page.goto('/settings/import-data')

    // Select an import type
    const select = page.locator('select')
    await select.selectOption('clients')

    // Import button should be present but disabled
    const importButton = page.getByRole('button', { name: /^import$/i })
    await expect(importButton).toBeVisible()
    await expect(importButton).toBeDisabled()
  })

  test('verify results panel structure exists', async ({ page }) => {
    await page.goto('/settings/import-data')

    // Select each import type and verify the panel renders
    const importTypes = ['clients', 'matters', 'invoices', 'unbilled-fees']

    for (const type of importTypes) {
      const select = page.locator('select')
      await select.selectOption(type)

      // Description text should appear for the selected type
      await expect(
        page.locator('p', { hasText: /upload/i }).first(),
      ).toBeVisible()

      // Warning text should appear
      await expect(
        page.locator('p', { hasText: /skip|overwrite|duplicate|historical/i }).first(),
      ).toBeVisible()

      // Import button should be present
      await expect(
        page.getByRole('button', { name: /import/i }).first(),
      ).toBeVisible()
    }
  })

  test('unbilled-fees type shows Clear & Re-import button', async ({ page }) => {
    await page.goto('/settings/import-data')

    const select = page.locator('select')
    await select.selectOption('unbilled-fees')

    // The unbilled-fees type has a special "Clear & Re-import" button
    await expect(
      page.getByRole('button', { name: /clear.*re-import/i }),
    ).toBeVisible()
  })

  test('selecting different import types updates the panel', async ({ page }) => {
    await page.goto('/settings/import-data')

    // Select clients
    const select = page.locator('select')
    await select.selectOption('clients')
    await expect(page.getByText('client list Excel export')).toBeVisible()

    // Switch to matters
    await select.selectOption('matters')
    await expect(page.getByText('matter list Excel export')).toBeVisible()

    // Switch to invoices
    await select.selectOption('invoices')
    await expect(page.getByText('Invoiced Fees and Disbursements')).toBeVisible()

    // Switch to unbilled
    await select.selectOption('unbilled-fees')
    await expect(page.getByText('unbilled fees and disbursements')).toBeVisible()
  })
})
