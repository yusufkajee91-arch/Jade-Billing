import { test, expect } from '@playwright/test'

test.describe('Firm Settings (admin)', () => {
  test('settings page loads with firm name', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByText('Firm Settings')).toBeVisible({ timeout: 5000 })
  })

  test('edit firm name, save, reload, verify', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByText('Firm Identity')).toBeVisible({ timeout: 5000 })

    // The firm name input uses {...register('firmName')} so has name="firmName"
    const firmNameInput = page.locator('input[name="firmName"]')
    await firmNameInput.clear()
    await firmNameInput.fill('Dolata & Co Test Firm')

    await page.getByRole('button', { name: /save settings/i }).first().click()

    // Reload and verify persistence
    await page.reload()
    await expect(page.locator('input[name="firmName"]')).toHaveValue('Dolata & Co Test Firm')

    // Restore original name
    await page.locator('input[name="firmName"]').clear()
    await page.locator('input[name="firmName"]').fill('Dolata & Co Attorneys')
    await page.getByRole('button', { name: /save settings/i }).first().click()
  })

  test('fill trust bank account fields, save, verify', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByText('Trust Bank Account')).toBeVisible({ timeout: 5000 })

    const trustAccountName = page.locator('input[name="trustBankAccountName"]')
    await trustAccountName.clear()
    await trustAccountName.fill('Dolata Trust Account')

    const trustAccountNumber = page.locator('input[name="trustBankAccountNumber"]')
    await trustAccountNumber.clear()
    await trustAccountNumber.fill('1234567890')

    const trustBankName = page.locator('input[name="trustBankName"]')
    await trustBankName.clear()
    await trustBankName.fill('FNB')

    const trustBranchCode = page.locator('input[name="trustBankBranchCode"]')
    await trustBranchCode.clear()
    await trustBranchCode.fill('250655')

    await page.getByRole('button', { name: /save settings/i }).first().click()

    await page.reload()
    await expect(page.locator('input[name="trustBankAccountNumber"]')).toHaveValue('1234567890')
  })

  test('fill business bank account fields, save, verify', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByText('Business Bank Account')).toBeVisible({ timeout: 5000 })

    const bizAccountName = page.locator('input[name="businessBankAccountName"]')
    await bizAccountName.clear()
    await bizAccountName.fill('Dolata Business Account')

    const bizAccountNumber = page.locator('input[name="businessBankAccountNumber"]')
    await bizAccountNumber.clear()
    await bizAccountNumber.fill('9876543210')

    const bizBankName = page.locator('input[name="businessBankName"]')
    await bizBankName.clear()
    await bizBankName.fill('FNB')

    const bizBranchCode = page.locator('input[name="businessBankBranchCode"]')
    await bizBranchCode.clear()
    await bizBranchCode.fill('250655')

    await page.getByRole('button', { name: /save settings/i }).first().click()

    await page.reload()
    await expect(page.locator('input[name="businessBankAccountNumber"]')).toHaveValue('9876543210')
  })

  test('toggle VAT registered, fill VAT number, save', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByText('VAT Registered')).toBeVisible({ timeout: 5000 })

    // The VAT Registered toggle is a Switch component near the "VAT Registered" text
    await page.getByText('VAT Registered').scrollIntoViewIfNeeded()
    // Find the switch within the VAT section (the container that holds "VAT Registered" text)
    const vatSection = page.locator('div').filter({ hasText: /^VAT Registered/ }).first()
    const vatSwitch = vatSection.locator('[role="switch"]')

    // Ensure it is checked
    const checkedState = await vatSwitch.getAttribute('aria-checked')
    if (checkedState !== 'true') {
      await vatSwitch.click()
    }

    const vatNumber = page.locator('input[name="vatRegistrationNumber"]')
    await vatNumber.clear()
    await vatNumber.fill('4123456789')

    await page.getByRole('button', { name: /save settings/i }).first().click()

    await page.reload()
    await expect(page.locator('input[name="vatRegistrationNumber"]')).toHaveValue('4123456789')
  })

  test('fee levels page loads with seeded levels, can create new', async ({ page }) => {
    await page.goto('/settings/fee-levels')
    // The fee levels table does not use .brand-table class — use generic table selector
    const table = page.locator('table')
    await expect(table).toBeVisible({ timeout: 5000 })

    // Should have seeded fee levels
    const rows = table.locator('tbody tr')
    await expect(rows).toHaveCount(4, { timeout: 5000 })

    // Create a new fee level
    await page.getByRole('button', { name: /new fee level/i }).click()
    // Sheet form uses <p style={fieldLabel}> labels and <Input> with placeholders
    await page.getByPlaceholder('Senior Attorney').fill('Specialist')
    await page.getByPlaceholder('850.00').fill('3500')
    await page.getByRole('button', { name: /create fee level/i }).click()

    await expect(page.getByText('Specialist')).toBeVisible({ timeout: 5000 })
  })

  test('posting codes page loads with seeded codes, can create new', async ({ page }) => {
    await page.goto('/settings/posting-codes')
    // The posting codes table uses inline styles (not .brand-table class)
    const table = page.locator('table')
    await expect(table).toBeVisible({ timeout: 10000 })

    // Should have 8 seeded posting codes — verify some known ones first
    await expect(page.getByRole('cell', { name: 'EMAIL', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'CONSULT', exact: true })).toBeVisible()
    const rows = table.locator('tbody tr')
    await expect(rows).toHaveCount(8, { timeout: 5000 })

    // Create a new posting code via the "New Posting Code" button
    await page.getByRole('button', { name: /new posting code/i }).click()

    // Wait for the sheet to open
    await expect(page.getByRole('heading', { name: 'New Posting Code' })).toBeVisible({ timeout: 5000 })

    // Fill in the form — placeholders from the PostingCodeForm
    await page.locator('input[name="code"]').fill('TEST01')
    await page.locator('input[name="description"]').fill('Test Posting Code')

    // Submit
    await page.getByRole('button', { name: /create posting code/i }).click()

    // Verify it appears in the table
    await expect(page.getByText('TEST01')).toBeVisible({ timeout: 5000 })
  })
})
