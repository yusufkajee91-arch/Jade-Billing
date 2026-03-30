import { describe, it, expect } from 'vitest'
import { parseFnbCsv } from '../fnb-csv-parser'

// Matches the exact structure from the actual FNB export
const SAMPLE_CSV = `ACCOUNT TRANSACTION HISTORY
Name:, Jessica-jayde, Dolata
Account:, 63006684658, [Commercial Attorneys Trust Account]
Balance:, 119393.25, 119393.25
Date, Amount, Balance, Description
2024/03/26, 31295.84, 119393.25, R024X83K90 JETZ CONTRACTING PTY LTD
2024/03/25, -5000.00, 88097.41, DEBIT ORDER MONTHLY FEE
2024/03/20, 10000.00, 93097.41, TRUST RECEIPT FROM CLIENT
2024/03/01, -500.50, 83097.41, BANK CHARGES

`

describe('parseFnbCsv', () => {
  it('parses the correct number of transaction lines', () => {
    const result = parseFnbCsv(SAMPLE_CSV)
    expect(result.lines).toHaveLength(4)
  })

  it('extracts account number from row 3', () => {
    const result = parseFnbCsv(SAMPLE_CSV)
    expect(result.accountNumber).toBe('63006684658')
  })

  it('extracts account description from row 3 and strips brackets', () => {
    const result = parseFnbCsv(SAMPLE_CSV)
    expect(result.accountDescription).toBe('Commercial Attorneys Trust Account')
  })

  it('parses dates in YYYY/MM/DD format', () => {
    const result = parseFnbCsv(SAMPLE_CSV)
    expect(result.lines[0].transactionDate).toEqual(new Date(Date.UTC(2024, 2, 26, 12, 0, 0)))
    expect(result.lines[3].transactionDate).toEqual(new Date(Date.UTC(2024, 2, 1, 12, 0, 0)))
  })

  it('parses positive amounts as credits (cents)', () => {
    const result = parseFnbCsv(SAMPLE_CSV)
    expect(result.lines[0].amountCents).toBe(3129584)  // 31295.84
    expect(result.lines[2].amountCents).toBe(1000000)  // 10000.00
  })

  it('parses negative amounts as debits (cents)', () => {
    const result = parseFnbCsv(SAMPLE_CSV)
    expect(result.lines[1].amountCents).toBe(-500000)  // -5000.00
    expect(result.lines[3].amountCents).toBe(-50050)   // -500.50
  })

  it('parses running balance', () => {
    const result = parseFnbCsv(SAMPLE_CSV)
    expect(result.lines[0].balanceCents).toBe(11939325)  // 119393.25
    expect(result.lines[2].balanceCents).toBe(9309741)   // 93097.41
  })

  it('uses last line balance as closingBalanceCents', () => {
    const result = parseFnbCsv(SAMPLE_CSV)
    expect(result.closingBalanceCents).toBe(8309741)  // 83097.41
  })

  it('parses description column', () => {
    const result = parseFnbCsv(SAMPLE_CSV)
    expect(result.lines[0].description).toBe('R024X83K90 JETZ CONTRACTING PTY LTD')
    expect(result.lines[3].description).toBe('BANK CHARGES')
  })

  it('reference is always null (not present in this format)', () => {
    const result = parseFnbCsv(SAMPLE_CSV)
    result.lines.forEach(l => expect(l.reference).toBeNull())
  })

  it('assigns sequential line numbers starting at 1', () => {
    const result = parseFnbCsv(SAMPLE_CSV)
    result.lines.forEach((l, i) => expect(l.lineNumber).toBe(i + 1))
  })

  it('derives statementFrom from earliest transaction date', () => {
    const result = parseFnbCsv(SAMPLE_CSV)
    expect(result.statementFrom).toEqual(new Date(Date.UTC(2024, 2, 1, 12, 0, 0)))
  })

  it('derives statementTo from latest transaction date', () => {
    const result = parseFnbCsv(SAMPLE_CSV)
    expect(result.statementTo).toEqual(new Date(Date.UTC(2024, 2, 26, 12, 0, 0)))
  })

  it('stops at the first blank line after transactions', () => {
    const withTrailing = SAMPLE_CSV + '2024/04/01, 100.00, 83197.41, SHOULD BE IGNORED\n'
    const result = parseFnbCsv(withTrailing)
    expect(result.lines).toHaveLength(4)
  })

  it('handles Windows line endings (CRLF)', () => {
    const crlf = SAMPLE_CSV.replace(/\n/g, '\r\n')
    const result = parseFnbCsv(crlf)
    expect(result.lines).toHaveLength(4)
    expect(result.accountNumber).toBe('63006684658')
  })

  it('handles descriptions containing commas', () => {
    const csv = `ACCOUNT TRANSACTION HISTORY
Name:, Test, User
Account:, 63006684658, [Trust Account]
Balance:, 1000.00, 1000.00
Date, Amount, Balance, Description
2024/03/26, 500.00, 1000.00, REF123 SMITH, JONES AND PARTNERS

`
    const result = parseFnbCsv(csv)
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].description).toBe('REF123 SMITH, JONES AND PARTNERS')
  })

  it('returns empty result when there are no transactions', () => {
    const csv = `ACCOUNT TRANSACTION HISTORY
Name:, Test, User
Account:, 63006684658, [Trust Account]
Balance:, 0.00, 0.00
Date, Amount, Balance, Description

`
    const result = parseFnbCsv(csv)
    expect(result.lines).toHaveLength(0)
    expect(result.accountNumber).toBe('63006684658')
    expect(result.closingBalanceCents).toBe(0)
    expect(result.statementFrom).toBeNull()
    expect(result.statementTo).toBeNull()
  })

  it('skips rows with fewer than 4 columns after the header', () => {
    const csv = `ACCOUNT TRANSACTION HISTORY
Name:, Test, User
Account:, 63006684658, [Trust Account]
Balance:, 200.00, 200.00
Date, Amount, Balance, Description
2024/03/26, 100.00, 100.00
2024/03/27, 100.00, 200.00, VALID ROW

`
    const result = parseFnbCsv(csv)
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].amountCents).toBe(10000)
  })

  it('handles amounts without decimal places', () => {
    const csv = `ACCOUNT TRANSACTION HISTORY
Name:, Test, User
Account:, 63006684658, [Trust Account]
Balance:, 5000, 5000
Date, Amount, Balance, Description
2024/03/26, 5000, 5000, WHOLE NUMBER AMOUNT

`
    const result = parseFnbCsv(csv)
    expect(result.lines[0].amountCents).toBe(500000)
  })
})
