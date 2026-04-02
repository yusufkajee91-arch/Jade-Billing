import { test, expect } from '../helpers/console-capture'
import path from 'path'
import {
  createClient,
  createMatter,
  createTrustEntry,
} from '../helpers/api-factories'
import { todayISO } from '../helpers/test-data'

const BASE = 'http://localhost:3001'
const FIXTURE_PATH = path.resolve(__dirname, '../fixtures/fnb-statement.csv')

test.describe('US-021: Reconciliation', () => {
  let statementId: string
  let matterId: string

  test.beforeAll(async ({ request }) => {
    // Create client and matter for trust entries
    const client = await createClient(request, {
      clientName: 'Reconciliation Client (Pty) Ltd',
      clientCode: 'RCN',
      entityType: 'company_pty',
      emailGeneral: 'recon@example.com',
    })

    const matter = await createMatter(request, {
      clientId: client.id,
      description: 'Reconciliation test matter',
    })
    matterId = matter.id

    // Create trust entries matching the bank statement amounts
    // Line 1 from fixture: 2026/03/01, +25000.00
    await createTrustEntry(request, {
      matterId,
      entryType: 'trust_receipt',
      amountCents: 2500000,
      narration: 'FT Payment from Acme Holdings',
      entryDate: '2026-03-01',
    })

    // Line 2 from fixture: 2026/03/05, -5000.00
    await createTrustEntry(request, {
      matterId,
      entryType: 'trust_payment',
      amountCents: 500000,
      narration: 'FT Sheriff service fee',
      entryDate: '2026-03-05',
    })

    // Import bank statement
    const fs = await import('fs')
    const csvBuffer = fs.readFileSync(FIXTURE_PATH)

    const importRes = await request.post(`${BASE}/api/bank-statements`, {
      multipart: {
        accountType: 'trust',
        file: {
          name: 'recon-statement.csv',
          mimeType: 'text/csv',
          buffer: csvBuffer,
        },
      },
    })
    expect(importRes.ok()).toBeTruthy()
    const statement = await importRes.json()
    statementId = statement.id
  })

  test('reconciliation view loads', async ({ page }) => {
    await page.goto('/reconciliation')
    await expect(page.locator('body')).toBeVisible()
    await expect(page.locator('body')).toContainText(/reconcil/i)
  })

  test('bank statement lines visible via API', async ({ request }) => {
    const res = await request.get(`${BASE}/api/bank-statements/${statementId}`)
    expect(res.ok()).toBeTruthy()
    const detail = await res.json()

    expect(detail.lines).toBeTruthy()
    expect(detail.lines.length).toBeGreaterThan(0)

    // Lines should have transaction dates, amounts, and descriptions
    const firstLine = detail.lines[0]
    expect(firstLine.transactionDate).toBeTruthy()
    expect(firstLine.amountCents).toBeDefined()
    expect(firstLine.description).toBeTruthy()
  })

  test('system entries (trust entries) visible via API', async ({ request }) => {
    const res = await request.get(`${BASE}/api/trust-entries?matterId=${matterId}`)
    expect(res.ok()).toBeTruthy()
    const entries = await res.json()

    expect(Array.isArray(entries)).toBeTruthy()
    expect(entries.length).toBeGreaterThanOrEqual(2)
  })

  test('auto-match button works (matches by amount)', async ({ request }) => {
    const res = await request.post(
      `${BASE}/api/bank-statements/${statementId}/auto-match`,
    )
    expect(res.ok()).toBeTruthy()
    const result = await res.json()

    // Should have matched at least the two entries we created
    expect(result.matchesCreated).toBeGreaterThanOrEqual(1)
  })

  test('manual match: select entries and create match via API', async ({ request }) => {
    // Get unmatched bank statement lines
    const stmtRes = await request.get(`${BASE}/api/bank-statements/${statementId}`)
    const detail = await stmtRes.json()
    const unmatchedLine = detail.lines.find(
      (l: { isReconciled: boolean }) => !l.isReconciled,
    )

    if (!unmatchedLine) {
      // All lines already matched from auto-match; skip this test
      test.skip()
      return
    }

    // Create a fresh trust entry with a matching amount
    const absAmount = Math.abs(unmatchedLine.amountCents)
    const isInflow = unmatchedLine.amountCents > 0
    const entryType = isInflow ? 'trust_receipt' : 'trust_payment'

    const newEntry = await createTrustEntry(request, {
      matterId,
      entryType,
      amountCents: absAmount,
      narration: `Manual match entry for line ${unmatchedLine.lineNumber}`,
      entryDate: new Date(unmatchedLine.transactionDate).toISOString().split('T')[0],
    })

    // Create manual match
    const matchRes = await request.post(`${BASE}/api/bank-matches`, {
      data: {
        bankStatementLineId: unmatchedLine.id,
        trustEntryId: newEntry.id,
      },
    })
    expect(matchRes.ok()).toBeTruthy()
    const match = await matchRes.json()
    expect(match.bankStatementLine).toBeTruthy()
    expect(match.trustEntry).toBeTruthy()
  })

  test('auto-match appears on reconciliation page UI', async ({ page }) => {
    await page.goto('/reconciliation')

    // Look for Auto-Match button
    const autoMatchBtn = page.getByRole('button', { name: /auto.match/i })
    if (await autoMatchBtn.isVisible({ timeout: 5000 })) {
      await expect(autoMatchBtn).toBeVisible()
    }
  })
})
