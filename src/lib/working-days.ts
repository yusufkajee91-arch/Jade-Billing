/**
 * South African working-day utilities for target calculations.
 *
 * Working days = weekdays (Mon–Fri) minus SA public holidays.
 * When a public holiday falls on a Sunday, the following Monday is observed.
 */

// ── Easter calculation (Anonymous Gregorian algorithm) ────────────────────────

function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1 // 0-indexed
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(year, month, day))
}

// ── SA public holidays for a given year ──────────────────────────────────────

function getSAPublicHolidays(year: number): Set<string> {
  const holidays: Date[] = []

  // Fixed-date holidays
  const fixed = [
    [0, 1],   // New Year's Day — Jan 1
    [2, 21],  // Human Rights Day — Mar 21
    [3, 27],  // Freedom Day — Apr 27
    [4, 1],   // Workers' Day — May 1
    [5, 16],  // Youth Day — Jun 16
    [7, 9],   // National Women's Day — Aug 9
    [8, 24],  // Heritage Day — Sep 24
    [11, 16], // Day of Reconciliation — Dec 16
    [11, 25], // Christmas Day — Dec 25
    [11, 26], // Day of Goodwill — Dec 26
  ]

  for (const [month, day] of fixed) {
    holidays.push(new Date(Date.UTC(year, month, day)))
  }

  // Easter-based moveable holidays
  const easter = easterSunday(year)
  const easterMs = easter.getTime()
  const DAY_MS = 86_400_000
  holidays.push(new Date(easterMs - 2 * DAY_MS)) // Good Friday
  holidays.push(new Date(easterMs + 1 * DAY_MS)) // Family Day (Easter Monday)

  // When a public holiday falls on a Sunday, the following Monday is observed
  const result = new Set<string>()
  for (const h of holidays) {
    result.add(h.toISOString().split('T')[0])
    if (h.getUTCDay() === 0) {
      // Sunday → Monday substitute
      const monday = new Date(h.getTime() + DAY_MS)
      result.add(monday.toISOString().split('T')[0])
    }
  }

  return result
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the total number of working days in the given month.
 * @param year  Full year (e.g. 2026)
 * @param month 0-indexed month (0 = January)
 */
export function getWorkingDaysInMonth(year: number, month: number): number {
  const holidays = getSAPublicHolidays(year)
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  let count = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(Date.UTC(year, month, d))
    const dow = date.getUTCDay()
    if (dow === 0 || dow === 6) continue // weekend
    const dateStr = date.toISOString().split('T')[0]
    if (holidays.has(dateStr)) continue // public holiday
    count++
  }
  return count
}

/**
 * Returns the cumulative count of working days from day 1 through day `upToDay`.
 * @param year     Full year
 * @param month    0-indexed month
 * @param upToDay  Calendar day (1-based, inclusive)
 */
export function cumulativeWorkingDays(
  year: number,
  month: number,
  upToDay: number,
): number {
  const holidays = getSAPublicHolidays(year)
  let count = 0
  for (let d = 1; d <= upToDay; d++) {
    const date = new Date(Date.UTC(year, month, d))
    const dow = date.getUTCDay()
    if (dow === 0 || dow === 6) continue
    const dateStr = date.toISOString().split('T')[0]
    if (holidays.has(dateStr)) continue
    count++
  }
  return count
}
