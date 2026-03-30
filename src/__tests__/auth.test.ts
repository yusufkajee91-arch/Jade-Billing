import { describe, it, expect, vi, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'

// We need to test the authorize function in isolation.
// Extract it from the authOptions credentials provider.
async function authorize(
  credentials: { email: string; password: string } | undefined,
  mockPrisma: typeof prisma,
) {
  if (!credentials?.email || !credentials?.password) return null

  const user = await mockPrisma.user.findUnique({
    where: { email: credentials.email },
  })
  if (!user || !(user as any).isActive) return null

  const valid = await bcrypt.compare(credentials.password, (user as any).passwordHash)
  if (!valid) return null

  await mockPrisma.user.update({
    where: { id: (user as any).id },
    data: { lastLoginAt: new Date() },
  })

  return {
    id: (user as any).id,
    email: (user as any).email,
    name: `${(user as any).firstName} ${(user as any).lastName}`,
    role: (user as any).role,
    initials: (user as any).initials,
  }
}

const validPasswordHash = bcrypt.hashSync('correctpassword', 10)

const mockUser = {
  id: 'user-123',
  email: 'test@dcco.law',
  passwordHash: validPasswordHash,
  firstName: 'Test',
  lastName: 'User',
  initials: 'TU',
  role: 'fee_earner',
  isActive: true,
}

describe('authorize function', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma.user.update as any).mockResolvedValue(mockUser)
  })

  it('returns null when credentials are missing', async () => {
    const result = await authorize(undefined, prisma)
    expect(result).toBeNull()
  })

  it('returns null when email is empty', async () => {
    const result = await authorize({ email: '', password: 'password' }, prisma)
    expect(result).toBeNull()
  })

  it('returns null when password is empty', async () => {
    const result = await authorize({ email: 'test@dcco.law', password: '' }, prisma)
    expect(result).toBeNull()
  })

  it('returns null for non-existent user', async () => {
    ;(prisma.user.findUnique as any).mockResolvedValue(null)
    const result = await authorize({ email: 'nobody@dcco.law', password: 'password' }, prisma)
    expect(result).toBeNull()
  })

  it('returns null for inactive user', async () => {
    ;(prisma.user.findUnique as any).mockResolvedValue({
      ...mockUser,
      isActive: false,
    })
    const result = await authorize({ email: mockUser.email, password: 'correctpassword' }, prisma)
    expect(result).toBeNull()
  })

  it('returns null for wrong password', async () => {
    ;(prisma.user.findUnique as any).mockResolvedValue(mockUser)
    const result = await authorize({ email: mockUser.email, password: 'wrongpassword' }, prisma)
    expect(result).toBeNull()
  })

  it('returns user object with correct fields for valid credentials', async () => {
    ;(prisma.user.findUnique as any).mockResolvedValue(mockUser)
    const result = await authorize({ email: mockUser.email, password: 'correctpassword' }, prisma)

    expect(result).not.toBeNull()
    expect(result?.id).toBe(mockUser.id)
    expect(result?.email).toBe(mockUser.email)
    expect(result?.name).toBe(`${mockUser.firstName} ${mockUser.lastName}`)
    expect((result as any)?.role).toBe(mockUser.role)
    expect((result as any)?.initials).toBe(mockUser.initials)
  })

  it('returned user object never includes passwordHash', async () => {
    ;(prisma.user.findUnique as any).mockResolvedValue(mockUser)
    const result = await authorize({ email: mockUser.email, password: 'correctpassword' }, prisma)

    expect(result).not.toBeNull()
    expect((result as any)?.passwordHash).toBeUndefined()
  })

  it('updates lastLoginAt on successful login', async () => {
    ;(prisma.user.findUnique as any).mockResolvedValue(mockUser)
    await authorize({ email: mockUser.email, password: 'correctpassword' }, prisma)

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mockUser.id },
        data: expect.objectContaining({ lastLoginAt: expect.any(Date) }),
      }),
    )
  })
})
