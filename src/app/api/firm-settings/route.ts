import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { apiLogger } from '@/lib/debug'

const log = apiLogger('firm-settings')

const firmSettingsSchema = z.object({
  firmName: z.string().min(1, 'Firm name is required'),
  tradingName: z.string().optional().nullable(),
  logoFilePath: z.string().optional().nullable(),
  vatRegistered: z.boolean().optional(),
  vatRegistrationNumber: z.string().optional().nullable(),
  vatRateBps: z.number().int().optional(),
  trustBankName: z.string().optional().nullable(),
  trustBankAccountName: z.string().optional().nullable(),
  trustBankAccountNumber: z.string().optional().nullable(),
  trustBankBranchCode: z.string().optional().nullable(),
  trustBankSwift: z.string().optional().nullable(),
  businessBankName: z.string().optional().nullable(),
  businessBankAccountName: z.string().optional().nullable(),
  businessBankAccountNumber: z.string().optional().nullable(),
  businessBankBranchCode: z.string().optional().nullable(),
  businessBankSwift: z.string().optional().nullable(),
  invoicePaymentInstructions: z.string().optional().nullable(),
  invoicePrefix: z.string().optional(),
  matterCodeAutoGenerate: z.boolean().optional(),
  billingBlocksEnabled: z.boolean().optional(),
  financialYearStartMonth: z.number().int().min(1).max(12).optional(),
  smtpHost: z.string().optional().nullable(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpUser: z.string().optional().nullable(),
  smtpPassword: z.string().optional().nullable(),
  smtpFromEmail: z.string().optional().nullable(),
  smtpFromName: z.string().optional().nullable(),
  // Primary office fields
  office: z
    .object({
      addressLine1: z.string().optional().nullable(),
      addressLine2: z.string().optional().nullable(),
      city: z.string().optional().nullable(),
      province: z.string().optional().nullable(),
      postalCode: z.string().optional().nullable(),
      tel: z.string().optional().nullable(),
      email: z.string().optional().nullable(),
      website: z.string().optional().nullable(),
    })
    .optional(),
})

export async function GET() {
  log.info('GET request received')
  const session = await getServerSession(authOptions)
  if (!session) {
    log.warn('GET unauthorised — no session')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const settings = await prisma.firmSettings.findFirst({
      include: { offices: { orderBy: { sortOrder: 'asc' } } },
    })

    log.info('GET completed successfully')
    return NextResponse.json(settings)
  } catch (err) {
    log.error('GET failed:', err)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest) {
  log.info('PUT request received')
  const session = await getServerSession(authOptions)
  if (!session) {
    log.warn('PUT unauthorised — no session')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  if (session.user.role !== 'admin') {
    log.warn('PUT forbidden — role:', session.user.role)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  log.debug('PUT body:', { ...body, smtpPassword: body.smtpPassword ? '[REDACTED]' : undefined })
  const parsed = firmSettingsSchema.safeParse(body)
  if (!parsed.success) {
    log.warn('PUT validation failed:', parsed.error.flatten())
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { office, ...settingsData } = parsed.data

  try {
    const existing = await prisma.firmSettings.findFirst()

    let settings
    if (existing) {
      log.debug('PUT updating existing firm settings:', existing.id)
      settings = await prisma.firmSettings.update({
        where: { id: existing.id },
        data: settingsData,
        include: { offices: true },
      })

      // Update primary office
      if (office) {
        const primaryOffice = await prisma.firmOffice.findFirst({
          where: { firmSettingsId: existing.id, isPrimary: true },
        })
        if (primaryOffice) {
          await prisma.firmOffice.update({
            where: { id: primaryOffice.id },
            data: office,
          })
        } else {
          await prisma.firmOffice.create({
            data: {
              firmSettingsId: existing.id,
              label: 'Main Office',
              isPrimary: true,
              ...office,
            },
          })
        }
      }
    } else {
      log.debug('PUT creating new firm settings')
      settings = await prisma.firmSettings.create({
        data: {
          ...settingsData,
          offices: office
            ? {
                create: {
                  label: 'Main Office',
                  isPrimary: true,
                  ...office,
                },
              }
            : undefined,
        },
        include: { offices: true },
      })
    }

    // Refetch with updated offices
    const updated = await prisma.firmSettings.findUnique({
      where: { id: settings.id },
      include: { offices: { orderBy: { sortOrder: 'asc' } } },
    })

    log.info('PUT completed successfully')
    return NextResponse.json(updated)
  } catch (err) {
    log.error('PUT failed:', err)
    return NextResponse.json(
      { error: 'Internal server error', debug: process.env.NODE_ENV !== 'production' ? { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } : undefined },
      { status: 500 },
    )
  }
}
