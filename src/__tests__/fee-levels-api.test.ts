import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/debug', () => ({
  apiLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    feeLevel: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { GET, POST } from '@/app/api/fee-levels/route'

const adminSession = { user: { id: 'admin-1', role: 'admin' } }
const feeEarnerSession = { user: { id: 'fee-1', role: 'fee_earner' } }
const assistantSession = { user: { id: 'assistant-1', role: 'assistant' } }

describe('/api/fee-levels permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma.feeLevel.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'fl-1', name: 'Director', hourlyRateCents: 200000 },
    ])
    ;(prisma.feeLevel.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'fl-2',
      name: 'Associate',
      hourlyRateCents: 125000,
    })
  })

  it('allows fee earners to read fee levels', async () => {
    ;(getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(feeEarnerSession)

    const response = await GET()

    expect(response.status).toBe(200)
    expect(prisma.feeLevel.findMany).toHaveBeenCalled()
  })

  it('allows assistants to read fee levels', async () => {
    ;(getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(assistantSession)

    const response = await GET()

    expect(response.status).toBe(200)
  })

  it('returns 401 when reading fee levels without a session', async () => {
    ;(getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const response = await GET()

    expect(response.status).toBe(401)
    expect(prisma.feeLevel.findMany).not.toHaveBeenCalled()
  })

  it('keeps fee-level mutations admin-only', async () => {
    ;(getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(feeEarnerSession)

    const response = await POST(
      new Request('http://localhost/api/fee-levels', {
        method: 'POST',
        body: JSON.stringify({ name: 'Associate', hourlyRateCents: 125000 }),
      }) as unknown as NextRequest,
    )

    expect(response.status).toBe(403)
    expect(prisma.feeLevel.create).not.toHaveBeenCalled()
  })

  it('allows admins to create fee levels', async () => {
    ;(getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(adminSession)

    const response = await POST(
      new Request('http://localhost/api/fee-levels', {
        method: 'POST',
        body: JSON.stringify({ name: 'Associate', hourlyRateCents: 125000 }),
      }) as unknown as NextRequest,
    )

    expect(response.status).toBe(201)
    expect(prisma.feeLevel.create).toHaveBeenCalledWith({
      data: { name: 'Associate', hourlyRateCents: 125000 },
    })
  })
})
