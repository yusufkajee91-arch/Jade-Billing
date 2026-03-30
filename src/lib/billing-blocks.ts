/**
 * Round raw minutes up to the nearest 6-minute billing block.
 *
 * SA legal billing standard: ceil(minutes / 6) × 6
 *
 * Examples:
 *   0   → 0   (zero stays zero — no phantom entries)
 *   1   → 6
 *   6   → 6   (already on a block boundary)
 *   7   → 12
 *   60  → 60
 *   61  → 66
 */
export function roundToBillingBlock(minutes: number): number {
  if (minutes <= 0) return 0
  return Math.ceil(minutes / 6) * 6
}

/**
 * Calculate the fee amount in cents for a time entry.
 *
 * @param billedMinutes - minutes after any rounding
 * @param hourlyRateCents - rate per hour in cents
 */
export function calcTimeAmount(billedMinutes: number, hourlyRateCents: number): number {
  return Math.round((billedMinutes / 60) * hourlyRateCents)
}

/**
 * Calculate discount amount in cents given the amount and a discount percentage
 * stored as an integer percentage (0–100).
 */
export function calcDiscount(amountCents: number, discountPct: number): number {
  return Math.round((amountCents * discountPct) / 100)
}
