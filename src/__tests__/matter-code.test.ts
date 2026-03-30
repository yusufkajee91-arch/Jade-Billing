import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}))

import { prisma } from '@/lib/prisma'
import { generateMatterCode } from '@/lib/matter-code'

describe('generateMatterCode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns correct format JJ/APS-001', async () => {
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([{ last_sequence: 1 }])
    const code = await generateMatterCode('JJ', 'APS')
    expect(code).toBe('JJ/APS-001')
  })

  it('pads sequence to 3 digits: seq 1 → 001', async () => {
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([{ last_sequence: 1 }])
    const code = await generateMatterCode('JJ', 'APS')
    expect(code).toBe('JJ/APS-001')
  })

  it('pads sequence to 3 digits: seq 10 → 010', async () => {
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([{ last_sequence: 10 }])
    const code = await generateMatterCode('JJ', 'APS')
    expect(code).toBe('JJ/APS-010')
  })

  it('pads sequence to 3 digits: seq 100 → 100', async () => {
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([{ last_sequence: 100 }])
    const code = await generateMatterCode('JJ', 'APS')
    expect(code).toBe('JJ/APS-100')
  })

  it('different earner+client combos produce independent sequences', async () => {
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([{ last_sequence: 3 }])
      .mockResolvedValueOnce([{ last_sequence: 7 }])

    const code1 = await generateMatterCode('JJ', 'APS')
    const code2 = await generateMatterCode('MD', 'XYZ')

    expect(code1).toBe('JJ/APS-003')
    expect(code2).toBe('MD/XYZ-007')
  })

  it('uses correct initials and client code in output', async () => {
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([{ last_sequence: 5 }])
    const code = await generateMatterCode('ABC', 'CLIENT')
    expect(code).toBe('ABC/CLIENT-005')
  })
})
