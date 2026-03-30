'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Session } from 'next-auth'
import { formatCurrency } from '@/lib/utils'
import { formatMinutes } from '@/lib/time-parser'
import { useTimeRecording } from './time-recording-provider'
import { Clock, ChevronLeft, ChevronRight } from 'lucide-react'

interface FeeEntry {
  id: string
  matterId: string
  entryType: 'time' | 'unitary' | 'disbursement'
  entryDate: string
  narration: string
  durationMinutesRaw: number | null
  durationMinutesBilled: number | null
  unitQuantityThousandths: number | null
  rateCents: number
  amountCents: number
  discountPct: number
  discountCents: number
  totalCents: number
  isBillable: boolean
  isInvoiced: boolean
  feeEarner: { id: string; firstName: string; lastName: string; initials: string }
  matter: { id: string; matterCode: string; description: string }
}

type Period = 'week' | 'month'

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday start
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function formatPeriodLabel(from: Date, to: Date, period: Period): string {
  if (period === 'week') {
    return `${from.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' })} – ${to.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })}`
  }
  return from.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })
}

function groupByDate(entries: FeeEntry[]): Map<string, FeeEntry[]> {
  const map = new Map<string, FeeEntry[]>()
  for (const e of entries) {
    const d = e.entryDate.slice(0, 10)
    if (!map.has(d)) map.set(d, [])
    map.get(d)!.push(e)
  }
  return map
}

interface TimesheetViewProps {
  session: Session
}

const GLASS = {
  background: 'rgba(255,252,250,0.62)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.80)',
  borderRadius: 20,
  padding: 24,
  boxShadow: '0 8px 32px rgba(74,72,69,0.08), 0 2px 8px rgba(74,72,69,0.04)',
}

export function TimesheetView({ session }: TimesheetViewProps) {
  const { open } = useTimeRecording()
  const [period, setPeriod] = useState<Period>('week')
  const [offset, setOffset] = useState(0) // 0 = current, -1 = previous, etc.
  const [entries, setEntries] = useState<FeeEntry[]>([])
  const [loading, setLoading] = useState(true)

  const { from, to } = useMemo(() => {
    const now = new Date()
    if (period === 'week') {
      const weekStart = startOfWeek(now)
      const shiftedStart = addDays(weekStart, offset * 7)
      const shiftedEnd = addDays(shiftedStart, 6)
      return { from: shiftedStart, to: shiftedEnd }
    } else {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth() + offset, 1)
      const lastOfMonth = new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth() + 1, 0)
      return { from: firstOfMonth, to: lastOfMonth }
    }
  }, [period, offset])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        from: toISO(from),
        to: toISO(to),
      })
      const res = await fetch(`/api/fee-entries?${params}`)
      if (res.ok) setEntries(await res.json())
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => {
    load()
  }, [load])

  const totalMinutes = entries.reduce((s, e) => s + (e.durationMinutesBilled ?? 0), 0)
  const totalFees = entries
    .filter((e) => e.entryType !== 'disbursement')
    .reduce((s, e) => s + e.totalCents, 0)
  const totalDisb = entries
    .filter((e) => e.entryType === 'disbursement')
    .reduce((s, e) => s + e.totalCents, 0)

  const byDate = groupByDate(entries)

  return (
    <div style={{ width: '100%', paddingTop: '16px' }}>
      {/* Dark header bar */}
      <div className="fade-up page-dark-header" style={{ animationDelay: '0ms', background: 'rgba(74,72,69,0.92)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', padding: '20px 28px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(241,237,234,0.50)', marginBottom: 4 }}>
            Practice
          </p>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 400, color: '#F1EDEA', margin: 0, lineHeight: 1.2 }}>
            My Time Sheet
          </h1>
        </div>

        {/* Right side: period toggle + navigation + record button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Week / Month toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'rgba(255,255,255,0.10)', borderRadius: 40, padding: '3px 4px' }}>
            <button
              onClick={() => { setPeriod('week'); setOffset(0) }}
              style={{
                fontFamily: 'var(--font-noto-sans)',
                fontSize: 11,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '6px 16px',
                borderRadius: 40,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
                background: period === 'week' ? 'rgba(255,255,255,0.18)' : 'transparent',
                color: period === 'week' ? '#F1EDEA' : 'rgba(241,237,234,0.55)',
              }}
            >
              Week
            </button>
            <button
              onClick={() => { setPeriod('month'); setOffset(0) }}
              style={{
                fontFamily: 'var(--font-noto-sans)',
                fontSize: 11,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '6px 16px',
                borderRadius: 40,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
                background: period === 'month' ? 'rgba(255,255,255,0.18)' : 'transparent',
                color: period === 'month' ? '#F1EDEA' : 'rgba(241,237,234,0.55)',
              }}
            >
              Month
            </button>
          </div>

          {/* Period navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => setOffset((o) => o - 1)}
              style={{ padding: 6, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.10)', cursor: 'pointer', color: 'rgba(241,237,234,0.70)', display: 'flex', alignItems: 'center' }}
            >
              <ChevronLeft style={{ width: 16, height: 16 }} />
            </button>
            <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: 'rgba(241,237,234,0.85)', minWidth: 180, textAlign: 'center' }}>
              {formatPeriodLabel(from, to, period)}
            </span>
            <button
              onClick={() => setOffset((o) => Math.min(0, o + 1))}
              disabled={offset >= 0}
              style={{ padding: 6, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.10)', cursor: offset >= 0 ? 'default' : 'pointer', color: offset >= 0 ? 'rgba(241,237,234,0.25)' : 'rgba(241,237,234,0.70)', display: 'flex', alignItems: 'center' }}
            >
              <ChevronRight style={{ width: 16, height: 16 }} />
            </button>
            {offset !== 0 && (
              <button
                onClick={() => setOffset(0)}
                style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(241,237,234,0.70)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Today
              </button>
            )}
          </div>

          {/* Record Time button */}
          <button
            onClick={() => open()}
            style={{
              fontFamily: 'var(--font-noto-sans)',
              fontSize: 12,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#ffffff',
              background: '#B08B82',
              borderRadius: 40,
              padding: '10px 22px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#93706A'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#B08B82'}
          >
            <Clock style={{ width: 14, height: 14 }} />
            Record Time
          </button>
        </div>
      </div>

      {/* Summary KPI cards */}
      <div className="fade-up" style={{ animationDelay: '80ms', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div style={GLASS}>
          <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#80796F', marginBottom: 6 }}>
            Time Recorded
          </p>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 400, color: '#2C2C2A', margin: 0 }}>
            {formatMinutes(totalMinutes)}
          </p>
        </div>
        <div style={GLASS}>
          <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#80796F', marginBottom: 6 }}>
            Fees
          </p>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 400, color: '#B08B82', margin: 0 }}>
            {formatCurrency(totalFees)}
          </p>
        </div>
        <div style={GLASS}>
          <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#80796F', marginBottom: 6 }}>
            Disbursements
          </p>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 400, color: '#B08B82', margin: 0 }}>
            {formatCurrency(totalDisb)}
          </p>
        </div>
      </div>

      {/* Daily entries */}
      {loading ? (
        <div className="fade-up" style={{ animationDelay: '160ms', ...GLASS }}>
          <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F', textAlign: 'center', padding: '32px 0' }}>Loading…</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="fade-up" style={{ animationDelay: '160ms', ...GLASS }}>
          <div style={{ textAlign: 'center', padding: '64px 24px' }}>
            <Clock style={{ width: 36, height: 36, color: '#B08B82', margin: '0 auto 16px' }} strokeWidth={1.5} />
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: '#80796F', fontStyle: 'italic', marginBottom: 16 }}>
              No entries for this period.
            </p>
            <button
              onClick={() => open()}
              style={{
                fontFamily: 'var(--font-noto-sans)',
                fontSize: 12,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#ffffff',
                background: '#B08B82',
                borderRadius: 40,
                padding: '10px 22px',
                border: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#93706A'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#B08B82'}
            >
              Record time
            </button>
          </div>
        </div>
      ) : (
        <div className="fade-up" style={{ animationDelay: '160ms', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {Array.from(byDate.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, dayEntries], groupIdx) => {
              const dayMins = dayEntries.reduce(
                (s, e) => s + (e.durationMinutesBilled ?? 0),
                0,
              )
              const dayTotal = dayEntries.reduce((s, e) => s + e.totalCents, 0)
              return (
                <div key={date} style={{ ...GLASS, padding: 0, overflow: 'hidden' }}>
                  {/* Day group header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.60)' }}>
                    <p style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 400, color: '#2C2C2A', margin: 0 }}>
                      {new Date(date + 'T00:00:00').toLocaleDateString('en-ZA', {
                        weekday: 'long',
                        day: '2-digit',
                        month: 'short',
                      })}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                      {dayMins > 0 && (
                        <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F' }}>
                          {formatMinutes(dayMins)}
                        </span>
                      )}
                      <span style={{ fontFamily: 'var(--font-serif)', fontSize: 15, color: '#B08B82' }}>
                        {formatCurrency(dayTotal)}
                      </span>
                    </div>
                  </div>

                  {/* Entry rows */}
                  <table className="brand-table" style={{ width: '100%' }}>
                    <tbody>
                      {dayEntries.map((entry) => (
                        <tr key={entry.id}>
                          <td style={{ width: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                              <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F' }}>
                                {entry.matter.matterCode}
                              </span>
                              <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F' }}>
                                {entry.matter.description}
                              </span>
                            </div>
                            <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 14, color: '#2C2C2A', margin: 0 }}>
                              {entry.narration}
                            </p>
                            {!entry.isBillable && (
                              <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#80796F', marginTop: 2 }}>
                                Non-billable
                              </p>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap', paddingLeft: 24 }}>
                            {entry.durationMinutesBilled !== null && (
                              <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F', margin: '0 0 2px' }}>
                                {formatMinutes(entry.durationMinutesBilled)}
                              </p>
                            )}
                            <p style={{ fontFamily: 'var(--font-serif)', color: '#B08B82', fontSize: 14, margin: 0 }}>
                              {formatCurrency(entry.totalCents)}
                            </p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
