import { describe, it, expect } from 'vitest'
import { parseTimeToMinutes, formatMinutes } from '../time-parser'

describe('parseTimeToMinutes', () => {
  it('parses plain integer minutes', () => {
    expect(parseTimeToMinutes('90')).toBe(90)
    expect(parseTimeToMinutes('0')).toBe(0)
    expect(parseTimeToMinutes('6')).toBe(6)
  })

  it('parses h+min format (1h30)', () => {
    expect(parseTimeToMinutes('1h30')).toBe(90)
    expect(parseTimeToMinutes('1h30m')).toBe(90)
    expect(parseTimeToMinutes('2h0')).toBe(120)
    expect(parseTimeToMinutes('0h30')).toBe(30)
  })

  it('parses decimal hours (1.5h)', () => {
    expect(parseTimeToMinutes('1.5h')).toBe(90)
    expect(parseTimeToMinutes('1.5hr')).toBe(90)
    expect(parseTimeToMinutes('2h')).toBe(120)
    expect(parseTimeToMinutes('0.1h')).toBe(6)
  })

  it('parses colon-separated (1:30)', () => {
    expect(parseTimeToMinutes('1:30')).toBe(90)
    expect(parseTimeToMinutes('0:06')).toBe(6)
    expect(parseTimeToMinutes('2:00')).toBe(120)
    expect(parseTimeToMinutes('0:0')).toBe(0)
  })

  it('returns null for empty string', () => {
    expect(parseTimeToMinutes('')).toBeNull()
    expect(parseTimeToMinutes('  ')).toBeNull()
  })

  it('returns null for invalid input', () => {
    expect(parseTimeToMinutes('abc')).toBeNull()
    expect(parseTimeToMinutes('1.5x')).toBeNull()
  })

  it('trims whitespace', () => {
    expect(parseTimeToMinutes('  90  ')).toBe(90)
    expect(parseTimeToMinutes('  1:30  ')).toBe(90)
  })
})

describe('formatMinutes', () => {
  it('formats zero correctly', () => {
    expect(formatMinutes(0)).toBe('0 min')
  })

  it('formats minutes only', () => {
    expect(formatMinutes(30)).toBe('30 min')
    expect(formatMinutes(6)).toBe('6 min')
  })

  it('formats hours only', () => {
    expect(formatMinutes(60)).toBe('1h')
    expect(formatMinutes(120)).toBe('2h')
  })

  it('formats hours and minutes', () => {
    expect(formatMinutes(90)).toBe('1h 30 min')
    expect(formatMinutes(66)).toBe('1h 6 min')
  })
})
