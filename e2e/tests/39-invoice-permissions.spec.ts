import { request as playwrightRequest, type Page, test, expect } from '@playwright/test'
import {
  createClient,
  createMatter,
  createFeeEntry,
} from '../helpers/api-factories'
import {
  ADMIN_STORAGE,
  FEE_EARNER_STORAGE,
  ASSISTANT_STORAGE,
} from '../helpers/auth'
import { todayISO, uniqueCode, uniqueSuffix } from '../helpers/test-data'

const BASE = 'http://localhost:3001'

type InvoiceScenario = {
  matterId: string
  matterDescription: string
  entryIds: string[]
  entryNarrations: string[]
}

let adminCtx: Awaited<ReturnType<typeof playwrightRequest.newContext>>

async function provisionInvoiceScenario(label: string): Promise<InvoiceScenario> {
  const suffix = uniqueSuffix()
  const client = await createClient(adminCtx, {
    clientName: `Invoice Permission ${label} ${suffix}`,
    clientCode: uniqueCode('IVP'),
    entityType: 'company_pty',
    emailGeneral: `invoice-permission-${suffix}@example.com`,
  })

  const matterDescription = `Pro forma permission matter ${label} ${suffix}`
  const matter = await createMatter(adminCtx, {
    clientId: client.id,
    description: matterDescription,
    ownerId: 'seed-fee-earner',
    userIds: ['seed-assistant'],
  })

  const entryNarrations = [
    `${label} fee entry ${suffix}`,
    `${label} disbursement entry ${suffix}`,
  ]

  const feeEntry = await createFeeEntry(adminCtx, {
    matterId: matter.id,
    narration: entryNarrations[0],
    entryType: 'time',
    billedMinutes: 60,
    rateCents: 200000,
    feeEarnerId: 'seed-fee-earner',
  })

  const disbursementEntry = await createFeeEntry(adminCtx, {
    matterId: matter.id,
    narration: entryNarrations[1],
    entryType: 'disbursement',
    rateCents: 12500,
    feeEarnerId: 'seed-fee-earner',
  })

  return {
    matterId: matter.id,
    matterDescription,
    entryIds: [feeEntry.id, disbursementEntry.id],
    entryNarrations,
  }
}

async function openInvoiceCreateFromMatter(page: Page, scenario: InvoiceScenario) {
  await page.goto(`/matters/${scenario.matterId}`)
  await expect(page.getByText(scenario.matterDescription)).toBeVisible()

  for (const narration of scenario.entryNarrations) {
    await expect(page.getByText(narration)).toBeVisible()
  }

  const checkboxes = page.locator('input[type="checkbox"]')
  await expect(checkboxes).toHaveCount(2)
  await checkboxes.nth(0).check()
  await checkboxes.nth(1).check()

  const invoiceButton = page.getByRole('button', { name: /Invoice \(2\)/i })
  await expect(invoiceButton).toBeVisible()
  await invoiceButton.click()

  await page.waitForURL(new RegExp(`/invoices/new\\?matterId=${scenario.matterId}`))
  await expect(page.getByRole('heading', { name: 'New Invoice' })).toBeVisible()
}

async function switchToProForma(page: Page) {
  const typeTrigger = page
    .locator('label:has-text("Invoice Type")')
    .locator('..')
    .locator('[data-slot="select-trigger"]')

  await typeTrigger.click()
  await page.getByRole('option', { name: 'Pro Forma Invoice' }).click()
  await expect(page.getByRole('button', { name: 'Create Pro Forma' })).toBeVisible()
}

test.beforeAll(async () => {
  adminCtx = await playwrightRequest.newContext({
    baseURL: BASE,
    storageState: ADMIN_STORAGE,
  })
})

test.afterAll(async () => {
  await adminCtx.dispose()
})

test.describe('Invoice permissions — API role matrix', () => {
  test.describe('admin', () => {
    test.use({ storageState: ADMIN_STORAGE })

    test('admin can create a pro forma invoice via POST /api/invoices', async ({ request }) => {
      const scenario = await provisionInvoiceScenario('admin-api')

      const res = await request.post(`${BASE}/api/invoices`, {
        data: {
          matterId: scenario.matterId,
          feeEntryIds: scenario.entryIds,
          invoiceType: 'pro_forma',
          invoiceDate: todayISO(),
        },
      })

      expect(res.status()).toBe(201)
      const invoice = await res.json()
      expect(invoice.invoiceType).toBe('pro_forma')
      expect(invoice.status).toBe('draft_pro_forma')
      expect(invoice.lineItems).toHaveLength(2)
    })
  })

  test.describe('fee earner', () => {
    test.use({ storageState: FEE_EARNER_STORAGE })

    test('fee earner can create a pro forma invoice via POST /api/invoices', async ({ request }) => {
      const scenario = await provisionInvoiceScenario('fee-earner-api')

      const res = await request.post(`${BASE}/api/invoices`, {
        data: {
          matterId: scenario.matterId,
          feeEntryIds: scenario.entryIds,
          invoiceType: 'pro_forma',
          invoiceDate: todayISO(),
        },
      })

      expect(res.status()).toBe(201)
      const invoice = await res.json()
      expect(invoice.invoiceType).toBe('pro_forma')
      expect(invoice.status).toBe('draft_pro_forma')
      expect(invoice.lineItems).toHaveLength(2)
    })
  })

  test.describe('assistant', () => {
    test.use({ storageState: ASSISTANT_STORAGE })

    test('assistant can create a pro forma invoice via POST /api/invoices', async ({ request }) => {
      const scenario = await provisionInvoiceScenario('assistant-api')

      const res = await request.post(`${BASE}/api/invoices`, {
        data: {
          matterId: scenario.matterId,
          feeEntryIds: scenario.entryIds,
          invoiceType: 'pro_forma',
          invoiceDate: todayISO(),
        },
      })

      expect(res.status()).toBe(201)
      const invoice = await res.json()
      expect(invoice.invoiceType).toBe('pro_forma')
      expect(invoice.status).toBe('draft_pro_forma')
      expect(invoice.lineItems).toHaveLength(2)
    })

    test('assistant can convert a pro forma invoice to a draft invoice', async ({ request }) => {
      const scenario = await provisionInvoiceScenario('assistant-convert')

      const createRes = await request.post(`${BASE}/api/invoices`, {
        data: {
          matterId: scenario.matterId,
          feeEntryIds: scenario.entryIds,
          invoiceType: 'pro_forma',
          invoiceDate: todayISO(),
        },
      })
      expect(createRes.status()).toBe(201)
      const invoice = await createRes.json()

      const transitionRes = await request.patch(`${BASE}/api/invoices/${invoice.id}`, {
        data: {
          action: 'transition',
          status: 'draft_invoice',
        },
      })

      expect(transitionRes.status()).toBe(200)
      const updated = await transitionRes.json()
      expect(updated.status).toBe('draft_invoice')
    })

    test('assistant can mark a sent invoice as paid', async ({ request }) => {
      const scenario = await provisionInvoiceScenario('assistant-paid')

      const createRes = await request.post(`${BASE}/api/invoices`, {
        data: {
          matterId: scenario.matterId,
          feeEntryIds: scenario.entryIds,
          invoiceType: 'invoice',
          invoiceDate: todayISO(),
        },
      })
      expect(createRes.status()).toBe(201)
      const invoice = await createRes.json()

      const sendTransitionRes = await request.patch(`${BASE}/api/invoices/${invoice.id}`, {
        data: {
          action: 'transition',
          status: 'sent_invoice',
        },
      })
      expect(sendTransitionRes.status()).toBe(200)

      const markPaidRes = await request.patch(`${BASE}/api/invoices/${invoice.id}`, {
        data: {
          action: 'mark_paid',
          paidNote: 'Paid by assistant test',
        },
      })

      expect(markPaidRes.status()).toBe(200)
      const paid = await markPaidRes.json()
      expect(paid.status).toBe('paid')
      expect(paid.paidNote).toBe('Paid by assistant test')
    })

    test('assistant can access the send endpoint without auth denial', async ({ request }) => {
      const scenario = await provisionInvoiceScenario('assistant-send')

      const createRes = await request.post(`${BASE}/api/invoices`, {
        data: {
          matterId: scenario.matterId,
          feeEntryIds: scenario.entryIds,
          invoiceType: 'pro_forma',
          invoiceDate: todayISO(),
        },
      })
      expect(createRes.status()).toBe(201)
      const invoice = await createRes.json()

      const sendRes = await request.post(`${BASE}/api/invoices/${invoice.id}/send`, {
        data: {
          toEmail: `assistant-send-${uniqueSuffix()}@example.com`,
        },
      })

      expect([200, 422, 500]).toContain(sendRes.status())
    })
  })
})

test.describe('Pro forma invoice creation workflow', () => {
  test.describe('fee earner', () => {
    test.use({ storageState: FEE_EARNER_STORAGE })

    test('fee earner can create a pro forma invoice from the matter detail flow', async ({ page }) => {
      const scenario = await provisionInvoiceScenario('fee-earner-ui')

      await openInvoiceCreateFromMatter(page, scenario)
      await switchToProForma(page)

      await expect(page.locator('input[type="date"]')).toHaveValue(todayISO())
      for (const narration of scenario.entryNarrations) {
        await expect(page.getByText(narration)).toBeVisible()
      }

      const createResponse = page.waitForResponse(
        (res) => res.url().endsWith('/api/invoices') && res.request().method() === 'POST',
      )

      await page.getByRole('button', { name: 'Create Pro Forma' }).click()

      const res = await createResponse
      expect(res.status()).toBe(201)

      await page.waitForURL(/\/invoices\/[^/]+$/)
      await expect(page.getByText('Draft Pro Forma')).toBeVisible()
      for (const narration of scenario.entryNarrations) {
        await expect(page.getByText(narration)).toBeVisible()
      }
    })
  })

  test.describe('assistant', () => {
    test.use({ storageState: ASSISTANT_STORAGE })

    test('assistant can create a pro forma invoice from the matter detail flow', async ({ page }) => {
      const scenario = await provisionInvoiceScenario('assistant-ui')

      await openInvoiceCreateFromMatter(page, scenario)
      await switchToProForma(page)

      const createResponse = page.waitForResponse(
        (res) => res.url().endsWith('/api/invoices') && res.request().method() === 'POST',
      )

      await page.getByRole('button', { name: 'Create Pro Forma' }).click()

      const res = await createResponse
      expect(res.status()).toBe(201)

      await page.waitForURL(/\/invoices\/[^/]+$/)
      await expect(page.getByText('Draft Pro Forma')).toBeVisible()
      for (const narration of scenario.entryNarrations) {
        await expect(page.getByText(narration)).toBeVisible()
      }
    })
  })
})
