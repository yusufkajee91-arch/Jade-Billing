import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { matchFeeEarner } from '@/lib/import-utils'
import * as XLSX from 'xlsx'

function str(val: unknown): string | null {
  if (val === null || val === undefined || val === '') return null
  return String(val).trim()
}

function parseDate(val: unknown): Date {
  if (!val) return new Date()
  let d: Date
  if (val instanceof Date) {
    d = val
  } else if (typeof val === 'number') {
    // Excel serial date → UTC midnight
    const MS_PER_DAY = 86400000
    const EXCEL_EPOCH = Date.UTC(1899, 11, 30)
    return new Date(EXCEL_EPOCH + val * MS_PER_DAY)
  } else {
    d = new Date(String(val))
    if (isNaN(d.getTime())) return new Date()
  }
  // Normalize to UTC midnight to avoid timezone date shifts
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })
    }

    const file = formData.get('file')
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    const buffer = await (file as File).arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      return NextResponse.json({ error: 'No sheets found in file' }, { status: 422 })
    }
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]!)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No data rows found' }, { status: 422 })
    }

    // Load existing matter codes to skip duplicates
    const existingMatters = await prisma.matter.findMany({ select: { matterCode: true } })
    const existingCodes = new Set(existingMatters.map(m => m.matterCode))

    // Load all clients for matching
    const clients = await prisma.client.findMany({
      select: { id: true, clientCode: true, clientName: true },
    })

    // Load users for fee-earner matching
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, firstName: true, lastName: true, initials: true, role: true },
    })

    // Load matter types and departments for matching
    const matterTypes = await prisma.matterType.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    })
    const departments = await prisma.department.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    })

    let imported = 0
    let skipped = 0
    const unmatchedClients: string[] = []
    const errors: string[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!
      const rowNum = i + 2

      try {
        // Use matter_code_normal as canonical, fall back to matter_code
        const matterCode = str(row['matter_code_normal']) || str(row['matter_code'])
        if (!matterCode) {
          skipped++
          continue
        }

        if (existingCodes.has(matterCode)) {
          skipped++
          continue
        }

        const customerName = str(row['customer_name'])

        // Match client by name
        let clientId: string | null = null
        if (customerName) {
          const match = clients.find(
            c => c.clientName.toLowerCase() === customerName.toLowerCase(),
          )
          if (match) clientId = match.id
        }

        // If no client match, create minimal client record
        if (!clientId) {
          const clientCode = `IMP-${Date.now().toString(36).slice(-6).toUpperCase()}-${i}`
          const newClient = await prisma.client.create({
            data: {
              clientCode: clientCode.substring(0, 10),
              clientName: customerName || `Unknown Client (row ${rowNum})`,
              entityType: 'individual_sa' as never,
              ficaStatus: 'not_compliant' as never,
              createdById: session.user.id,
            },
          })
          clientId = newClient.id
          // Add to lookup so subsequent rows can match
          clients.push({ id: newClient.id, clientCode: newClient.clientCode, clientName: newClient.clientName })
          unmatchedClients.push(customerName || `Row ${rowNum}`)
        }

        // Fuzzy match fee earner
        const ownerId = matchFeeEarner(str(row['owner_salesagent_name']), users, session.user.id)

        // Match matter type
        let matterTypeId: string | null = null
        const matterTypeName = str(row['mattertype_name'])
        if (matterTypeName) {
          const mt = matterTypes.find(
            t => t.name.toLowerCase() === matterTypeName.toLowerCase(),
          )
          if (mt) matterTypeId = mt.id
        }

        // Match department
        let departmentId: string | null = null
        const departmentName = str(row['department_name'])
        if (departmentName) {
          const dept = departments.find(
            d => d.name.toLowerCase() === departmentName.toLowerCase(),
          )
          if (dept) departmentId = dept.id
        }

        const dateOpened = parseDate(row['dateopened'])

        await prisma.matter.create({
          data: {
            matterCode,
            clientId,
            description: str(row['matter_name']) || matterCode,
            matterTypeId,
            departmentId,
            ownerId,
            status: 'open' as never,
            dateOpened,
            createdById: session.user.id,
          },
        })

        // Generate matter_code_sequences entry to avoid future code conflicts.
        // Extract fee earner initials and client code from the matter code if possible.
        // LawPractice ZA format varies, so we try to parse "INITIALS/CLIENTCODE-SEQ"
        const slashIdx = matterCode.indexOf('/')
        if (slashIdx > 0) {
          const initials = matterCode.substring(0, slashIdx)
          const rest = matterCode.substring(slashIdx + 1)
          const dashIdx = rest.lastIndexOf('-')
          if (dashIdx > 0) {
            const cCode = rest.substring(0, dashIdx)
            const seqStr = rest.substring(dashIdx + 1)
            const seq = parseInt(seqStr, 10)
            if (!isNaN(seq)) {
              // Upsert: keep the highest sequence number
              await prisma.$executeRawUnsafe(
                `INSERT INTO matter_code_sequences (fee_earner_initials, client_code, last_sequence)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (fee_earner_initials, client_code)
                 DO UPDATE SET last_sequence = GREATEST(matter_code_sequences.last_sequence, $3)`,
                initials,
                cCode,
                seq,
              )
            }
          }
        }

        existingCodes.add(matterCode)
        imported++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`Row ${rowNum}: ${msg}`)
      }
    }

    return NextResponse.json({ imported, skipped, unmatched_clients: unmatchedClients, errors })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[import/matters] unhandled error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
