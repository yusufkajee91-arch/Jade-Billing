import { PrismaClient } from '../src/generated/prisma/index.js'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const fee = await prisma.feeEntry.aggregate({ _min: { entryDate: true }, _max: { entryDate: true }, _count: true })
const inv = await prisma.invoice.aggregate({ _min: { invoiceDate: true }, _max: { invoiceDate: true }, _count: true })
const trust = await prisma.trustEntry.aggregate({ _min: { entryDate: true }, _max: { entryDate: true }, _count: true })
const biz = await prisma.businessEntry.aggregate({ _min: { entryDate: true }, _max: { entryDate: true }, _count: true })
const matter = await prisma.matter.aggregate({ _min: { dateOpened: true }, _max: { dateOpened: true }, _count: true })

console.log('FeeEntry     :', fee._count, 'rows, earliest', fee._min.entryDate, 'latest', fee._max.entryDate)
console.log('Invoice      :', inv._count, 'rows, earliest', inv._min.invoiceDate, 'latest', inv._max.invoiceDate)
console.log('TrustEntry   :', trust._count, 'rows, earliest', trust._min.entryDate, 'latest', trust._max.entryDate)
console.log('BusinessEntry:', biz._count, 'rows, earliest', biz._min.entryDate, 'latest', biz._max.entryDate)
console.log('Matter       :', matter._count, 'rows, earliest dateOpened', matter._min.dateOpened, 'latest', matter._max.dateOpened)

await prisma.$disconnect()
