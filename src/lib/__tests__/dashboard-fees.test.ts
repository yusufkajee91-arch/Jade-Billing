import { describe, expect, it } from 'vitest'
import {
  bucketBilledInvoicesByDay,
  bucketBilledInvoicesByEarnerDay,
  buildCumulativeSeries,
} from '../dashboard-fees'

describe('dashboard fees aggregation', () => {
  it('buckets billed fee line totals by sent date and excludes non-fee lines', () => {
    const result = bucketBilledInvoicesByDay([
      {
        sentAt: new Date('2026-04-03T10:00:00.000Z'),
        invoiceDate: new Date('2026-04-01T00:00:00.000Z'),
        lineItems: [
          { entryType: 'time', totalCents: 10_000, feeEntryId: 'fee-1' },
          { entryType: 'unitary', totalCents: 5_000, feeEntryId: 'fee-2' },
          { entryType: 'disbursement', totalCents: 99_999, feeEntryId: 'disb-1' },
        ],
      },
      {
        sentAt: null,
        invoiceDate: new Date('2026-04-02T00:00:00.000Z'),
        lineItems: [{ entryType: 'time', totalCents: 50_000, feeEntryId: 'legacy-1' }],
      },
      {
        sentAt: new Date('2026-04-04T08:00:00.000Z'),
        invoiceDate: new Date('2026-04-04T00:00:00.000Z'),
        lineItems: [{ entryType: 'time', totalCents: 7_500, feeEntryId: 'fee-3' }],
      },
    ])

    expect(result.get(3)).toBe(15_000)
    expect(result.get(4)).toBe(7_500)
    expect(result.get(2)).toBe(50_000)
  })

  it('can restrict billed totals to a scoped set of fee entries', () => {
    const result = bucketBilledInvoicesByDay(
      [
        {
          sentAt: new Date('2026-04-03T10:00:00.000Z'),
          invoiceDate: new Date('2026-04-03T00:00:00.000Z'),
          lineItems: [
            { entryType: 'time', totalCents: 10_000, feeEntryId: 'mine' },
            { entryType: 'time', totalCents: 20_000, feeEntryId: 'theirs' },
            { entryType: 'time', totalCents: 30_000, feeEntryId: null },
          ],
        },
      ],
      new Set(['mine']),
    )

    expect(result.get(3)).toBe(10_000)
  })

  it('attributes billed line items to earners through fee entry ids', () => {
    const result = bucketBilledInvoicesByEarnerDay(
      [
        {
          sentAt: new Date('2026-04-05T10:00:00.000Z'),
          invoiceDate: new Date('2026-04-05T00:00:00.000Z'),
          lineItems: [
            { entryType: 'time', totalCents: 12_000, feeEntryId: 'fee-a' },
            { entryType: 'unitary', totalCents: 8_000, feeEntryId: 'fee-b' },
            { entryType: 'disbursement', totalCents: 100_000, feeEntryId: 'fee-a' },
          ],
        },
      ],
      new Map([
        ['fee-a', 'earner-1'],
        ['fee-b', 'earner-2'],
      ]),
    )

    expect(result.get('earner-1')?.get(5)).toBe(12_000)
    expect(result.get('earner-2')?.get(5)).toBe(8_000)
  })

  it('builds cumulative current and previous month series', () => {
    const result = buildCumulativeSeries({
      daysInCurrent: 4,
      daysInPrevious: 3,
      today: 3,
      currentMap: new Map([
        [1, 100],
        [3, 200],
        [4, 400],
      ]),
      previousMap: new Map([
        [1, 50],
        [2, 75],
      ]),
      targetForDay: (day) => day * 10,
    })

    expect(result).toEqual([
      { day: 1, current: 100, previous: 50, target: 10 },
      { day: 2, current: 100, previous: 125, target: 20 },
      { day: 3, current: 300, previous: 125, target: 30 },
      { day: 4, current: 0, previous: 0, target: 40 },
    ])
  })
})
