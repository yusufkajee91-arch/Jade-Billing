import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    client: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'

// ──────────────────────────────────────────────
// Helpers simulating API route logic
// ──────────────────────────────────────────────

async function handleGetClients(
  session: { user: { id: string; role: string } } | null,
  q?: string,
) {
  if (!session) return { status: 401, body: { error: 'Unauthorised' } }

  const where: Record<string, unknown> = {}
  if (q) {
    where.OR = [
      { clientCode: { contains: q, mode: 'insensitive' } },
      { clientName: { contains: q, mode: 'insensitive' } },
    ]
  }

  const clients = await (prisma.client.findMany as ReturnType<typeof vi.fn>)({
    where,
    select: {
      id: true,
      clientCode: true,
      clientName: true,
      entityType: true,
      ficaStatus: true,
      isActive: true,
      createdAt: true,
      _count: { select: { matters: { where: { status: 'open' } } } },
    },
    orderBy: { clientCode: 'asc' },
  })

  return { status: 200, body: clients }
}

async function handleCreateClient(
  body: Record<string, unknown>,
  session: { user: { id: string; role: string } } | null,
) {
  if (!session) return { status: 401, body: { error: 'Unauthorised' } }
  if (session.user.role !== 'admin' && session.user.role !== 'fee_earner') {
    return { status: 403, body: { error: 'Forbidden' } }
  }

  const VALID_ENTITY_TYPES = [
    'individual_sa', 'company_pty', 'company_ltd', 'close_corporation',
    'trust', 'partnership', 'foreign_company', 'other',
  ]

  const { clientCode, clientName, entityType } = body as {
    clientCode: string
    clientName: string
    entityType: string
  }

  if (!clientCode || !clientName) {
    return { status: 400, body: { error: 'Validation failed' } }
  }

  if (!VALID_ENTITY_TYPES.includes(entityType)) {
    return { status: 400, body: { error: 'Invalid entity type' } }
  }

  const existing = await (prisma.client.findUnique as ReturnType<typeof vi.fn>)({
    where: { clientCode },
  })
  if (existing) {
    return { status: 409, body: { error: 'A client with this code already exists' } }
  }

  const client = await (prisma.client.create as ReturnType<typeof vi.fn>)({
    data: {
      ...body,
      createdById: session.user.id,
    },
  })

  return { status: 201, body: client }
}

async function handlePatchClient(
  id: string,
  body: Record<string, unknown>,
  session: { user: { id: string; role: string } } | null,
) {
  if (!session) return { status: 401, body: { error: 'Unauthorised' } }

  const existing = await (prisma.client.findUnique as ReturnType<typeof vi.fn>)({
    where: { id },
  })
  if (!existing) {
    return { status: 404, body: { error: 'Client not found' } }
  }

  if (session.user.role !== 'admin' && existing.createdById !== session.user.id) {
    return { status: 403, body: { error: 'Forbidden' } }
  }

  const updated = await (prisma.client.update as ReturnType<typeof vi.fn>)({
    where: { id },
    data: body,
  })

  return { status: 200, body: updated }
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

const adminSession = { user: { id: 'user-1', role: 'admin' } }
const feeEarnerSession = { user: { id: 'user-2', role: 'fee_earner' } }

const mockClient = {
  id: 'client-1',
  clientCode: 'APS',
  clientName: 'Aqua Plastech',
  entityType: 'company_pty',
  ficaStatus: 'not_compliant',
  isActive: true,
  createdAt: new Date().toISOString(),
  createdById: 'user-2',
  _count: { matters: 2 },
}

describe('GET /api/clients', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma.client.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockClient])
  })

  it('returns 401 if no session', async () => {
    const res = await handleGetClients(null)
    expect(res.status).toBe(401)
  })

  it('returns client list with _count for authenticated user', async () => {
    const res = await handleGetClients(adminSession)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect((res.body as typeof mockClient[])[0]._count).toBeDefined()
  })

  it('passes filter to query when ?q= provided', async () => {
    const res = await handleGetClients(adminSession, 'aps')
    expect(res.status).toBe(200)
    const call = (prisma.client.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.where.OR).toBeDefined()
    expect(call.where.OR[0].clientCode.contains).toBe('aps')
  })
})

describe('POST /api/clients', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma.client.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(prisma.client.create as ReturnType<typeof vi.fn>).mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'new-client-id',
        ...data,
        createdAt: new Date().toISOString(),
      }),
    )
  })

  it('returns 401 if no session', async () => {
    const res = await handleCreateClient(
      { clientCode: 'APS', clientName: 'Aqua Plastech', entityType: 'company_pty' },
      null,
    )
    expect(res.status).toBe(401)
  })

  it('creates client with createdById from session', async () => {
    const res = await handleCreateClient(
      { clientCode: 'APS', clientName: 'Aqua Plastech', entityType: 'company_pty' },
      feeEarnerSession,
    )
    expect(res.status).toBe(201)
    const createCall = (prisma.client.create as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(createCall.data.createdById).toBe('user-2')
  })

  it('returns 409 if clientCode already taken', async () => {
    ;(prisma.client.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockClient)
    const res = await handleCreateClient(
      { clientCode: 'APS', clientName: 'Aqua Plastech', entityType: 'company_pty' },
      adminSession,
    )
    expect(res.status).toBe(409)
  })

  it('rejects invalid entityType', async () => {
    const res = await handleCreateClient(
      { clientCode: 'APS', clientName: 'Aqua Plastech', entityType: 'invalid_type' },
      adminSession,
    )
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/clients/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma.client.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockClient)
    ;(prisma.client.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockClient,
      clientName: 'Updated Name',
    })
  })

  it('returns 404 if client not found', async () => {
    ;(prisma.client.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const res = await handlePatchClient('nonexistent', { clientName: 'X' }, adminSession)
    expect(res.status).toBe(404)
  })

  it('returns 401 if no session', async () => {
    const res = await handlePatchClient('client-1', { clientName: 'X' }, null)
    expect(res.status).toBe(401)
  })

  it('admin can update any client', async () => {
    const res = await handlePatchClient('client-1', { clientName: 'Updated Name' }, adminSession)
    expect(res.status).toBe(200)
  })

  it('fee_earner cannot update another user\'s client', async () => {
    // mockClient.createdById is 'user-2', but here we use a different user
    const otherSession = { user: { id: 'user-99', role: 'fee_earner' } }
    const res = await handlePatchClient('client-1', { clientName: 'X' }, otherSession)
    expect(res.status).toBe(403)
  })
})
