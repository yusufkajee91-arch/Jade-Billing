import { test, expect } from '../helpers/console-capture'

const BASE = 'http://localhost:3001'

test.describe('US-016: Chart of Accounts', () => {
  test('GL accounts are seeded and accessible via API', async ({ request }) => {
    const res = await request.get(`${BASE}/api/gl/accounts`)
    expect(res.ok()).toBeTruthy()

    const accounts = await res.json()
    expect(Array.isArray(accounts)).toBeTruthy()
    expect(accounts.length).toBeGreaterThanOrEqual(8)
  })

  test('Trust Bank account (1001) exists', async ({ request }) => {
    const res = await request.get(`${BASE}/api/gl/accounts`)
    const accounts = await res.json()
    const trustBank = accounts.find((a: { code: string }) => a.code === '1001')
    expect(trustBank).toBeTruthy()
    expect(trustBank.name).toContain('Trust')
  })

  test('Business Current account (1002) exists', async ({ request }) => {
    const res = await request.get(`${BASE}/api/gl/accounts`)
    const accounts = await res.json()
    const business = accounts.find((a: { code: string }) => a.code === '1002')
    expect(business).toBeTruthy()
    expect(business.name).toContain('Business')
  })

  test('Debtors Control account (1010) exists', async ({ request }) => {
    const res = await request.get(`${BASE}/api/gl/accounts`)
    const accounts = await res.json()
    const debtors = accounts.find((a: { code: string }) => a.code === '1010')
    expect(debtors).toBeTruthy()
    expect(debtors.name).toContain('Debtor')
  })

  test('Professional Fees Income account (4001) exists', async ({ request }) => {
    const res = await request.get(`${BASE}/api/gl/accounts`)
    const accounts = await res.json()
    const profFees = accounts.find((a: { code: string }) => a.code === '4001')
    expect(profFees).toBeTruthy()
    expect(profFees.name).toContain('Professional')
  })

  test('Disbursements Expense account (5001) exists', async ({ request }) => {
    const res = await request.get(`${BASE}/api/gl/accounts`)
    const accounts = await res.json()
    const disbursements = accounts.find((a: { code: string }) => a.code === '5001')
    expect(disbursements).toBeTruthy()
    expect(disbursements.name).toContain('Disbursement')
  })

  test('all 8 standard accounts are present', async ({ request }) => {
    const res = await request.get(`${BASE}/api/gl/accounts`)
    const accounts = await res.json()

    const expectedCodes = ['1001', '1002', '1010', '2001', '2010', '4001', '4002', '5001']
    const actualCodes = accounts.map((a: { code: string }) => a.code)

    for (const code of expectedCodes) {
      expect(actualCodes).toContain(code)
    }
  })
})
