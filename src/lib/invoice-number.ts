import { prisma } from './prisma'

/**
 * Atomically claim the next invoice number.
 * Uses UPDATE...RETURNING to avoid a separate SELECT + UPDATE race.
 * Returns the formatted invoice number string, e.g. "INV-0042".
 */
export async function claimInvoiceNumber(): Promise<{ number: string; seq: number }> {
  const result = await prisma.$queryRaw<Array<{ seq: number; prefix: string }>>`
    UPDATE firm_settings
    SET invoice_next_number = invoice_next_number + 1
    RETURNING invoice_next_number - 1 AS seq, invoice_prefix AS prefix
  `
  if (!result[0]) throw new Error('No firm settings found — cannot generate invoice number')
  const { seq, prefix } = result[0]
  const number = `${prefix}-${String(seq).padStart(4, '0')}`
  return { number, seq }
}
