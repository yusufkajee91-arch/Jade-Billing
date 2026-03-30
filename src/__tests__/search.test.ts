import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    client: {
      findMany: vi.fn(),
    },
    matter: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

import { prisma } from '@/lib/prisma'

const adminSession = { user: { id: 'admin-1', role: 'admin' } }
const feeEarnerSession = { user: { id: 'user-2', role: 'fee_earner' } }

const mockClients = [
  { id: 'c1', clientCode: 'APS', clientName: 'Aqua Plastech', ficaStatus: 'compliant', type: 'client' },
]
const mockMatters = [
  {
    id: 'm1',
    matterCode: 'JJ/APS-001',
    description: 'Commercial lease',
    status: 'open',
    client: { clientCode: 'APS', clientName: 'Aqua Plastech' },
  },
]

// ──────────────────────────────────────────────
// Helper simulating GET /api/search
// ──────────────────────────────────────────────
async function handleSearch(
  q: string,
  session: { user: { id: string; role: string } } | null,
) {
  if (!session) return { status: 401, body: { error: 'Unauthorised' } }
  if (q.length < 2) return { status: 400, body: { error: 'Query too short' } }

  const isAdmin = session.user.role === 'admin'
  const userId = session.user.id

  const matterWhere: Record<string, unknown> = {
    OR: [
      { matterCode: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ],
  }

  if (!isAdmin) {
    matterWhere.AND = [
      {
        OR: [
          { ownerId: userId },
          { matterUsers: { some: { userId } } },
        ],
      },
    ]
  }

  const [clients, matters] = await Promise.all([
    (prisma.client.findMany as ReturnType<typeof vi.fn>)({
      where: {
        OR: [
          { clientCode: { contains: q, mode: 'insensitive' } },
          { clientName: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 5,
    }),
    (prisma.matter.findMany as ReturnType<typeof vi.fn>)({
      where: matterWhere,
      take: 8,
    }),
  ])

  return {
    status: 200,
    body: {
      clients: clients.map((c: typeof mockClients[0]) => ({ ...c, type: 'client' })),
      matters: matters.map((m: typeof mockMatters[0]) => ({
        id: m.id,
        matterCode: m.matterCode,
        description: m.description,
        clientCode: m.client.clientCode,
        clientName: m.client.clientName,
        status: m.status,
        type: 'matter',
      })),
    },
  }
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('GET /api/search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma.client.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockClients)
    ;(prisma.matter.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockMatters)
  })

  it('returns 401 if no session', async () => {
    const res = await handleSearch('aps', null)
    expect(res.status).toBe(401)
  })

  it('returns 400 if query is less than 2 characters', async () => {
    const res = await handleSearch('a', adminSession)
    expect(res.status).toBe(400)
  })

  it('returns clients and matters matching query', async () => {
    const res = await handleSearch('aps', adminSession)
    expect(res.status).toBe(200)
    const body = res.body as { clients: unknown[]; matters: unknown[] }
    expect(body.clients).toHaveLength(1)
    expect(body.matters).toHaveLength(1)
  })

  it('results are grouped correctly (clients array, matters array)', async () => {
    const res = await handleSearch('aps', adminSession)
    expect(res.status).toBe(200)
    const body = res.body as { clients: unknown[]; matters: unknown[] }
    expect(Array.isArray(body.clients)).toBe(true)
    expect(Array.isArray(body.matters)).toBe(true)
  })

  it('applies matter access control for non-admin (AND filter added)', async () => {
    await handleSearch('aps', feeEarnerSession)
    const matterCall = (prisma.matter.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(matterCall.where.AND).toBeDefined()
    expect(matterCall.where.AND[0].OR[0].ownerId).toBe('user-2')
  })

  it('admin does not get access control filter on matters', async () => {
    await handleSearch('aps', adminSession)
    const matterCall = (prisma.matter.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(matterCall.where.AND).toBeUndefined()
  })

  it('clients have type field set to "client"', async () => {
    const res = await handleSearch('aps', adminSession)
    const body = res.body as { clients: Array<{ type: string }> }
    expect(body.clients[0].type).toBe('client')
  })

  it('matters have type field set to "matter"', async () => {
    const res = await handleSearch('aps', adminSession)
    const body = res.body as { matters: Array<{ type: string }> }
    expect(body.matters[0].type).toBe('matter')
  })
})
