import { test, expect } from '@playwright/test'
import { createClient, createMatter } from '../helpers/api-factories'
import { uniqueCode, uniqueSuffix } from '../helpers/test-data'

test.describe('Practice Notes', () => {
  let matterId: string
  const suffix = uniqueSuffix()

  test.beforeAll(async ({ request }) => {
    const client = await createClient(request, {
      clientName: `Practice Notes Client ${suffix}`,
      clientCode: uniqueCode('PNC'),
      emailGeneral: 'pnc@example.com',
    })
    expect(client.id).toBeTruthy()
    const matter = await createMatter(request, {
      clientId: client.id,
      description: `Practice notes test matter ${suffix}`,
    })
    expect(matter.id).toBeTruthy()
    matterId = matter.id
  })

  test('matter detail page has practice notes section', async ({ page }) => {
    await page.goto(`/matters/${matterId}`)
    await page.getByRole('button', { name: /practice notes/i }).click()
    await expect(page.getByPlaceholder(/current status of this matter/i)).toBeVisible({ timeout: 5000 })
  })

  test('edit status note, blur, verify saved on reload', async ({ page }) => {
    await page.goto(`/matters/${matterId}`)
    await page.getByRole('button', { name: /practice notes/i }).click()

    const statusNote = page.getByPlaceholder(/current status of this matter/i)
    await statusNote.fill('Awaiting client documents')
    await statusNote.blur()

    // Allow debounced save to complete
    await page.waitForTimeout(1500)

    await page.reload()
    await page.getByRole('button', { name: /practice notes/i }).click()
    await expect(page.getByPlaceholder(/current status of this matter/i)).toHaveValue('Awaiting client documents')
  })

  test('add to-do item, check it, verify strikethrough', async ({ page }) => {
    await page.goto(`/matters/${matterId}`)
    await page.getByRole('button', { name: /practice notes/i }).click()

    const todoInput = page.getByPlaceholder(/add a to-do item/i)
    await todoInput.fill('Follow up with client')
    await todoInput.press('Enter')

    await expect(page.getByText('Follow up with client')).toBeVisible()

    // Check the to-do item
    const checkbox = page
      .locator('span')
      .filter({ hasText: 'Follow up with client' })
      .locator('xpath=..')
      .locator('input[type="checkbox"]')
    await checkbox.check()

    // Verify strikethrough styling
    const todoText = page.getByText('Follow up with client')
    await expect(todoText).toHaveCSS('text-decoration-line', /line-through/)
  })

  test('set allocation, verify saved', async ({ page }) => {
    await page.goto(`/matters/${matterId}`)
    await page.getByRole('button', { name: /practice notes/i }).click()

    const allocation = page.getByPlaceholder(/senior attorney/i)
    await allocation.fill('YK')
    await allocation.blur()

    await page.waitForTimeout(1500)
    await page.reload()
    await page.getByRole('button', { name: /practice notes/i }).click()
    await expect(page.getByPlaceholder(/senior attorney/i)).toHaveValue('YK')
  })

  test('change billing status dropdown, verify saved', async ({ page }) => {
    await page.goto(`/matters/${matterId}`)
    await page.getByRole('button', { name: /practice notes/i }).click()

    const billingStatus = page.locator('select').first()
    await billingStatus.selectOption('awaiting_payment')

    await page.waitForTimeout(1500)
    await page.reload()
    await page.getByRole('button', { name: /practice notes/i }).click()
    await expect(page.locator('select').first()).toHaveValue('awaiting_payment')
  })

  test('toggle LOE/FICA done, verify saved', async ({ page }) => {
    await page.goto(`/matters/${matterId}`)
    await page.getByRole('button', { name: /practice notes/i }).click()

    const loeFicaDone = page.getByLabel(/loe.*fica done/i)
    await loeFicaDone.click()

    await page.waitForTimeout(1500)
    await page.reload()
    await page.getByRole('button', { name: /practice notes/i }).click()

    await expect(page.getByLabel(/loe.*fica done/i)).toBeChecked()
  })
})
