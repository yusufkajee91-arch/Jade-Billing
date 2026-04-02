import { test, expect } from '../helpers/console-capture'
import { uniqueSuffix } from '../helpers/test-data'

test.describe('User Management (admin)', () => {
  const suffix = uniqueSuffix()
  const managedUser = {
    firstName: 'Managed',
    lastName: `Attorney ${suffix.slice(-4)}`,
    email: `managed.attorney.${suffix}@dcco.law`,
    initials: 'MA',
  }
  const user = {
    firstName: 'Test',
    lastName: `Attorney ${suffix.slice(-4)}`,
    email: `test.attorney.${suffix}@dcco.law`,
    initials: 'TA',
  }

  test.beforeAll(async ({ request }) => {
    const res = await request.post('http://localhost:3001/api/users', {
      data: {
        firstName: managedUser.firstName,
        lastName: managedUser.lastName,
        email: managedUser.email,
        initials: managedUser.initials,
        role: 'fee_earner',
        password: 'TestPass1234!',
        isActive: true,
      },
    })
    expect(res.ok()).toBeTruthy()
  })

  test('navigate to /settings/users and users table loads', async ({ page }) => {
    await page.goto('/settings/users')
    await expect(page.locator('.brand-table')).toBeVisible({ timeout: 10000 })
    // At minimum the seeded admin user should appear
    await expect(page.getByText('admin@dcco.law')).toBeVisible()
  })

  test('create new user with all fields, verify appears in table', async ({ page }) => {
    await page.goto('/settings/users')
    await expect(page.locator('.brand-table')).toBeVisible({ timeout: 10000 })

    // The "New User" button is a styled <button> with text "+ New User"
    await page.getByRole('button', { name: /new user/i }).click()

    // Wait for the sheet to open — sheet title says "Add User"
    await expect(page.getByRole('heading', { name: 'Add User' })).toBeVisible({ timeout: 5000 })

    // Form inputs use register() so target by placeholder
    await page.locator('input[name="firstName"]').fill(user.firstName)
    await page.locator('input[name="lastName"]').fill(user.lastName)
    await page.locator('input[name="email"]').fill(user.email)
    await page.locator('input[name="initials"]').fill(user.initials)
    // Password for new user uses placeholder "Minimum 8 characters"
    await page.getByPlaceholder('Minimum 8 characters').fill('TestPass1234!')

    // The default role is "fee_earner" (Fee Earner), no need to change it

    // Submit — the button text is "Create User" (with CSS uppercase transform)
    await page.getByRole('button', { name: /create user/i }).click()

    // Verify user appears in the table after sheet closes
    await expect(page.getByText(user.email)).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(`${user.firstName} ${user.lastName}`)).toBeVisible()
  })

  test('edit user name, verify persistence', async ({ page }) => {
    await page.goto('/settings/users')
    await expect(page.locator('.brand-table')).toBeVisible({ timeout: 10000 })

    // Click the pencil edit button — aria-label is "Edit Test Attorney"
    await page.getByLabel(`Edit ${managedUser.firstName} ${managedUser.lastName}`).click()

    // Wait for the sheet to open — sheet title says "Edit User"
    await expect(page.getByRole('heading', { name: 'Edit User' })).toBeVisible({ timeout: 5000 })

    // Clear and fill first name
    const firstNameInput = page.locator('input[name="firstName"]')
    await firstNameInput.clear()
    await firstNameInput.fill('Updated')

    const updateResponsePromise = page.waitForResponse((response) =>
      response.request().method() === 'PATCH' &&
      /\/api\/users\/[^/]+$/.test(response.url())
    )
    const usersRefreshPromise = page.waitForResponse((response) =>
      response.request().method() === 'GET' &&
      /\/api\/users$/.test(response.url())
    )

    // Submit — the button text is "Update User"
    await page.getByRole('button', { name: /update user/i }).click()
    const updateResponse = await updateResponsePromise
    expect(updateResponse.ok()).toBeTruthy()
    expect((await usersRefreshPromise).ok()).toBeTruthy()
    await expect(page.getByText(`Updated ${managedUser.lastName}`)).toBeVisible({ timeout: 10000 })

    // Reload and verify
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(`Updated ${managedUser.lastName}`)).toBeVisible({ timeout: 10000 })
  })

  test('deactivate user, verify status changes', async ({ page }) => {
    await page.goto('/settings/users')
    await expect(page.locator('.brand-table')).toBeVisible({ timeout: 10000 })
    const managedUserRow = page.locator('tr').filter({ hasText: managedUser.email })
    await expect(managedUserRow).toBeVisible({ timeout: 10000 })

    // Click the deactivate button — aria-label is "Deactivate Updated"
    // (aria-label uses firstName only: `Deactivate ${user.firstName}`)
    const deactivateResponsePromise = page.waitForResponse((response) =>
      response.request().method() === 'PATCH' &&
      /\/api\/users\/[^/]+$/.test(response.url())
    )
    const usersRefreshPromise = page.waitForResponse((response) =>
      response.request().method() === 'GET' &&
      /\/api\/users$/.test(response.url())
    )
    const currentFirstName = (await managedUserRow.locator('td').first().innerText()).split(' ')[0]
    await page.getByLabel(`Deactivate ${currentFirstName}`).click()
    const deactivateResponse = await deactivateResponsePromise
    expect(deactivateResponse.ok()).toBeTruthy()
    expect((await usersRefreshPromise).ok()).toBeTruthy()
    await expect(managedUserRow.getByText('Inactive')).toBeVisible({ timeout: 10000 })

    // Supabase-backed runs are slower; reload to ensure the updated status has round-tripped.
    await page.reload()
    await page.waitForLoadState('networkidle')

    const updatedUserRow = page.locator('tr').filter({ hasText: managedUser.email })
    await expect(updatedUserRow.getByText('Inactive')).toBeVisible({ timeout: 5000 })
  })
})

test.describe('User Management (fee earner access denied)', () => {
  test.use({ storageState: 'e2e/.auth/fee-earner.json' })

  test('fee earner cannot access /settings/users', async ({ page }) => {
    await page.goto('/settings/users')
    // Should be redirected or see an access-denied message
    await expect(page).not.toHaveURL(/\/settings\/users$/)
  })
})

test.describe('User Management (assistant access denied)', () => {
  test.use({ storageState: 'e2e/.auth/assistant.json' })

  test('assistant cannot access /settings/users', async ({ page }) => {
    await page.goto('/settings/users')
    await expect(page).not.toHaveURL(/\/settings\/users$/)
  })
})
