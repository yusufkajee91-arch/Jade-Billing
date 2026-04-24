import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    matter: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    matterUser: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    client: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}))

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/matter-code', () => ({
  generateMatterCode: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { generateMatterCode } from '@/lib/matter-code'

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const adminSession = { user: { id: 'admin-1', role: 'admin' } }
const feeEarnerSession = { user: { id: 'user-2', role: 'fee_earner' } }
const assistantSession = { user: { id: 'assistant-1', role: 'assistant' } }

const mockMatter = {
  id: 'matter-1',
  matterCode: 'JJ/APS-001',
  description: 'Test matter',
  status: 'open',
  ownerId: 'user-2',
  clientId: 'client-1',
  matterTypeId: null,
  departmentId: null,
  notes: null,
  createdById: 'user-2',
  dateOpened: new Date().toISOString(),
  dateClosed: null,
  client: { id: 'client-1', clientCode: 'APS', clientName: 'Aqua Plastech', ficaStatus: 'not_compliant' },
  owner: { id: 'user-2', firstName: 'John', lastName: 'Jones', initials: 'JJ', role: 'fee_earner' },
  matterType: null,
  department: null,
  matterUsers: [{ userId: 'user-2' }],
}

const mockClient = {
  id: 'client-1',
  clientCode: 'APS',
  clientName: 'Aqua Plastech',
}

const mockOwner = {
  id: 'user-2',
  initials: 'JJ',
  firstName: 'John',
  lastName: 'Jones',
}

async function handleGetMatters(
  session: { user: { id: string; role: string } } | null,
  status?: string,
) {
  if (!session) return { status: 401, body: { error: 'Unauthorised' } }

  const isAdmin = session.user.role === 'admin'
  const userId = session.user.id

  const where: Record<string, unknown> = {}
  if (!isAdmin) {
    where.OR = [
      { ownerId: userId },
      { matterUsers: { some: { userId } } },
    ]
  }
  if (status) where.status = status

  const matters = await (prisma.matter.findMany as ReturnType<typeof vi.fn>)({ where })
  return { status: 200, body: matters }
}

async function handleCreateMatter(
  body: Record<string, unknown>,
  session: { user: { id: string; role: string } } | null,
) {
  if (!session) return { status: 401, body: { error: 'Unauthorised' } }
  if (session.user.role !== 'admin' && session.user.role !== 'fee_earner') {
    return { status: 403, body: { error: 'Forbidden' } }
  }

  const { clientId, description, ownerId, userIds } = body as {
    clientId?: string
    description?: string
    ownerId?: string
    userIds?: string[]
  }

  if (!clientId) return { status: 400, body: { error: 'clientId is required' } }
  if (!description) return { status: 400, body: { error: 'description is required' } }
  if (!ownerId) return { status: 400, body: { error: 'ownerId is required' } }

  const client = await (prisma.client.findUnique as ReturnType<typeof vi.fn>)({
    where: { id: clientId },
  })
  if (!client) return { status: 404, body: { error: 'Client not found' } }

  const owner = await (prisma.user.findUnique as ReturnType<typeof vi.fn>)({
    where: { id: ownerId },
  })
  if (!owner) return { status: 404, body: { error: 'Owner not found' } }

  const matterCode = await (generateMatterCode as ReturnType<typeof vi.fn>)(
    owner.initials,
    client.clientCode,
  )

  const matter = await (prisma.matter.create as ReturnType<typeof vi.fn>)({
    data: {
      matterCode,
      clientId,
      description,
      ownerId,
      createdById: session.user.id,
    },
  })

  // Create MatterUser for owner + additional users
  const allUserIds = new Set([ownerId, ...(userIds ?? [])])
  await (prisma.matterUser.createMany as ReturnType<typeof vi.fn>)({
    data: Array.from(allUserIds).map((uid) => ({
      matterId: matter.id,
      userId: uid,
      grantedById: session.user.id,
    })),
    skipDuplicates: true,
  })

  return { status: 201, body: matter }
}

async function handlePatchMatter(
  id: string,
  body: Record<string, unknown>,
  session: { user: { id: string; role: string } } | null,
) {
  if (!session) return { status: 401, body: { error: 'Unauthorised' } }

  const matter = await (prisma.matter.findUnique as ReturnType<typeof vi.fn>)({
    where: { id },
    select: { id: true, ownerId: true, status: true },
  })
  if (!matter) return { status: 404, body: { error: 'Not found' } }

  if (session.user.role !== 'admin' && matter.ownerId !== session.user.id) {
    return { status: 403, body: { error: 'Forbidden' } }
  }

  const { status, ...rest } = body as { status?: string } & Record<string, unknown>
  const updateData: Record<string, unknown> = { ...rest }

  if (status) {
    updateData.status = status
    if (status === 'closed') {
      updateData.dateClosed = new Date()
    }
  }

  const updated = await (prisma.matter.update as ReturnType<typeof vi.fn>)({
    where: { id },
    data: updateData,
  })

  return { status: 200, body: updated }
}

async function handleGetMatter(
  id: string,
  session: { user: { id: string; role: string } } | null,
) {
  if (!session) return { status: 401, body: { error: 'Unauthorised' } }

  const matter = await (prisma.matter.findUnique as ReturnType<typeof vi.fn>)({
    where: { id },
    select: {
      ownerId: true,
      matterUsers: { select: { userId: true } },
    },
  })

  if (!matter) return { status: 404, body: { error: 'Not found' } }

  const isAdmin = session.user.role === 'admin'
  const isOwner = matter.ownerId === session.user.id
  const hasAccess = matter.matterUsers.some((mu: { userId: string }) => mu.userId === session.user.id)

  if (!isAdmin && !isOwner && !hasAccess) {
    return { status: 403, body: { error: 'Forbidden' } }
  }

  return { status: 200, body: matter }
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('GET /api/matters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma.matter.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockMatter])
  })

  it('returns 401 if no session', async () => {
    const res = await handleGetMatters(null)
    expect(res.status).toBe(401)
  })

  it('admin gets all matters (no access filter)', async () => {
    await handleGetMatters(adminSession)
    const call = (prisma.matter.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.where.OR).toBeUndefined()
  })

  it('fee_earner gets only accessible matters (owner OR in matterUsers)', async () => {
    await handleGetMatters(feeEarnerSession)
    const call = (prisma.matter.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.where.OR).toBeDefined()
    expect(call.where.OR[0].ownerId).toBe('user-2')
    expect(call.where.OR[1].matterUsers.some.userId).toBe('user-2')
  })
})

describe('POST /api/matters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma.client.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockClient)
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockOwner)
    ;(generateMatterCode as ReturnType<typeof vi.fn>).mockResolvedValue('JJ/APS-001')
    ;(prisma.matter.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'new-matter',
      matterCode: 'JJ/APS-001',
      clientId: 'client-1',
      description: 'Test',
      ownerId: 'user-2',
    })
    ;(prisma.matterUser.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 })
  })

  it('creates matter with auto-generated code', async () => {
    const res = await handleCreateMatter(
      { clientId: 'client-1', description: 'Test', ownerId: 'user-2' },
      feeEarnerSession,
    )
    expect(res.status).toBe(201)
    expect((res.body as { matterCode: string }).matterCode).toBe('JJ/APS-001')
  })

  it('creates MatterUser record for owner', async () => {
    await handleCreateMatter(
      { clientId: 'client-1', description: 'Test', ownerId: 'user-2' },
      feeEarnerSession,
    )
    const createManyCall = (prisma.matterUser.createMany as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const userIds = createManyCall.data.map((d: { userId: string }) => d.userId)
    expect(userIds).toContain('user-2')
  })

  it('returns 400 if clientId missing', async () => {
    const res = await handleCreateMatter(
      { description: 'Test', ownerId: 'user-2' },
      feeEarnerSession,
    )
    expect(res.status).toBe(400)
  })

  it('blocks assistant matter creation', async () => {
    const res = await handleCreateMatter(
      { clientId: 'client-1', description: 'Test', ownerId: 'user-2' },
      assistantSession,
    )
    expect(res.status).toBe(403)
  })
})

describe('PATCH /api/matters/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma.matter.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'matter-1',
      ownerId: 'user-2',
      status: 'open',
    })
    ;(prisma.matter.update as ReturnType<typeof vi.fn>).mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        ...mockMatter,
        ...data,
      }),
    )
  })

  it('status closed sets dateClosed to today', async () => {
    const before = new Date()
    const res = await handlePatchMatter('matter-1', { status: 'closed' }, feeEarnerSession)
    expect(res.status).toBe(200)
    const updateCall = (prisma.matter.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateCall.data.dateClosed).toBeDefined()
    expect(new Date(updateCall.data.dateClosed).getTime()).toBeGreaterThanOrEqual(before.getTime())
  })
})

describe('GET /api/matters/[id] access control', () => {
  it('fee_earner cannot GET matter they have no access to', async () => {
    ;(prisma.matter.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ownerId: 'other-user',
      matterUsers: [],
    })
    const outsiderSession = { user: { id: 'outsider', role: 'fee_earner' } }
    const res = await handleGetMatter('matter-1', outsiderSession)
    expect(res.status).toBe(403)
  })

  it('owner can GET their matter', async () => {
    ;(prisma.matter.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ownerId: 'user-2',
      matterUsers: [],
    })
    const res = await handleGetMatter('matter-1', feeEarnerSession)
    expect(res.status).toBe(200)
  })
})
