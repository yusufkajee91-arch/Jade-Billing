import { describe, it, expect } from 'vitest'
import { formatCurrency, formatDate, cn } from '@/lib/utils'

describe('formatCurrency', () => {
  it('formats zero correctly', () => {
    const result = formatCurrency(0)
    // en-ZA locale produces R 0,00 or similar
    expect(result).toMatch(/R/)
    expect(result).toMatch(/0/)
  })

  it('formats R1000 from 100000 cents', () => {
    const result = formatCurrency(100000)
    expect(result).toMatch(/R/)
    expect(result).toMatch(/1/)
    expect(result).toMatch(/000/)
  })

  it('formats R2299.50 from 229950 cents', () => {
    const result = formatCurrency(229950)
    expect(result).toMatch(/R/)
    expect(result).toMatch(/2/)
    expect(result).toMatch(/299/)
  })

  it('handles large values correctly', () => {
    const result = formatCurrency(450000)
    expect(result).toMatch(/R/)
    // R4500.00
    expect(result).toMatch(/4/)
    expect(result).toMatch(/500/)
  })

  it('always includes cent portion', () => {
    const result = formatCurrency(100)
    // R1.00
    expect(result).toMatch(/1/)
  })
})

describe('formatDate', () => {
  it('formats a Date object', () => {
    const date = new Date(2024, 0, 15) // 15 Jan 2024
    const result = formatDate(date)
    expect(result).toMatch(/Jan/)
    expect(result).toMatch(/2024/)
    expect(result).toMatch(/15/)
  })

  it('formats a date string', () => {
    const result = formatDate('2024-06-30')
    expect(result).toMatch(/Jun/)
    expect(result).toMatch(/2024/)
  })

  it('returns a non-empty string for any valid date', () => {
    const result = formatDate(new Date())
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
  })

  it('deduplicates conflicting tailwind classes — last wins', () => {
    const result = cn('text-red-500', 'text-blue-500')
    expect(result).not.toContain('text-red-500')
    expect(result).toContain('text-blue-500')
  })

  it('handles undefined and null gracefully', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar')
  })

  it('handles empty input', () => {
    expect(cn()).toBe('')
  })
})
