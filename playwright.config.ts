import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'

const envFile = process.env.E2E_ENV_FILE ?? '.env.test'
dotenv.config({ path: envFile })

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 15_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: process.env.NEXTAUTH_URL || 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'setup', testDir: './e2e', testMatch: /global-setup\.ts/ },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
    },
  ],

  webServer: {
    command: `npx dotenv -e ${envFile} -- npx next dev --port 3001`,
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
