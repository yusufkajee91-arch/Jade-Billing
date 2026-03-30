import { prisma } from '@/lib/prisma'

/**
 * Atomically generate the next matter code for a given fee earner + client
 * combination. Uses an atomic upsert so concurrent requests cannot generate
 * the same sequence number.
 *
 * Format: {INITIALS}/{CLIENT_CODE}-{SEQ padded to 3 digits}
 * Example: JJ/APS-002
 */
export async function generateMatterCode(
  feeEarnerInitials: string,
  clientCode: string,
): Promise<string> {
  // Atomic upsert: insert seq=1 on first call, increment on subsequent calls.
  // The UPDATE SET is atomic in PostgreSQL — no separate transaction needed.
  const result = await prisma.$queryRaw<Array<{ last_sequence: number }>>`
    INSERT INTO matter_code_sequences (fee_earner_initials, client_code, last_sequence)
    VALUES (${feeEarnerInitials}, ${clientCode}, 1)
    ON CONFLICT (fee_earner_initials, client_code) DO UPDATE
      SET last_sequence = matter_code_sequences.last_sequence + 1
    RETURNING last_sequence
  `
  const seq = result[0].last_sequence
  const paddedSeq = String(seq).padStart(3, '0')
  return `${feeEarnerInitials}/${clientCode}-${paddedSeq}`
}
