import { test, expect } from '@playwright/test'
import {
  createClient,
  createMatter,
  createFeeEntry,
} from '../helpers/api-factories'
import { todayISO, uniqueCode, uniqueSuffix } from '../helpers/test-data'

const BASE = 'http://localhost:3001'

test.describe('US-014: Invoice PDF', () => {
  let invoiceId: string
  let invoiceNumber: string

  test.beforeAll(async ({ request }) => {
    const suffix = uniqueSuffix()
    const client = await createClient(request, {
      clientName: `PDF Test Client ${suffix}`,
      clientCode: uniqueCode('PDF'),
      entityType: 'company_pty',
      emailGeneral: `pdf-${suffix}@example.com`,
    })

    const matter = await createMatter(request, {
      clientId: client.id,
      description: `PDF generation test matter ${suffix}`,
    })

    // Create fee entries — factory now correctly sends durationMinutesRaw for time entries
    const entry1 = await createFeeEntry(request, {
      matterId: matter.id,
      narration: 'PDF test entry 1',
      entryType: 'time',
      billedMinutes: 60,
      rateCents: 200000,
    })
    const entry2 = await createFeeEntry(request, {
      matterId: matter.id,
      narration: 'PDF test entry 2',
      entryType: 'time',
      billedMinutes: 30,
      rateCents: 150000,
    })

    // Verify entries were created with IDs
    if (!entry1.id || !entry2.id) {
      throw new Error(`Fee entries not created properly: entry1=${JSON.stringify(entry1)}, entry2=${JSON.stringify(entry2)}`)
    }

    const res = await request.post(`${BASE}/api/invoices`, {
      data: {
        matterId: matter.id,
        feeEntryIds: [entry1.id, entry2.id],
        invoiceType: 'invoice',
        invoiceDate: todayISO(),
      },
    })
    if (!res.ok()) {
      const body = await res.json().catch(() => ({}))
      throw new Error(`Invoice creation failed (${res.status()}): ${JSON.stringify(body)}`)
    }
    const invoice = await res.json()
    invoiceId = invoice.id
    invoiceNumber = invoice.invoiceNumber
  })

  test('invoice detail page has Download PDF button', async ({ page }) => {
    await page.goto(`/invoices/${invoiceId}`)
    const downloadBtn = page.getByRole('button', { name: /download pdf/i })
    await expect(downloadBtn).toBeVisible()
  })

  test('click download triggers PDF response', async ({ page }) => {
    await page.goto(`/invoices/${invoiceId}`)

    await page.evaluate(() => {
      const openedUrls: string[] = []
      ;(window as typeof window & { __openedUrls?: string[] }).__openedUrls = openedUrls
      window.open = ((url?: string | URL) => {
        openedUrls.push(String(url))
        return null
      }) as typeof window.open
    })
    await page.getByRole('button', { name: /download pdf/i }).click()
    const openedUrls = await page.evaluate(
      () => (window as typeof window & { __openedUrls?: string[] }).__openedUrls ?? [],
    )
    expect(openedUrls).toContain(`/api/invoices/${invoiceId}/pdf`)
  })

  test('API endpoint /api/invoices/[id]/pdf returns 200 with PDF', async ({ request }) => {
    const res = await request.get(`${BASE}/api/invoices/${invoiceId}/pdf`)
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('application/pdf')
    expect(res.headers()['content-disposition']).toContain(invoiceNumber)

    const body = await res.body()
    expect(body.length).toBeGreaterThan(0)

    // PDF files start with %PDF
    const header = body.toString('utf-8', 0, 5)
    expect(header).toBe('%PDF-')
  })
})
