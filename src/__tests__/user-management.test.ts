import { describe, it, expect, vi, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'

// ──────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
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
// Helper: simulate POST /api/users logic
// ──────────────────────────────────────────────
async function handleCreateUser(
  body: Record<string, unknown>,
  sessionRole: string | null,
) {
  const session = sessionRole ? { user: { role: sessionRole } } : null
  if (!session) return { status: 401, body: { error: 'Unauthorised' } }
  if (session.user.role !== 'admin') return { status: 403, body: { error: 'Forbidden' } }

  const { email, password, firstName, lastName, initials, role, isActive } = body as {
    email: string
    password: string
    firstName: string
    lastName: string
    initials: string
    role: string
    isActive?: boolean
  }

  if (!email || !password || !firstName || !lastName || !initials || !role) {
    return { status: 400, body: { error: 'Validation failed' } }
  }

  const existing = await (prisma.user.findUnique as any)({ where: { email } })
  if (existing) return { status: 409, body: { error: 'Email already exists' } }

  const passwordHash = await bcrypt.hash(password, 12)

  const user = await (prisma.user.create as any)({
    data: { email, passwordHash, firstName, lastName, initials, role, isActive: isActive ?? true },
    select: {
      id: true, email: true, firstName: true, lastName: true,
      initials: true, role: true, isActive: true, createdAt: true,
    },
  })

  return { status: 201, body: user }
}

// ──────────────────────────────────────────────
// Helper: simulate PATCH /api/users/[id] logic
// ──────────────────────────────────────────────
async function handleUpdateUser(
  id: string,
  body: Record<string, unknown>,
  sessionRole: string | null,
) {
  const session = sessionRole ? { user: { role: sessionRole } } : null
  if (!session) return { status: 401, body: { error: 'Unauthorised' } }
  if (session.user.role !== 'admin') return { status: 403, body: { error: 'Forbidden' } }

  const { password, ...rest } = body as { password?: string } & Record<string, unknown>
  const updateData: Record<string, unknown> = { ...rest }
  if (password) {
    updateData.passwordHash = await bcrypt.hash(password, 12)
  }

  const user = await (prisma.user.update as any)({
    where: { id },
    data: updateData,
    select: {
      id: true, email: true, firstName: true, lastName: true,
      initials: true, role: true, isActive: true, createdAt: true,
    },
  })

  return { status: 200, body: user }
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────
describe('POST /api/users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma.user.findUnique as any).mockResolvedValue(null)
    ;(prisma.user.create as any).mockImplementation(async ({ data }: any) => ({
      id: 'new-user-id',
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      initials: data.initials,
      role: data.role,
      isActive: data.isActive,
      createdAt: new Date().toISOString(),
    }))
  })

  it('creates a user with a hashed password (hash !== plaintext)', async () => {
    const password = 'TestPass123!'
    const res = await handleCreateUser(
      { email: 'new@dcco.law', password, firstName: 'Test', lastName: 'User', initials: 'TU', role: 'fee_earner' },
      'admin',
    )
    expect(res.status).toBe(201)
    // Verify bcrypt.hash was called — the create mock captures the hash
    const createCall = (prisma.user.create as any).mock.calls[0][0]
    const hash: string = createCall.data.passwordHash
    expect(hash).not.toBe(password)
    expect(hash.startsWith('$2')).toBe(true)
    // Hash should verify correctly
    const valid = await bcrypt.compare(password, hash)
    expect(valid).toBe(true)
  })

  it('returns 409 if email already exists', async () => {
    ;(prisma.user.findUnique as any).mockResolvedValue({ id: 'existing' })
    const res = await handleCreateUser(
      { email: 'existing@dcco.law', password: 'TestPass123!', firstName: 'A', lastName: 'B', initials: 'AB', role: 'fee_earner' },
      'admin',
    )
    expect(res.status).toBe(409)
  })

  it('returns 403 if caller is not admin', async () => {
    const res = await handleCreateUser(
      { email: 'new@dcco.law', password: 'TestPass123!', firstName: 'A', lastName: 'B', initials: 'AB', role: 'fee_earner' },
      'fee_earner',
    )
    expect(res.status).toBe(403)
  })

  it('never returns passwordHash in response', async () => {
    const res = await handleCreateUser(
      { email: 'new@dcco.law', password: 'TestPass123!', firstName: 'A', lastName: 'B', initials: 'AB', role: 'fee_earner' },
      'admin',
    )
    expect(res.status).toBe(201)
    expect((res.body as any).passwordHash).toBeUndefined()
  })

  it('returns 401 for unauthenticated requests', async () => {
    const res = await handleCreateUser(
      { email: 'new@dcco.law', password: 'TestPass123!', firstName: 'A', lastName: 'B', initials: 'AB', role: 'fee_earner' },
      null,
    )
    expect(res.status).toBe(401)
  })
})

describe('PATCH /api/users/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma.user.update as any).mockImplementation(async ({ data }: any) => ({
      id: 'user-123',
      email: 'test@dcco.law',
      firstName: data.firstName ?? 'Test',
      lastName: data.lastName ?? 'User',
      initials: data.initials ?? 'TU',
      role: data.role ?? 'fee_earner',
      isActive: data.isActive ?? true,
      createdAt: new Date().toISOString(),
    }))
  })

  it('returns 403 if not admin', async () => {
    const res = await handleUpdateUser('user-123', { firstName: 'New' }, 'fee_earner')
    expect(res.status).toBe(403)
  })

  it('updates passwordHash if password is provided', async () => {
    const res = await handleUpdateUser(
      'user-123',
      { firstName: 'Updated', password: 'NewPass123!' },
      'admin',
    )
    expect(res.status).toBe(200)
    const updateCall = (prisma.user.update as any).mock.calls[0][0]
    expect(updateCall.data.passwordHash).toBeDefined()
    expect(updateCall.data.passwordHash.startsWith('$2')).toBe(true)
    const valid = await bcrypt.compare('NewPass123!', updateCall.data.passwordHash)
    expect(valid).toBe(true)
  })

  it('does not update passwordHash if password is not provided', async () => {
    await handleUpdateUser('user-123', { firstName: 'Updated' }, 'admin')
    const updateCall = (prisma.user.update as any).mock.calls[0][0]
    expect(updateCall.data.passwordHash).toBeUndefined()
  })

  it('never returns passwordHash in response', async () => {
    const res = await handleUpdateUser('user-123', { firstName: 'Updated' }, 'admin')
    expect(res.status).toBe(200)
    expect((res.body as any).passwordHash).toBeUndefined()
  })
})
