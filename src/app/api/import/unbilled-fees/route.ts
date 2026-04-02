import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { matchFeeEarner } from '@/lib/import-utils'
import { apiLogger } from '@/lib/debug'
import * as XLSX from 'xlsx'

const log = apiLogger('import/unbilled-fees')

function str(val: unknown): string | null {
  if (val === null || val === undefined || val === '') return null
  return String(val).trim()
}

function num(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  const n = Number(val)
  return isNaN(n) ? 0 : n
}

function toCents(val: unknown): number {
  return Math.round(num(val) * 100)
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

// ─── DELETE: clear all historical unbilled fee entries ─────────────────────────

export async function DELETE() {
  log.info('DELETE request received')
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

    const result = await prisma.feeEntry.deleteMany({
      where: {
        isHistorical: true,
        isInvoiced: false,
      },
    })

    log.info('DELETE completed successfully', { deleted: result.count })
    return NextResponse.json({ deleted: result.count })
  } catch (error) {
    log.error('DELETE failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 }
    )
  }
}

// ─── POST: import unbilled fees ───────────────────────────────────────────────

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

    const buffer = await (file as File).arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
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

    // ── Load lookup data ──────────────────────────────────────────────────────
    const matters = await prisma.matter.findMany({
      select: { id: true, matterCode: true },
    })
    const matterMap = new Map(matters.map(m => [m.matterCode, m]))

    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, firstName: true, lastName: true, role: true },
    })
    const fallbackUserId =
      users.find(u => u.role === 'admin')?.id ?? session.user.id

    // Load posting codes for matching
    const postingCodes = await prisma.postingCode.findMany({
      where: { isActive: true },
      select: { id: true, code: true },
    })
    const postingCodeMap = new Map(postingCodes.map(p => [p.code, p.id]))
    log.debug('Lookup data loaded:', { matters: matters.length, users: users.length, postingCodes: postingCodes.length })

    // ── Process rows ──────────────────────────────────────────────────────────
    let imported = 0
    const skippedNoMatter: string[] = []
    const errors: string[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!
      const rowNum = i + 2

      try {
        // Matter code — strip spaces
        let matterCode = str(row['Matter Code'])
        if (!matterCode) {
          skippedNoMatter.push(`(empty) — row ${rowNum}`)
          continue
        }
        matterCode = matterCode.replace(/\s/g, '')

        const matter = matterMap.get(matterCode)
        if (!matter) {
          if (!skippedNoMatter.includes(matterCode)) {
            skippedNoMatter.push(matterCode)
          }
          continue
        }

        // Determine entry type
        const account = str(row['Account']) ?? ''
        const minutes = num(row['Minutes'])
        let entryType: 'time' | 'unitary' | 'disbursement'
        if (account.toUpperCase().includes('DISBURSEMENT')) {
          entryType = 'disbursement'
        } else if (minutes > 0) {
          entryType = 'time'
        } else {
          entryType = 'unitary'
        }

        const entryDate = parseDate(row['Date'])
        const narration = str(row['Narration']) || `Imported row ${rowNum}`
        const amountCents = toCents(row['amount'])
        const qty = num(row['Qty'])
        const unitPriceCents = toCents(row['Unit Price'])

        // Fuzzy match fee earner
        const rawFeeEarner = str(row['Fee Earner'])
        const feeEarnerId = matchFeeEarner(rawFeeEarner, users, fallbackUserId)

        // Match posting code
        const postingCodeStr = str(row['Posting Code'])
        const postingCodeId = postingCodeStr ? (postingCodeMap.get(postingCodeStr) ?? null) : null

        await prisma.feeEntry.create({
          data: {
            matterId: matter.id,
            entryType: entryType as never,
            entryDate,
            narration,
            feeEarnerName: rawFeeEarner,
            durationMinutesRaw: minutes > 0 ? Math.round(minutes) : null,
            durationMinutesBilled: minutes > 0 ? Math.round(minutes) : null,
            unitQuantityThousandths: qty ? Math.round(qty * 1000) : null,
            rateCents: unitPriceCents,
            amountCents,
            totalCents: amountCents,
            isBillable: true,
            isInvoiced: false,
            postingCodeId,
            feeEarnerId,
            createdById: session.user.id,
            isHistorical: true,
          },
        })

        imported++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`Row ${rowNum}: ${msg}`)
      }
    }

    log.info('POST completed successfully', { imported, skippedNoMatter: skippedNoMatter.length, errorCount: errors.length })
    return NextResponse.json({
      imported,
      skipped_no_matter: skippedNoMatter,
      skipped_duplicate: 0,
      errors,
    })
  } catch (error) {
    log.error('POST failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } : undefined },
      { status: 500 }
    )
  }
}
