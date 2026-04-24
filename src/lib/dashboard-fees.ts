export type ChartDayData = {
  day: number
  current: number
  previous: number
  target?: number
}

export type FeeEntryForChart = {
  entryDate: Date
  totalCents: number
}

export type InvoiceLineItemForChart = {
  entryType: string
  totalCents: number
  feeEntryId?: string | null
}

export type BilledInvoiceForChart = {
  sentAt: Date | null
  invoiceDate: Date
  lineItems: InvoiceLineItemForChart[]
}

const FEE_LINE_ITEM_TYPES = new Set(['time', 'unitary'])

export function isFeeLineItem(entryType: string): boolean {
  return FEE_LINE_ITEM_TYPES.has(entryType)
}

export function bucketFeeEntriesByDay(entries: FeeEntryForChart[]): Map<number, number> {
  const map = new Map<number, number>()
  for (const entry of entries) {
    const day = new Date(entry.entryDate).getUTCDate()
    map.set(day, (map.get(day) ?? 0) + entry.totalCents)
  }
  return map
}

export function bucketBilledInvoicesByDay(
  invoices: BilledInvoiceForChart[],
  allowedFeeEntryIds?: Set<string>,
): Map<number, number> {
  const map = new Map<number, number>()
  for (const invoice of invoices) {
    const billedDate = invoice.sentAt ?? invoice.invoiceDate
    const day = new Date(billedDate).getUTCDate()
    for (const lineItem of invoice.lineItems) {
      if (!isFeeLineItem(lineItem.entryType)) continue
      if (allowedFeeEntryIds) {
        if (!lineItem.feeEntryId || !allowedFeeEntryIds.has(lineItem.feeEntryId)) continue
      }
      map.set(day, (map.get(day) ?? 0) + lineItem.totalCents)
    }
  }
  return map
}

export function bucketBilledInvoicesByEarnerDay(
  invoices: BilledInvoiceForChart[],
  feeEntryEarnerIds: Map<string, string>,
): Map<string, Map<number, number>> {
  const byEarner = new Map<string, Map<number, number>>()
  for (const invoice of invoices) {
    const billedDate = invoice.sentAt ?? invoice.invoiceDate
    const day = new Date(billedDate).getUTCDate()
    for (const lineItem of invoice.lineItems) {
      if (!isFeeLineItem(lineItem.entryType) || !lineItem.feeEntryId) continue
      const earnerId = feeEntryEarnerIds.get(lineItem.feeEntryId)
      if (!earnerId) continue
      const dayMap = byEarner.get(earnerId) ?? new Map<number, number>()
      dayMap.set(day, (dayMap.get(day) ?? 0) + lineItem.totalCents)
      byEarner.set(earnerId, dayMap)
    }
  }
  return byEarner
}

export function buildCumulativeSeries({
  daysInCurrent,
  daysInPrevious,
  today,
  currentMap,
  previousMap,
  targetForDay,
}: {
  daysInCurrent: number
  daysInPrevious: number
  today: number
  currentMap: Map<number, number>
  previousMap: Map<number, number>
  targetForDay?: (day: number) => number | undefined
}): ChartDayData[] {
  const data: ChartDayData[] = []
  const maxDays = Math.max(daysInCurrent, daysInPrevious)
  let currentCumulative = 0
  let previousCumulative = 0

  for (let day = 1; day <= maxDays; day++) {
    if (day <= daysInCurrent && day <= today) currentCumulative += currentMap.get(day) ?? 0
    if (day <= daysInPrevious) previousCumulative += previousMap.get(day) ?? 0

    const point: ChartDayData = {
      day,
      current: day <= today && day <= daysInCurrent ? currentCumulative : 0,
      previous: day <= daysInPrevious ? previousCumulative : 0,
    }
    const target = targetForDay?.(day)
    if (target != null) point.target = target
    data.push(point)
  }

  return data
}

export function buildEarnerCumulativeData({
  earnerIds,
  daysInCurrent,
  today,
  earnerDayMap,
}: {
  earnerIds: string[]
  daysInCurrent: number
  today: number
  earnerDayMap: Map<string, Map<number, number>>
}): Array<Record<string, number>> {
  const cumulatives = new Map<string, number>()
  for (const earnerId of earnerIds) cumulatives.set(earnerId, 0)

  const data: Array<Record<string, number>> = []
  for (let day = 1; day <= daysInCurrent; day++) {
    const point: Record<string, number> = { day }
    for (const earnerId of earnerIds) {
      if (day <= today) {
        const dayValue = earnerDayMap.get(earnerId)?.get(day) ?? 0
        cumulatives.set(earnerId, (cumulatives.get(earnerId) ?? 0) + dayValue)
        point[earnerId] = cumulatives.get(earnerId)!
      }
    }
    data.push(point)
  }
  return data
}
