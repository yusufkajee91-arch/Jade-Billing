import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { matchFeeEarner } from '@/lib/import-utils'
import { apiLogger } from '@/lib/debug'
import * as XLSX from 'xlsx'

const log = apiLogger('import/clients')

// Entity-type mapping from LawPractice ZA → our enum
function mapEntityType(raw: string | null | undefined): string {
  if (!raw) return 'individual_sa'
  const lower = raw.trim().toLowerCase()
  if (lower.includes('company') && lower.includes('pty')) return 'company_pty'
  if (lower.includes('company') && lower.includes('ltd')) return 'company_ltd'
  if (lower.includes('close') || lower.includes('cc')) return 'close_corporation'
  if (lower.includes('trust')) return 'trust'
  if (lower.includes('partnership')) return 'partnership'
  if (lower.includes('foreign')) return 'foreign_company'
  if (lower.includes('individual') || lower.includes('natural')) return 'individual_sa'
  return 'individual_sa'
}

// FICA status mapping
function mapFicaStatus(raw: string | null | undefined): string {
  if (!raw || raw.trim() === '') return 'not_compliant'
  const lower = raw.trim().toLowerCase()
  if (lower === 'compliant') return 'compliant'
  if (lower === 'partial') return 'partially_compliant'
  return 'not_compliant'
}

// Generate client code from customer_code — truncate to 10 chars if needed
function normaliseClientCode(customerCode: string): string {
  return customerCode.trim().substring(0, 10)
}

// Check if row is a system/internal client
function isSystemClient(loginName: string | null | undefined, customerName: string | null | undefined): boolean {
  if (!loginName || loginName.trim().toLowerCase() !== 'system') return false
  if (!customerName) return false
  const upper = customerName.toUpperCase()
  return upper.includes('LPC') || upper.includes('INTEREST')
}

// Read cell value as trimmed string or null
function str(val: unknown): string | null {
  if (val === null || val === undefined || val === '') return null
  return String(val).trim()
}

export async function POST(request: NextRequest) {
  log.info('POST request received')
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      log.warn('Unauthorized request — no session')
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }
    if (session.user.role !== 'admin') {
      log.warn('Forbidden — user role is not admin', { role: session.user.role })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      log.warn('Invalid request — expected multipart/form-data')
      return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })
    }

    const file = formData.get('file')
    if (!file || typeof file === 'string') {
      log.warn('Missing or invalid file field')
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    // Parse file with xlsx
    const buffer = await (file as File).arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      log.warn('No sheets found in uploaded file')
      return NextResponse.json({ error: 'No sheets found in file' }, { status: 422 })
    }
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]!)
    log.debug('File parsed:', { sheetName, rowCount: rows.length })

    if (rows.length === 0) {
      log.warn('No data rows found in file')
      return NextResponse.json({ error: 'No data rows found' }, { status: 422 })
    }

    // Load existing client codes to skip duplicates
    const existingClients = await prisma.client.findMany({ select: { clientCode: true } })
    const existingCodes = new Set(existingClients.map(c => c.clientCode))
    log.debug('Existing clients loaded:', { count: existingClients.length })

    // Load users for fee-earner matching
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, firstName: true, lastName: true, role: true },
    })

    let imported = 0
    let skipped = 0
    const errors: string[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!
      const rowNum = i + 2 // 1-indexed + header row
      try {
        const customerCode = str(row['customer_code'])
        if (!customerCode) {
          skipped++
          continue
        }

        const customerName = str(row['customer_name'])
        const loginName = str(row['login_name'])

        // Skip system/internal clients
        if (isSystemClient(loginName, customerName)) {
          skipped++
          continue
        }

        const clientCode = normaliseClientCode(customerCode)

        // Skip duplicates
        if (existingCodes.has(clientCode)) {
          skipped++
          continue
        }

        // Fuzzy match fee earner
        const createdById = matchFeeEarner(loginName, users, session.user.id)

        await prisma.client.create({
          data: {
            clientCode,
            clientName: customerName || customerCode,
            entityType: mapEntityType(str(row['entitytype_name'])) as never,
            emailGeneral: str(row['email']),
            emailInvoices: str(row['accountsemail']),
            mobile: str(row['cell']),
            physicalAddressLine1: str(row['streetaddress']),
            ficaStatus: mapFicaStatus(str(row['compliancestatus'])) as never,
            createdById,
          },
        })

        existingCodes.add(clientCode)
        imported++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`Row ${rowNum}: ${msg}`)
      }
    }

    log.info('POST completed successfully', { imported, skipped, errorCount: errors.length })
    return NextResponse.json({ imported, skipped, errors })
  } catch (error) {
    log.error('POST failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 }
    )
  }
}
