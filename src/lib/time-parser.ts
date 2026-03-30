/**
 * Parse a time duration string to minutes.
 *
 * Accepted formats:
 *   "90"       → 90 min  (plain integer minutes)
 *   "1h30"     → 90 min
 *   "1h30m"    → 90 min
 *   "1.5hr"    → 90 min
 *   "1.5h"     → 90 min
 *   "1:30"     → 90 min
 *   "0:06"     → 6 min
 *
 * Returns null if the string cannot be parsed.
 * Returns 0 for valid zero-time inputs (e.g. "0", "0:00").
 */
export function parseTimeToMinutes(input: string): number | null {
  const s = input.trim()
  if (!s) return null

  // Plain integer or decimal hours — must have "h" or "hr" suffix
  // e.g. "1.5h", "1.5hr", "2h", "2hr"
  const decimalHours = s.match(/^(\d+(?:\.\d+)?)\s*hr?$/i)
  if (decimalHours) {
    const hours = parseFloat(decimalHours[1])
    return Math.round(hours * 60)
  }

  // "1h30" or "1h30m" — hours and optional minutes
  const hoursMinutes = s.match(/^(\d+)\s*h\s*(\d+)\s*m?$/i)
  if (hoursMinutes) {
    return parseInt(hoursMinutes[1]) * 60 + parseInt(hoursMinutes[2])
  }

  // "1:30" — colon-separated hours:minutes
  const colonFormat = s.match(/^(\d+):(\d{1,2})$/)
  if (colonFormat) {
    return parseInt(colonFormat[1]) * 60 + parseInt(colonFormat[2])
  }

  // Plain integer — treated as minutes
  const plainMinutes = s.match(/^(\d+)$/)
  if (plainMinutes) {
    return parseInt(plainMinutes[1])
  }

  return null
}

/**
 * Format minutes as a human-readable string, e.g. 90 → "1h 30min"
 */
export function formatMinutes(minutes: number): string {
  if (minutes === 0) return '0 min'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h}h`
  return `${h}h ${m} min`
}
