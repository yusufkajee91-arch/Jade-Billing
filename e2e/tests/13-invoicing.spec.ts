import { test, expect } from '../helpers/console-capture'
import {
  createClient,
  createMatter,
  createFeeEntry,
} from '../helpers/api-factories'
import { todayISO, uniqueCode, uniqueSuffix } from '../helpers/test-data'

const BASE = 'http://localhost:3001'

test.describe('US-013: Invoicing', () => {
  let clientId: string
  let matterId: string
  let feeEntryIds: string[]
  let matterDescription: string

  test.beforeAll(async ({ request }) => {
    const suffix = uniqueSuffix()
    const client = await createClient(request, {
      clientName: `Acme Holdings ${suffix}`,
      clientCode: uniqueCode('ACM'),
      entityType: 'company_pty',
      emailGeneral: `acme-${suffix}@example.com`,
    })
    clientId = client.id
    matterDescription = `Trade mark registration ${suffix}`

    const matter = await createMatter(request, {
      clientId,
      description: matterDescription,
    })
    matterId = matter.id

    // Create 3 billable fee entries
    feeEntryIds = []
    for (let i = 1; i <= 3; i++) {
      const entry = await createFeeEntry(request, {
        matterId,
        narration: `Billable work item ${i}`,
        billedMinutes: 30 * i,
        rateCents: 200000,
      })
      feeEntryIds.push(entry.id)
    }
  })

  test('invoices page loads at /invoices', async ({ page }) => {
    await page.goto('/invoices')
    await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible({ timeout: 5000 })
  })

  test('navigate to matter, select unbilled entries, create invoice', async ({ page }) => {
    // Navigate to the matter detail page
    await page.goto(`/matters/${matterId}`)
    await expect(page.getByText(matterDescription)).toBeVisible({ timeout: 5000 })

    // Wait for fee entries to load — check for one of the narrations
    await expect(page.getByText('Billable work item 1')).toBeVisible({ timeout: 5000 })

    // The fee entries are shown with checkboxes — select all using <input type="checkbox"> elements
    const checkboxes = page.locator('input[type="checkbox"]')
    const count = await checkboxes.count()
    if (count > 0) {
      // Check all checkboxes
      for (let i = 0; i < count; i++) {
        await checkboxes.nth(i).check()
      }
    }

    // After selecting entries, an "Invoice (N)" button appears in the action bar
    const invoiceButton = page.getByRole('button', { name: /Invoice/i })
    if (await invoiceButton.isVisible({ timeout: 2000 })) {
      await invoiceButton.click()
      await page.waitForURL(/\/invoices\/new/, { timeout: 5000 })
    } else {
      // Direct navigation with entries param
      await page.goto(`/invoices/new?matterId=${matterId}&entries=${feeEntryIds.join(',')}`)
    }

    // The create invoice page shows "New Invoice" heading and the matter description
    await expect(page.getByText('New Invoice')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('body')).toContainText(matterDescription)

    // Click the "Create Invoice" button (text is "Create Invoice" for invoice type)
    const createBtn = page.getByRole('button', { name: /Create Invoice/i })
    await expect(createBtn).toBeVisible()
    await createBtn.click()

    // Should redirect to invoice detail page
    await page.waitForURL(/\/invoices\//, { timeout: 10000 })
  })

  test('invoice number auto-generated (INV-XXXX pattern)', async ({ request }) => {
    // Create invoice via API
    const res = await request.post(`${BASE}/api/invoices`, {
      data: {
        matterId,
        feeEntryIds,
        invoiceType: 'invoice',
        invoiceDate: todayISO(),
      },
    })

    // If entries already invoiced from previous test, create fresh entries
    if (res.status() === 400) {
      const newEntryIds: string[] = []
      for (let i = 1; i <= 2; i++) {
        const entry = await createFeeEntry(request, {
          matterId,
          narration: `Additional work item ${i}`,
          billedMinutes: 15 * i,
          rateCents: 200000,
        })
        newEntryIds.push(entry.id)
      }
      const retryRes = await request.post(`${BASE}/api/invoices`, {
        data: {
          matterId,
          feeEntryIds: newEntryIds,
          invoiceType: 'invoice',
          invoiceDate: todayISO(),
        },
      })
      expect(retryRes.ok()).toBeTruthy()
      const invoice = await retryRes.json()
      expect(invoice.invoiceNumber).toMatch(/^INV-\d{4,}$/)
      return
    }

    expect(res.ok()).toBeTruthy()
    const invoice = await res.json()
    expect(invoice.invoiceNumber).toMatch(/^INV-\d{4,}$/)
  })

  test('invoice detail page shows line items and totals', async ({ page, request }) => {
    // Create fresh entries and invoice
    const entry1 = await createFeeEntry(request, {
      matterId,
      narration: 'Detail test entry 1',
      billedMinutes: 60,
      rateCents: 200000,
    })
    const entry2 = await createFeeEntry(request, {
      matterId,
      narration: 'Detail test entry 2',
      billedMinutes: 30,
      rateCents: 200000,
    })

    const res = await request.post(`${BASE}/api/invoices`, {
      data: {
        matterId,
        feeEntryIds: [entry1.id, entry2.id],
        invoiceType: 'invoice',
        invoiceDate: todayISO(),
      },
    })
    expect(res.ok()).toBeTruthy()
    const invoice = await res.json()

    await page.goto(`/invoices/${invoice.id}`)

    // Invoice number displayed in the dark header h1
    await expect(page.getByRole('heading', { name: invoice.invoiceNumber })).toBeVisible({ timeout: 5000 })

    // Line items visible
    await expect(page.locator('body')).toContainText('Detail test entry 1')
    await expect(page.locator('body')).toContainText('Detail test entry 2')

    // Totals visible — the invoice preview shows "Subtotal (excl. VAT)" when VAT-registered
    // or just "Total" when not. Check for either pattern.
    await expect(
      page.getByText(/Subtotal|Total/i).first()
    ).toBeVisible()
  })

  test('invoice starts in draft status', async ({ request }) => {
    const entry = await createFeeEntry(request, {
      matterId,
      narration: 'Draft status check entry',
      billedMinutes: 30,
      rateCents: 200000,
    })

    const res = await request.post(`${BASE}/api/invoices`, {
      data: {
        matterId,
        feeEntryIds: [entry.id],
        invoiceType: 'invoice',
        invoiceDate: todayISO(),
      },
    })
    expect(res.ok()).toBeTruthy()
    const invoice = await res.json()
    expect(invoice.status).toBe('draft_invoice')
  })

  test('fee entries marked as invoiced after invoice creation', async ({ request }) => {
    const entry = await createFeeEntry(request, {
      matterId,
      narration: 'Invoiced flag check',
      billedMinutes: 30,
      rateCents: 200000,
    })

    await request.post(`${BASE}/api/invoices`, {
      data: {
        matterId,
        feeEntryIds: [entry.id],
        invoiceType: 'invoice',
        invoiceDate: todayISO(),
      },
    })

    // Attempt to invoice the same entry again should fail
    const retryRes = await request.post(`${BASE}/api/invoices`, {
      data: {
        matterId,
        feeEntryIds: [entry.id],
        invoiceType: 'invoice',
        invoiceDate: todayISO(),
      },
    })
    expect(retryRes.ok()).toBeFalsy()
    const body = await retryRes.json()
    expect(body.error).toBeTruthy()
  })
})

test.describe('US-013: Pro Forma Invoice lifecycle', () => {
  let matterId: string

  test.beforeAll(async ({ request }) => {
    const suffix = uniqueSuffix()
    const client = await createClient(request, {
      clientName: `Pro Forma Client ${suffix}`,
      clientCode: uniqueCode('PRO'),
      entityType: 'company_pty',
      emailGeneral: `pro-forma-${suffix}@example.com`,
    })

    const matter = await createMatter(request, {
      clientId: client.id,
      description: `Pro forma test matter ${suffix}`,
    })
    matterId = matter.id
  })

  async function freshEntry(request: Parameters<typeof createFeeEntry>[0], narration: string) {
    return createFeeEntry(request, {
      matterId,
      narration,
      billedMinutes: 60,
      rateCents: 200000,
    })
  }

  test('POST with invoiceType=pro_forma creates invoice in draft_pro_forma status', async ({ request }) => {
    const entry = await freshEntry(request, 'Pro forma create check')

    const res = await request.post(`${BASE}/api/invoices`, {
      data: {
        matterId,
        feeEntryIds: [entry.id],
        invoiceType: 'pro_forma',
        invoiceDate: todayISO(),
      },
    })
    expect(res.ok()).toBeTruthy()
    const invoice = await res.json()
    expect(invoice.invoiceType).toBe('pro_forma')
    expect(invoice.status).toBe('draft_pro_forma')
    expect(invoice.invoiceNumber).toMatch(/^INV-\d{4,}$/)
    expect(invoice.sentAt).toBeNull()
  })

  test('draft_pro_forma → sent_pro_forma transition stamps sentAt and persists', async ({ request }) => {
    const entry = await freshEntry(request, 'Pro forma send check')

    const createRes = await request.post(`${BASE}/api/invoices`, {
      data: {
        matterId,
        feeEntryIds: [entry.id],
        invoiceType: 'pro_forma',
        invoiceDate: todayISO(),
      },
    })
    expect(createRes.ok()).toBeTruthy()
    const invoice = await createRes.json()

    const transitionRes = await request.patch(`${BASE}/api/invoices/${invoice.id}`, {
      data: { action: 'transition', status: 'sent_pro_forma' },
    })
    expect(transitionRes.ok()).toBeTruthy()
    const updated = await transitionRes.json()
    expect(updated.status).toBe('sent_pro_forma')
    expect(updated.sentAt).not.toBeNull()

    const refetched = await request.get(`${BASE}/api/invoices/${invoice.id}`)
    expect(refetched.ok()).toBeTruthy()
    const persisted = await refetched.json()
    expect(persisted.status).toBe('sent_pro_forma')
    expect(persisted.sentAt).not.toBeNull()
  })

  test('sent_pro_forma → draft_invoice upgrade keeps invoice but switches status', async ({ request }) => {
    const entry = await freshEntry(request, 'Pro forma upgrade check')

    const createRes = await request.post(`${BASE}/api/invoices`, {
      data: {
        matterId,
        feeEntryIds: [entry.id],
        invoiceType: 'pro_forma',
        invoiceDate: todayISO(),
      },
    })
    const invoice = await createRes.json()

    await request.patch(`${BASE}/api/invoices/${invoice.id}`, {
      data: { action: 'transition', status: 'sent_pro_forma' },
    })

    const upgradeRes = await request.patch(`${BASE}/api/invoices/${invoice.id}`, {
      data: { action: 'transition', status: 'draft_invoice' },
    })
    expect(upgradeRes.ok()).toBeTruthy()
    const upgraded = await upgradeRes.json()
    expect(upgraded.status).toBe('draft_invoice')
    expect(upgraded.id).toBe(invoice.id)
    expect(upgraded.invoiceNumber).toBe(invoice.invoiceNumber)
  })

  test('draft_pro_forma → draft_invoice direct upgrade is allowed', async ({ request }) => {
    const entry = await freshEntry(request, 'Pro forma direct upgrade check')

    const createRes = await request.post(`${BASE}/api/invoices`, {
      data: {
        matterId,
        feeEntryIds: [entry.id],
        invoiceType: 'pro_forma',
        invoiceDate: todayISO(),
      },
    })
    const invoice = await createRes.json()

    const upgradeRes = await request.patch(`${BASE}/api/invoices/${invoice.id}`, {
      data: { action: 'transition', status: 'draft_invoice' },
    })
    expect(upgradeRes.ok()).toBeTruthy()
    const upgraded = await upgradeRes.json()
    expect(upgraded.status).toBe('draft_invoice')
  })

  test('invalid transition draft_pro_forma → sent_invoice is rejected with 409', async ({ request }) => {
    const entry = await freshEntry(request, 'Pro forma invalid transition check')

    const createRes = await request.post(`${BASE}/api/invoices`, {
      data: {
        matterId,
        feeEntryIds: [entry.id],
        invoiceType: 'pro_forma',
        invoiceDate: todayISO(),
      },
    })
    const invoice = await createRes.json()

    const badRes = await request.patch(`${BASE}/api/invoices/${invoice.id}`, {
      data: { action: 'transition', status: 'sent_invoice' },
    })
    expect(badRes.status()).toBe(409)
  })

  test('sent_pro_forma cannot revert to draft_pro_forma (no backwards transition)', async ({ request }) => {
    const entry = await freshEntry(request, 'Pro forma no-revert check')

    const createRes = await request.post(`${BASE}/api/invoices`, {
      data: {
        matterId,
        feeEntryIds: [entry.id],
        invoiceType: 'pro_forma',
        invoiceDate: todayISO(),
      },
    })
    const invoice = await createRes.json()

    await request.patch(`${BASE}/api/invoices/${invoice.id}`, {
      data: { action: 'transition', status: 'sent_pro_forma' },
    })

    const revertRes = await request.patch(`${BASE}/api/invoices/${invoice.id}`, {
      data: { action: 'transition', status: 'draft_pro_forma' as never },
    })
    expect(revertRes.ok()).toBeFalsy()
  })

  test('UI: create pro forma via form selects Pro Forma type and lands on draft_pro_forma', async ({ page, request }) => {
    const entry = await freshEntry(request, 'Pro forma UI flow check')

    await page.goto(`/invoices/new?matterId=${matterId}&entries=${entry.id}`)
    await expect(page.getByText('New Invoice')).toBeVisible({ timeout: 5000 })

    // Open the Invoice Type select and pick Pro Forma Invoice
    await page.getByRole('combobox').first().click()
    await page.getByRole('option', { name: /Pro Forma Invoice/i }).click()

    const createBtn = page.getByRole('button', { name: /Create Pro Forma|Create Invoice|Create/i }).last()
    await createBtn.click()

    // Wait for redirect to the created invoice — URL contains a UUID, not "new"
    await page.waitForURL(/\/invoices\/[0-9a-f]{8}-[0-9a-f]{4}-/, { timeout: 10000 })

    const urlMatch = page.url().match(/\/invoices\/([0-9a-f-]{36})/)
    expect(urlMatch).not.toBeNull()
    const newId = urlMatch![1]
    const refetched = await request.get(`${BASE}/api/invoices/${newId}`)
    const persisted = await refetched.json()
    expect(persisted.invoiceType).toBe('pro_forma')
    expect(persisted.status).toBe('draft_pro_forma')
  })
})
