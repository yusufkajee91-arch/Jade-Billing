import { test, expect } from '../helpers/console-capture'

test.describe('Authentication and App Scaffold', () => {
  test.describe('Login page', () => {
    test.use({ storageState: { cookies: [], origins: [] } })

    test('valid login redirects to /dashboard', async ({ page }) => {
      await page.goto('/login')
      await page.getByLabel('Email').fill('admin@dcco.law')
      await page.getByLabel('Password').fill('Admin1234!')
      await page.getByRole('button', { name: 'Sign In' }).click()
      await page.waitForURL('**/dashboard')
      await expect(page).toHaveURL(/\/dashboard$/)
    })

    test('invalid credentials shows error message', async ({ page }) => {
      await page.goto('/login')
      await page.getByLabel('Email').fill('admin@dcco.law')
      await page.getByLabel('Password').fill('wrong-password')
      await page.getByRole('button', { name: 'Sign In' }).click()
      await expect(page.getByText('Invalid email address or password')).toBeVisible()
    })

    test('unauthenticated user is redirected to /login', async ({ page }) => {
      await page.goto('/dashboard')
      await page.waitForURL('**/login**')
      await expect(page).toHaveURL(/\/login/)
    })
  })

  test.describe('Authenticated scaffold', () => {
    // Uses default admin storage state

    test('sidebar has expected nav sections', async ({ page }) => {
      await page.goto('/dashboard')
      const sidebar = page.locator('aside')

      // Nav group headings are <p> elements with exact text
      await expect(sidebar.getByText('Practice', { exact: true })).toBeVisible()
      await expect(sidebar.getByText('Billing', { exact: true })).toBeVisible()
      await expect(sidebar.getByText('Accounts', { exact: true })).toBeVisible()
      await expect(sidebar.getByText('Compliance', { exact: true })).toBeVisible()

      // Verify key nav links exist
      await expect(sidebar.getByRole('link', { name: 'Dashboard' })).toBeVisible()
      await expect(sidebar.getByRole('link', { name: 'Matters' })).toBeVisible()
      await expect(sidebar.getByRole('link', { name: 'Clients' })).toBeVisible()
      await expect(sidebar.getByRole('link', { name: 'My Time Sheet' })).toBeVisible()
      await expect(sidebar.getByRole('link', { name: 'Diary' })).toBeVisible()
      await expect(sidebar.getByRole('link', { name: 'Invoicing' })).toBeVisible()
      await expect(sidebar.getByRole('link', { name: 'Trust Account' })).toBeVisible()
      await expect(sidebar.getByRole('link', { name: 'Business Account' })).toBeVisible()
      await expect(sidebar.getByRole('link', { name: 'Bank Recon' })).toBeVisible()
      await expect(sidebar.getByRole('link', { name: 'FICA' })).toBeVisible()
      await expect(sidebar.getByRole('link', { name: 'Reports' })).toBeVisible()
      await expect(sidebar.getByRole('link', { name: 'Settings' })).toBeVisible()
    })

    test('FAB "Record Time" is visible', async ({ page }) => {
      await page.goto('/dashboard')
      const fab = page.getByRole('button', { name: /record time/i })
      await expect(fab).toBeVisible()
      await expect(fab).toContainText(/record time/i)
    })

    test('Cmd+K opens command palette dialog', async ({ page }) => {
      await page.goto('/dashboard')
      await page.locator('body').click()
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k')
      // Command palette is a Dialog containing a cmdk Command.Input
      // The placeholder contains a unicode ellipsis: "Search matters, clients, actions\u2026"
      const paletteInput = page.getByPlaceholder('Search matters, clients, actions\u2026')
      await expect(paletteInput).toBeVisible({ timeout: 5000 })
    })

    test('logout redirects to /login', async ({ page }) => {
      await page.goto('/dashboard')
      // The sign-out button is in the sidebar with aria-label="Sign out"
      await page.getByLabel('Sign out').click()
      await page.waitForURL('**/login')
      await expect(page).toHaveURL(/\/login$/)
    })
  })
})
