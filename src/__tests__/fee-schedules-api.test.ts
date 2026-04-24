import { beforeEach, describe, expect, it, vi } from 'vitest'

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
    feeScheduleCategory: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    feeScheduleItem: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { GET as getSchedules, POST as postSchedule } from '@/app/api/fee-schedules/route'
import {
  GET as getScheduleItems,
  POST as postScheduleItem,
} from '@/app/api/fee-schedules/[id]/items/route'

const adminSession = { user: { id: 'admin-1', role: 'admin' } }
const feeEarnerSession = { user: { id: 'fee-1', role: 'fee_earner' } }
const assistantSession = { user: { id: 'assistant-1', role: 'assistant' } }

describe('/api/fee-schedules permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma.feeScheduleCategory.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'cat-1', name: 'Trade Marks', _count: { items: 1 } },
    ])
    ;(prisma.feeScheduleCategory.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'cat-2',
      name: 'Patents',
      jurisdiction: 'ZA',
      currency: 'ZAR',
    })
    ;(prisma.feeScheduleItem.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'item-1',
        categoryId: 'cat-1',
        section: 'Applications',
        description: 'Attendance / Consultation',
      },
    ])
    ;(prisma.feeScheduleItem.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'item-2',
      categoryId: 'cat-1',
      section: 'Applications',
      description: 'Drafting / Preparation',
      professionalFeeCents: 100000,
    })
  })

  it('allows fee earners to read fee schedules', async () => {
    ;(getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(feeEarnerSession)

    const response = await getSchedules()

    expect(response.status).toBe(200)
    expect(prisma.feeScheduleCategory.findMany).toHaveBeenCalled()
  })

  it('allows assistants to read fee schedules', async () => {
    ;(getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(assistantSession)

    const response = await getSchedules()

    expect(response.status).toBe(200)
  })

  it('returns 401 when reading fee schedules without a session', async () => {
    ;(getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const response = await getSchedules()

    expect(response.status).toBe(401)
    expect(prisma.feeScheduleCategory.findMany).not.toHaveBeenCalled()
  })

  it('allows fee earners to read fee schedule items', async () => {
    ;(getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(feeEarnerSession)

    const response = await getScheduleItems(new Request('http://localhost/api/fee-schedules/cat-1/items'), {
      params: Promise.resolve({ id: 'cat-1' }),
    })

    expect(response.status).toBe(200)
    expect(prisma.feeScheduleItem.findMany).toHaveBeenCalledWith({
      where: { categoryId: 'cat-1' },
      orderBy: [{ sortOrder: 'asc' }, { description: 'asc' }],
    })
  })

  it('allows assistants to read fee schedule items', async () => {
    ;(getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(assistantSession)

    const response = await getScheduleItems(new Request('http://localhost/api/fee-schedules/cat-1/items'), {
      params: Promise.resolve({ id: 'cat-1' }),
    })

    expect(response.status).toBe(200)
  })

  it('returns 401 when reading fee schedule items without a session', async () => {
    ;(getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const response = await getScheduleItems(new Request('http://localhost/api/fee-schedules/cat-1/items'), {
      params: Promise.resolve({ id: 'cat-1' }),
    })

    expect(response.status).toBe(401)
    expect(prisma.feeScheduleItem.findMany).not.toHaveBeenCalled()
  })

  it('keeps fee-schedule category mutations admin-only', async () => {
    ;(getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(feeEarnerSession)

    const response = await postSchedule(
      new Request('http://localhost/api/fee-schedules', {
        method: 'POST',
        body: JSON.stringify({ name: 'Patents', jurisdiction: 'ZA' }),
      }),
    )

    expect(response.status).toBe(403)
    expect(prisma.feeScheduleCategory.create).not.toHaveBeenCalled()
  })

  it('allows admins to create fee-schedule categories', async () => {
    ;(getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(adminSession)

    const response = await postSchedule(
      new Request('http://localhost/api/fee-schedules', {
        method: 'POST',
        body: JSON.stringify({ name: 'Patents', jurisdiction: 'ZA' }),
      }),
    )

    expect(response.status).toBe(201)
    expect(prisma.feeScheduleCategory.create).toHaveBeenCalledWith({
      data: { name: 'Patents', jurisdiction: 'ZA', currency: 'ZAR' },
    })
  })

  it('keeps fee-schedule item mutations admin-only', async () => {
    ;(getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(feeEarnerSession)

    const response = await postScheduleItem(
      new Request('http://localhost/api/fee-schedules/cat-1/items', {
        method: 'POST',
        body: JSON.stringify({
          section: 'Applications',
          description: 'Drafting / Preparation',
          professionalFeeCents: 100000,
        }),
      }),
      { params: Promise.resolve({ id: 'cat-1' }) },
    )

    expect(response.status).toBe(403)
    expect(prisma.feeScheduleItem.create).not.toHaveBeenCalled()
  })

  it('allows admins to create fee-schedule items', async () => {
    ;(getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(adminSession)

    const response = await postScheduleItem(
      new Request('http://localhost/api/fee-schedules/cat-1/items', {
        method: 'POST',
        body: JSON.stringify({
          section: 'Applications',
          description: 'Drafting / Preparation',
          professionalFeeCents: 100000,
        }),
      }),
      { params: Promise.resolve({ id: 'cat-1' }) },
    )

    expect(response.status).toBe(201)
    expect(prisma.feeScheduleItem.create).toHaveBeenCalledWith({
      data: {
        categoryId: 'cat-1',
        section: 'Applications',
        description: 'Drafting / Preparation',
        officialFeeCents: 0,
        professionalFeeCents: 100000,
        sortOrder: null,
      },
    })
  })
})
