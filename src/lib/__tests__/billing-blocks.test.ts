import { describe, it, expect } from 'vitest'
import { roundToBillingBlock, calcTimeAmount, calcDiscount } from '../billing-blocks'

describe('roundToBillingBlock', () => {
  it('returns 0 for 0 minutes', () => {
    expect(roundToBillingBlock(0)).toBe(0)
  })

  it('rounds 1 minute up to 6', () => {
    expect(roundToBillingBlock(1)).toBe(6)
  })

  it('keeps 6 minutes unchanged', () => {
    expect(roundToBillingBlock(6)).toBe(6)
  })

  it('rounds 7 minutes up to 12', () => {
    expect(roundToBillingBlock(7)).toBe(12)
  })

  it('keeps 60 minutes unchanged', () => {
    expect(roundToBillingBlock(60)).toBe(60)
  })

  it('rounds 61 minutes up to 66', () => {
    expect(roundToBillingBlock(61)).toBe(66)
  })

  it('rounds 5 minutes up to 6', () => {
    expect(roundToBillingBlock(5)).toBe(6)
  })

  it('handles boundary values correctly', () => {
    // Every multiple of 6 stays unchanged
    for (let m = 6; m <= 60; m += 6) {
      expect(roundToBillingBlock(m)).toBe(m)
    }
    // One over a boundary rounds up
    expect(roundToBillingBlock(13)).toBe(18)
    expect(roundToBillingBlock(19)).toBe(24)
  })

  it('returns 0 for negative input', () => {
    expect(roundToBillingBlock(-1)).toBe(0)
  })
})

describe('calcTimeAmount', () => {
  it('calculates 60 minutes at R1500/h as R1500', () => {
    expect(calcTimeAmount(60, 150000)).toBe(150000)
  })

  it('calculates 6 minutes at R1500/h as R150', () => {
    // 6/60 * 150000 = 15000 cents = R150
    expect(calcTimeAmount(6, 150000)).toBe(15000)
  })

  it('calculates 0 minutes as 0', () => {
    expect(calcTimeAmount(0, 150000)).toBe(0)
  })

  it('rounds to nearest cent', () => {
    // 7 min at R100/h: 7/60 * 10000 = 1166.67 → 1167 cents
    expect(calcTimeAmount(7, 10000)).toBe(1167)
  })
})

describe('calcDiscount', () => {
  it('calculates 10% discount correctly', () => {
    expect(calcDiscount(10000, 10)).toBe(1000)
  })

  it('calculates 0% discount as 0', () => {
    expect(calcDiscount(10000, 0)).toBe(0)
  })

  it('calculates 100% discount as full amount', () => {
    expect(calcDiscount(10000, 100)).toBe(10000)
  })

  it('rounds to nearest cent', () => {
    // 10001 cents at 10% = 1000.1 → 1000 cents
    expect(calcDiscount(10001, 10)).toBe(1000)
  })
})
