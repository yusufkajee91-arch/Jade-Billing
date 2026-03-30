import { APIRequestContext } from '@playwright/test'

const BASE = 'http://localhost:3001'

export async function createClient(request: APIRequestContext, data: {
  clientName: string
  clientCode?: string
  entityType?: string
  emailGeneral?: string
}) {
  const res = await request.post(`${BASE}/api/clients`, {
    data: {
      clientName: data.clientName,
      clientCode: data.clientCode || data.clientName.substring(0, 3).toUpperCase(),
      entityType: data.entityType || 'company_pty',
      emailGeneral: data.emailGeneral || 'test@example.com',
    },
  })
  return res.json()
}

export async function createMatter(request: APIRequestContext, data: {
  clientId: string
  description: string
  ownerId?: string
  matterTypeId?: string
}) {
  const res = await request.post(`${BASE}/api/matters`, {
    data: {
      clientId: data.clientId,
      description: data.description,
      ownerId: data.ownerId || 'seed-admin-user',
      matterTypeId: data.matterTypeId || 'seed-mt-general',
    },
  })
  return res.json()
}

export async function createFeeEntry(request: APIRequestContext, data: {
  matterId: string
  narration: string
  entryType?: string
  billedMinutes?: number
  rateCents?: number
  feeEarnerId?: string
  entryDate?: string
  isBillable?: boolean
}) {
  const entryType = data.entryType || 'time'
  const res = await request.post(`${BASE}/api/fee-entries`, {
    data: {
      matterId: data.matterId,
      narration: data.narration,
      entryType,
      // API expects durationMinutesRaw for time entries (not billedMinutes)
      durationMinutesRaw: entryType === 'time' ? (data.billedMinutes || 60) : undefined,
      rateCents: data.rateCents || 200000,
      feeEarnerId: data.feeEarnerId || 'seed-admin-user',
      entryDate: data.entryDate || new Date().toISOString().split('T')[0],
      isBillable: data.isBillable ?? true,
      discountPct: 0,
    },
  })
  return res.json()
}

export async function createTrustEntry(request: APIRequestContext, data: {
  matterId: string
  entryType: string
  amountCents: number
  narration: string
  entryDate?: string
}) {
  const res = await request.post(`${BASE}/api/trust-entries`, {
    data: {
      matterId: data.matterId,
      entryType: data.entryType,
      amountCents: data.amountCents,
      narration: data.narration,
      entryDate: data.entryDate || new Date().toISOString().split('T')[0],
    },
  })
  return res.json()
}

export async function createBusinessEntry(request: APIRequestContext, data: {
  entryType: string
  amountCents: number
  narration: string
  matterId?: string
  entryDate?: string
}) {
  const res = await request.post(`${BASE}/api/business-entries`, {
    data: {
      entryType: data.entryType,
      amountCents: data.amountCents,
      narration: data.narration,
      matterId: data.matterId,
      entryDate: data.entryDate || new Date().toISOString().split('T')[0],
    },
  })
  return res.json()
}

export async function createDiaryEntry(request: APIRequestContext, data: {
  title: string
  matterId: string
  dueDate: string
  assignedToId?: string
}) {
  const res = await request.post(`${BASE}/api/diary`, {
    data: {
      title: data.title,
      matterId: data.matterId,
      dueDate: data.dueDate,
      assignedToId: data.assignedToId || 'seed-admin-user',
    },
  })
  return res.json()
}
