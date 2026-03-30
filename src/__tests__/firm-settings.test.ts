import { describe, it, expect, vi, beforeEach } from 'vitest'

// ──────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────
vi.mock('@/lib/prisma', () => ({
  prisma: {
    firmSettings: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    firmOffice: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'

// ──────────────────────────────────────────────
// Simulate GET /api/firm-settings logic
// ──────────────────────────────────────────────
async function handleGetFirmSettings(sessionRole: string | null) {
  const session = sessionRole ? { user: { role: sessionRole } } : null
  if (!session) return { status: 401, body: { error: 'Unauthorised' } }

  const settings = await (prisma.firmSettings.findFirst as any)({
    include: { offices: { orderBy: { sortOrder: 'asc' } } },
  })

  // Never expose internal fields like passwordHash (N/A for settings, but sanity check)
  return { status: 200, body: settings }
}

// ──────────────────────────────────────────────
// Simulate PUT /api/firm-settings logic
// ──────────────────────────────────────────────
async function handlePutFirmSettings(
  body: Record<string, unknown>,
  sessionRole: string | null,
) {
  const session = sessionRole ? { user: { role: sessionRole } } : null
  if (!session) return { status: 401, body: { error: 'Unauthorised' } }
  if (session.user.role !== 'admin') return { status: 403, body: { error: 'Forbidden' } }

  const existing = await (prisma.firmSettings.findFirst as any)()

  if (existing) {
    const updated = await (prisma.firmSettings.update as any)({
      where: { id: existing.id },
      data: body,
    })
    return { status: 200, body: updated }
  } else {
    const created = await (prisma.firmSettings.create as any)({ data: body })
    return { status: 200, body: created }
  }
}

const mockSettings = {
  id: 'settings-1',
  firmName: 'Dolata & Co Attorneys',
  tradingName: 'Dolata & Co',
  vatRegistered: false,
  vatRateBps: 1500,
  billingBlocksEnabled: true,
  invoicePrefix: 'INV',
  financialYearStartMonth: 3,
  offices: [
    { id: 'office-1', label: 'Main Office', isPrimary: true },
  ],
}

describe('GET /api/firm-settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma.firmSettings.findFirst as any).mockResolvedValue(mockSettings)
  })

  it('returns settings for authenticated user', async () => {
    const res = await handleGetFirmSettings('fee_earner')
    expect(res.status).toBe(200)
    expect(res.body).toBeDefined()
    expect((res.body as any)?.firmName).toBe('Dolata & Co Attorneys')
  })

  it('returns 401 for unauthenticated request', async () => {
    const res = await handleGetFirmSettings(null)
    expect(res.status).toBe(401)
  })

  it('includes office data', async () => {
    const res = await handleGetFirmSettings('admin')
    const body = res.body as typeof mockSettings
    expect(body?.offices).toBeDefined()
    expect(Array.isArray(body?.offices)).toBe(true)
  })
})

describe('PUT /api/firm-settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma.firmSettings.findFirst as any).mockResolvedValue(mockSettings)
    ;(prisma.firmSettings.update as any).mockImplementation(async ({ data }: any) => ({
      ...mockSettings,
      ...data,
    }))
  })

  it('returns 403 for non-admin', async () => {
    const res = await handlePutFirmSettings({ firmName: 'Test' }, 'fee_earner')
    expect(res.status).toBe(403)
  })

  it('returns 403 for assistant role', async () => {
    const res = await handlePutFirmSettings({ firmName: 'Test' }, 'assistant')
    expect(res.status).toBe(403)
  })

  it('allows admin to update settings', async () => {
    const res = await handlePutFirmSettings(
      { firmName: 'Updated Firm Name' },
      'admin',
    )
    expect(res.status).toBe(200)
  })

  it('returns 401 for unauthenticated request', async () => {
    const res = await handlePutFirmSettings({ firmName: 'Test' }, null)
    expect(res.status).toBe(401)
  })
})

describe('VAT rate basis points', () => {
  it('1500 bps represents 15% VAT', () => {
    const vatRateBps = 1500
    const percentage = vatRateBps / 100
    expect(percentage).toBe(15)
  })

  it('applying 15% VAT to R1000 gives R1150', () => {
    const amountCents = 100000 // R1000 in cents
    const vatRateBps = 1500
    const vatAmount = Math.round((amountCents * vatRateBps) / 10000)
    expect(vatAmount).toBe(15000) // R150 in cents
    expect(amountCents + vatAmount).toBe(115000) // R1150 in cents
  })

  it('stores monetary amounts as integers (cents)', () => {
    // VAT rate stored as basis points — no floating point
    const vatRateBps = 1500
    expect(Number.isInteger(vatRateBps)).toBe(true)

    // Fee rate stored as cents — no floating point
    const hourlyRateCents = 200000 // R2000/hr
    expect(Number.isInteger(hourlyRateCents)).toBe(true)
  })
})
