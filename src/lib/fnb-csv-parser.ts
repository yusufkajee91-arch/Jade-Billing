/**
 * FNB (First National Bank South Africa) CSV export parser.
 *
 * Actual FNB CSV format:
 *   Row 1:  ACCOUNT TRANSACTION HISTORY
 *   Row 2:  Name:, Jessica-jayde, Dolata
 *   Row 3:  Account:, 63006684658, [Commercial Attorneys Trust Account]
 *   Row 4:  Balance:, 119393.25, 119393.25
 *   Row 5:  Date, Amount, Balance, Description   ← header row
 *   Row 6+: 2024/03/26, 31295.84, 119393.25, R024X83K90 JETZ CONTRACTING PTY LTD
 *
 * Rules:
 *   - No quotes around any field
 *   - Date format YYYY/MM/DD
 *   - Amount is signed (negative = debit, positive = credit)
 *   - Description is everything from the 4th column onwards (may contain commas)
 *   - Account number  → row where first col is "Account:", second col
 *   - Account description → row where first col is "Account:", third col
 *   - Transactions start after the row where first col is "Date"
 *   - Parsing stops at the first blank line after the header
 */

export interface ParsedBankStatement {
  accountNumber: string | null
  accountDescription: string | null
  closingBalanceCents: number
  lines: ParsedLine[]
  statementFrom: Date | null
  statementTo: Date | null
}

export interface ParsedLine {
  lineNumber: number
  transactionDate: Date
  amountCents: number   // positive = credit, negative = debit (in cents)
  balanceCents: number
  description: string
  reference: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Split a line on commas and trim every field.
 * Does NOT handle quoted fields — this format has no quoting.
 */
function splitRow(line: string): string[] {
  return line.split(',').map(s => s.trim())
}

/**
 * Parse a date in YYYY/MM/DD format into a UTC noon Date.
 * Returns null if the string doesn't match.
 */
function parseFnbDate(raw: string): Date | null {
  const match = raw.trim().match(/^(\d{4})\/(\d{2})\/(\d{2})$/)
  if (!match) return null
  const year = parseInt(match[1], 10)
  const month = parseInt(match[2], 10)
  const day = parseInt(match[3], 10)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
}

/**
 * Parse an amount string into integer cents.
 * Handles negative values, spaces and commas as thousands separators.
 */
function parseAmountCents(raw: string): number {
  const cleaned = raw.trim().replace(/\s/g, '').replace(/,/g, '')
  if (!cleaned || cleaned === '-') return 0
  const num = parseFloat(cleaned)
  if (isNaN(num)) return 0
  return Math.round(num * 100)
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function parseFnbCsv(csvContent: string): ParsedBankStatement {
  // Debug logging is intentionally inline here to avoid importing from debug.ts
  // (this file may be used in contexts where the debug module isn't available)
  console.log('[LIB:fnb-csv-parser] Parsing FNB CSV, content length:', csvContent.length)
  const rawLines = csvContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

  let accountNumber: string | null = null
  let accountDescription: string | null = null
  const lines: ParsedLine[] = []
  let inTransactions = false

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim()

    if (!inTransactions) {
      if (!trimmed) continue

      const cols = splitRow(trimmed)
      const firstCol = cols[0].toLowerCase()

      // Extract account details from the "Account:" row
      if (firstCol === 'account:') {
        accountNumber = cols[1] || null
        // Strip surrounding brackets from description if present
        const raw = cols[2] || ''
        accountDescription = raw.replace(/^\[|\]$/g, '').trim() || null
        continue
      }

      // The transaction header row starts with "Date"
      if (firstCol === 'date') {
        inTransactions = true
        continue
      }

      continue
    }

    // Stop at the first blank line after the header
    if (!trimmed) break

    const cols = splitRow(trimmed)
    if (cols.length < 4) continue

    const transactionDate = parseFnbDate(cols[0])
    if (!transactionDate) continue

    const amountCents = parseAmountCents(cols[1])
    const balanceCents = parseAmountCents(cols[2])
    // Description is everything from col 3 onwards (preserves embedded commas)
    const description = cols.slice(3).join(', ').trim()

    lines.push({
      lineNumber: lines.length + 1,
      transactionDate,
      amountCents,
      balanceCents,
      description,
      reference: null,
    })
  }

  // Derive date range from transactions
  let statementFrom: Date | null = null
  let statementTo: Date | null = null
  if (lines.length > 0) {
    const dates = lines.map(l => l.transactionDate.getTime())
    statementFrom = new Date(Math.min(...dates))
    statementTo = new Date(Math.max(...dates))
  }

  const closingBalanceCents = lines.length > 0
    ? lines[lines.length - 1].balanceCents
    : 0

  console.log('[LIB:fnb-csv-parser] Parsed result:', {
    accountNumber,
    accountDescription,
    lineCount: lines.length,
    dateRange: statementFrom && statementTo
      ? `${statementFrom.toISOString().slice(0, 10)} to ${statementTo.toISOString().slice(0, 10)}`
      : 'none',
    closingBalanceCents,
  })

  return {
    accountNumber,
    accountDescription,
    closingBalanceCents,
    lines,
    statementFrom,
    statementTo,
  }
}
