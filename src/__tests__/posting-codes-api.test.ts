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
    postingCode: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { GET, POST } from '@/app/api/posting-codes/route'

const adminSession = { user: { id: 'admin-1', role: 'admin' } }
const feeEarnerSession = { user: { id: 'fee-1', role: 'fee_earner' } }
const assistantSession = { user: { id: 'assistant-1', role: 'assistant' } }

describe('/api/posting-codes permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma.postingCode.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'pc-1', code: 'EMAIL', description: 'Email to client' },
    ])
    ;(prisma.postingCode.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(prisma.postingCode.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'pc-2',
      code: 'PHONE',
      description: 'Telephone call',
    })
  })

  it('allows fee earners to read posting codes', async () => {
    ;(getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(feeEarnerSession)

    const response = await GET()

    expect(response.status).toBe(200)
    expect(prisma.postingCode.findMany).toHaveBeenCalled()
  })

  it('allows assistants to read posting codes', async () => {
    ;(getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(assistantSession)

    const response = await GET()

    expect(response.status).toBe(200)
  })

  it('returns 401 when reading posting codes without a session', async () => {
    ;(getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const response = await GET()

    expect(response.status).toBe(401)
    expect(prisma.postingCode.findMany).not.toHaveBeenCalled()
  })

  it('keeps posting-code mutations admin-only', async () => {
    ;(getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(feeEarnerSession)

    const response = await POST(
      new Request('http://localhost/api/posting-codes', {
        method: 'POST',
        body: JSON.stringify({ code: 'PHONE', description: 'Telephone call' }),
      }) as unknown as NextRequest,
    )

    expect(response.status).toBe(403)
    expect(prisma.postingCode.create).not.toHaveBeenCalled()
  })

  it('allows admins to create posting codes', async () => {
    ;(getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(adminSession)

    const response = await POST(
      new Request('http://localhost/api/posting-codes', {
        method: 'POST',
        body: JSON.stringify({ code: 'phone', description: 'Telephone call' }),
      }) as unknown as NextRequest,
    )

    expect(response.status).toBe(201)
    expect(prisma.postingCode.create).toHaveBeenCalledWith({
      data: { code: 'PHONE', description: 'Telephone call' },
    })
  })
})
