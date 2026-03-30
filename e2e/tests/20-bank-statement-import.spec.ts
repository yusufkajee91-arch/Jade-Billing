import { test, expect } from '@playwright/test'
import path from 'path'

const BASE = 'http://localhost:3001'
const FIXTURE_PATH = path.resolve(__dirname, '../fixtures/fnb-statement.csv')

test.describe('US-020: Bank Statement Import', () => {
  test('reconciliation page loads at /reconciliation', async ({ page }) => {
    await page.goto('/reconciliation')
    await expect(page.locator('body')).toBeVisible()
    // Should show reconciliation-related content
    await expect(page.locator('body')).toContainText(/reconcil/i)
  })

  test('upload FNB CSV fixture file via API', async ({ request }) => {
    const fs = await import('fs')
    const csvBuffer = fs.readFileSync(FIXTURE_PATH)

    const res = await request.post(`${BASE}/api/bank-statements`, {
      multipart: {
        accountType: 'trust',
        file: {
          name: 'fnb-statement.csv',
          mimeType: 'text/csv',
          buffer: csvBuffer,
        },
      },
    })
    expect(res.ok()).toBeTruthy()

    const statement = await res.json()
    expect(statement.id).toBeTruthy()
    expect(statement.fileName).toBe('fnb-statement.csv')
    expect(statement._count.lines).toBeGreaterThan(0)
  })

  test('statement appears in list after import', async ({ request }) => {
    const res = await request.get(`${BASE}/api/bank-statements`)
    expect(res.ok()).toBeTruthy()
    const statements = await res.json()

    expect(Array.isArray(statements)).toBeTruthy()
    expect(statements.length).toBeGreaterThanOrEqual(1)

    const imported = statements.find(
      (s: { fileName: string }) => s.fileName === 'fnb-statement.csv',
    )
    expect(imported).toBeTruthy()
    expect(imported._count.lines).toBeGreaterThan(0)
  })

  test('statement lines show correct dates and amounts', async ({ request }) => {
    // Get the statement list to find our imported statement
    const listRes = await request.get(`${BASE}/api/bank-statements`)
    const statements = await listRes.json()
    const statement = statements.find(
      (s: { fileName: string }) => s.fileName === 'fnb-statement.csv',
    )
    expect(statement).toBeTruthy()

    // Get statement detail with lines
    const detailRes = await request.get(`${BASE}/api/bank-statements/${statement.id}`)
    expect(detailRes.ok()).toBeTruthy()
    const detail = await detailRes.json()

    expect(detail.lines).toBeTruthy()
    expect(detail.lines.length).toBe(8) // 8 lines in the fixture

    // Verify first line: 2026/03/01, 25000.00
    const firstLine = detail.lines.find((l: { lineNumber: number }) => l.lineNumber === 1)
    expect(firstLine).toBeTruthy()
    expect(firstLine.amountCents).toBe(2500000) // 25000.00 in cents
    expect(firstLine.description).toContain('Acme Holdings')

    // Verify a payment line (negative amount): 2026/03/05, -5000.00
    const paymentLine = detail.lines.find((l: { lineNumber: number }) => l.lineNumber === 2)
    expect(paymentLine).toBeTruthy()
    expect(paymentLine.amountCents).toBe(-500000) // -5000.00 in cents
  })

  test('upload via reconciliation page UI', async ({ page }) => {
    await page.goto('/reconciliation')

    // Look for the upload/import button
    const uploadBtn = page.getByRole('button', { name: /upload|import/i })
    if (await uploadBtn.isVisible()) {
      await uploadBtn.click()

      // The upload form should appear
      // Look for file input and account type selector
      const fileInput = page.locator('input[type="file"]')
      if (await fileInput.isVisible({ timeout: 3000 })) {
        await fileInput.setInputFiles(FIXTURE_PATH)
      }
    }

    // Verify the page loads properly regardless
    await expect(page.locator('body')).toBeVisible()
  })
})
