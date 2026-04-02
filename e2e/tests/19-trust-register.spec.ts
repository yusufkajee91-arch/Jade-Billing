import { test, expect } from '../helpers/console-capture'
import {
  createClient,
  createMatter,
  createTrustEntry,
} from '../helpers/api-factories'
import { todayISO, formatCurrency } from '../helpers/test-data'

const BASE = 'http://localhost:3001'

test.describe('US-019: Trust Register', () => {
  let clientId: string
  let matter1Id: string
  let matter2Id: string

  test.beforeAll(async ({ request }) => {
    const client = await createClient(request, {
      clientName: 'Trust Register Client (Pty) Ltd',
      clientCode: 'TRC',
      entityType: 'company_pty',
      emailGeneral: 'treg@example.com',
    })
    clientId = client.id

    const matter1 = await createMatter(request, {
      clientId,
      description: 'Trust register matter A',
    })
    matter1Id = matter1.id

    const matter2 = await createMatter(request, {
      clientId,
      description: 'Trust register matter B',
    })
    matter2Id = matter2.id

    // Fund both matters
    await createTrustEntry(request, {
      matterId: matter1Id,
      entryType: 'trust_receipt',
      amountCents: 10000000,
      narration: 'Deposit matter A',
    })
    await createTrustEntry(request, {
      matterId: matter1Id,
      entryType: 'trust_payment',
      amountCents: 3000000,
      narration: 'Payment matter A',
    })
    await createTrustEntry(request, {
      matterId: matter2Id,
      entryType: 'trust_receipt',
      amountCents: 5000000,
      narration: 'Deposit matter B',
    })
  })

  test('trust register tab shows matter balances', async ({ page }) => {
    await page.goto('/trust')

    // Trust Register tab should be active by default
    await expect(page.locator('body')).toContainText('Trust Register')

    // Should show matter codes and balances
    await expect(page.locator('body')).toContainText('Trust register matter A')
    await expect(page.locator('body')).toContainText('Trust register matter B')
  })

  test('balances match receipts minus payments via API', async ({ request }) => {
    const res = await request.get(`${BASE}/api/trust-register`)
    expect(res.ok()).toBeTruthy()
    const register = await res.json()

    // Matter A: 100,000.00 receipt - 30,000.00 payment = 70,000.00
    const matterA = register.matters.find(
      (m: { matterId: string }) => m.matterId === matter1Id,
    )
    expect(matterA).toBeTruthy()
    expect(matterA.balanceCents).toBe(7000000) // 10,000,000 - 3,000,000

    // Matter B: 50,000.00 receipt only
    const matterB = register.matters.find(
      (m: { matterId: string }) => m.matterId === matter2Id,
    )
    expect(matterB).toBeTruthy()
    expect(matterB.balanceCents).toBe(5000000)
  })

  test('total row is sum of all matter balances', async ({ request }) => {
    const res = await request.get(`${BASE}/api/trust-register`)
    const register = await res.json()

    const sumOfMatters = register.matters.reduce(
      (sum: number, m: { balanceCents: number }) => sum + m.balanceCents,
      0,
    )
    expect(register.totalBalanceCents).toBe(sumOfMatters)
  })

  test('trust register page displays total balance', async ({ page }) => {
    await page.goto('/trust')

    // The header should show the total trust balance
    await expect(page.locator('body')).toContainText('Total Trust Balance')
  })
})
