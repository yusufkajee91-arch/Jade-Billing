import { PrismaClient } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Create a .env.local file.')
}

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding database…')

  // 1. Firm Settings
  const firmSettings = await prisma.firmSettings.upsert({
    where: { id: 'seed-firm-settings' },
    update: {},
    create: {
      id: 'seed-firm-settings',
      firmName: 'Dolata & Co Attorneys',
      tradingName: 'Dolata & Co',
      vatRegistered: false,
      billingBlocksEnabled: true,
      invoicePrefix: 'INV',
      financialYearStartMonth: 3,
    },
  })

  // 2. Primary Office
  await prisma.firmOffice.upsert({
    where: { id: 'seed-main-office' },
    update: {},
    create: {
      id: 'seed-main-office',
      firmSettingsId: firmSettings.id,
      label: 'Main Office',
      isPrimary: true,
      sortOrder: 0,
    },
  })

  // 3. Fee Levels
  const feeLevels = [
    { id: 'seed-fl-junior', name: 'Junior', hourlyRateCents: 150000, sortOrder: 0 },
    { id: 'seed-fl-standard', name: 'Standard', hourlyRateCents: 200000, sortOrder: 1 },
    { id: 'seed-fl-senior', name: 'Senior', hourlyRateCents: 300000, sortOrder: 2 },
    { id: 'seed-fl-partner', name: 'Partner', hourlyRateCents: 450000, sortOrder: 3 },
  ]

  for (const fl of feeLevels) {
    await prisma.feeLevel.upsert({
      where: { id: fl.id },
      update: {},
      create: fl,
    })
  }

  // 4. Posting Codes
  const postingCodes = [
    { id: 'seed-pc-email', code: 'EMAIL', description: 'Email to client', sortOrder: 0 },
    { id: 'seed-pc-consult', code: 'CONSULT', description: 'Consultation', sortOrder: 1 },
    { id: 'seed-pc-draft', code: 'DRAFT', description: 'Drafting', sortOrder: 2 },
    { id: 'seed-pc-research', code: 'RESEARCH', description: 'Legal research', sortOrder: 3 },
    { id: 'seed-pc-attend', code: 'ATTEND', description: 'Court attendance', sortOrder: 4 },
    { id: 'seed-pc-phone', code: 'PHONE', description: 'Telephone call', sortOrder: 5 },
    { id: 'seed-pc-review', code: 'REVIEW', description: 'Review and advice', sortOrder: 6 },
    { id: 'seed-pc-disburse', code: 'DISBURSE', description: 'Disbursement', sortOrder: 7 },
  ]

  for (const pc of postingCodes) {
    await prisma.postingCode.upsert({
      where: { id: pc.id },
      update: {},
      create: pc,
    })
  }

  // 5. Matter Types
  const matterTypes = [
    { id: 'seed-mt-general', name: 'General', sortOrder: 0 },
    { id: 'seed-mt-litigation', name: 'Litigation', sortOrder: 1 },
    { id: 'seed-mt-conveyancing', name: 'Conveyancing', sortOrder: 2 },
    { id: 'seed-mt-trademarks', name: 'Trade Marks', sortOrder: 3 },
    { id: 'seed-mt-commercial', name: 'Commercial', sortOrder: 4 },
    { id: 'seed-mt-family', name: 'Family Law', sortOrder: 5 },
  ]

  for (const mt of matterTypes) {
    await prisma.matterType.upsert({
      where: { id: mt.id },
      update: {},
      create: mt,
    })
  }

  // 6. Departments
  const departments = [
    { id: 'seed-dept-default', name: 'Default', sortOrder: 0 },
    { id: 'seed-dept-litigation', name: 'Litigation', sortOrder: 1 },
    { id: 'seed-dept-conveyancing', name: 'Conveyancing', sortOrder: 2 },
    { id: 'seed-dept-commercial', name: 'Commercial', sortOrder: 3 },
  ]

  for (const dept of departments) {
    await prisma.department.upsert({
      where: { id: dept.id },
      update: {},
      create: dept,
    })
  }

  // 7. Admin user
  const passwordHash = await bcrypt.hash('Admin1234!', 12)
  await prisma.user.upsert({
    where: { email: 'admin@dcco.law' },
    update: {},
    create: {
      id: 'seed-admin-user',
      email: 'admin@dcco.law',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      initials: 'AU',
      role: 'admin',
      isActive: true,
    },
  })

  console.log('Database seeded successfully.')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
