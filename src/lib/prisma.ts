import { PrismaClient } from '@/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { libLogger } from '@/lib/debug'

const log = libLogger('prisma')

// Increment this when the Prisma schema changes (after running npx prisma generate).
// This busts the globalThis cache so the dev server picks up the new generated client.
const PRISMA_SCHEMA_VERSION = 9 // Phase 9: billing_status enum + practice notes fields on Matter

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    log.error('DATABASE_URL environment variable is not set!')
    throw new Error('DATABASE_URL environment variable is not set')
  }
  log.info('Creating new PrismaClient (schema version:', PRISMA_SCHEMA_VERSION, ')')
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter, log: ['error'] })
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient
  prismaSchemaVersion: number
}

// If the cached instance was created with an older schema version, discard it.
const isFresh =
  globalForPrisma.prisma &&
  globalForPrisma.prismaSchemaVersion === PRISMA_SCHEMA_VERSION

if (isFresh) {
  log.debug('Using cached PrismaClient (schema version:', PRISMA_SCHEMA_VERSION, ')')
} else if (globalForPrisma.prisma) {
  log.info('Schema version changed from', globalForPrisma.prismaSchemaVersion, 'to', PRISMA_SCHEMA_VERSION, '- creating new client')
}

export const prisma = isFresh ? globalForPrisma.prisma : createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
  globalForPrisma.prismaSchemaVersion = PRISMA_SCHEMA_VERSION
}
