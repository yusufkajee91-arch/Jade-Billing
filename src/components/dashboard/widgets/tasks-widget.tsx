'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, ArrowRight, CheckCircle2 } from 'lucide-react'

export interface DiaryItem {
  id: string
  title: string
  isCompleted: boolean
  dueDate: string
  matter: { id: string; matterCode: string }
}

function useToggle(initial: DiaryItem[]) {
  const [items, setItems] = useState(initial)
  const toggle = async (id: string) => {
    const entry = items.find((e) => e.id === id)
    if (!entry) return
    const newVal = !entry.isCompleted
    setItems((prev) => prev.map((e) => (e.id === id ? { ...e, isCompleted: newVal } : e)))
    try {
      await fetch(`/api/diary/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: newVal }),
      })
    } catch {
      setItems((prev) => prev.map((e) => (e.id === id ? { ...e, isCompleted: !newVal } : e)))
    }
  }
  return { items, toggle }
}

// ─── Pill badge ───────────────────────────────────────────────────────────────

function MatterPill({ code }: { code: string }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-noto-sans)',
        fontSize: 11,
        color: '#505E8A',
        background: 'rgba(136, 151, 192, 0.15)',
        borderRadius: 6,
        padding: '2px 8px',
        flexShrink: 0,
      }}
    >
      {code}
    </span>
  )
}

// ─── Task row ──────────────────────────────────────────────────────────────────

function TaskRow({ entry, onToggle }: { entry: DiaryItem; onToggle: (id: string) => void }) {
  return (
    <div
      className="flex items-center gap-3 py-2"
      style={{ opacity: entry.isCompleted ? 0.45 : 1 }}
    >
      <button
        onClick={() => onToggle(entry.id)}
        className="flex-shrink-0 flex items-center justify-center"
        style={{
          width: 18,
          height: 18,
          borderRadius: 4,
          border: entry.isCompleted ? 'none' : '1.5px solid #D8D3CB',
          background: entry.isCompleted ? '#6B7D6A' : 'transparent',
          transition: 'all 0.15s',
          cursor: 'pointer',
        }}
        title={entry.isCompleted ? 'Mark incomplete' : 'Mark complete'}
      >
        {entry.isCompleted && <Check style={{ width: 11, height: 11, color: 'white' }} strokeWidth={3} />}
      </button>
      <MatterPill code={entry.matter.matterCode} />
      <p
        style={{
          fontFamily: 'var(--font-noto-sans)',
          fontSize: 14,
          color: '#2C2C2A',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textDecoration: entry.isCompleted ? 'line-through' : 'none',
        }}
      >
        {entry.title}
      </p>
    </div>
  )
}

// ─── Today's Tasks ────────────────────────────────────────────────────────────

export function TodayTasksWidget({
  items: initial,
  todayDisplayDate,
}: {
  items: DiaryItem[]
  todayDisplayDate: string
}) {
  const { items, toggle } = useToggle(initial)

  return (
    <div className="glass-card" style={{ background: 'rgba(255,252,250,0.55)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.75)' }}>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: '#2C2C2A', fontWeight: 400, lineHeight: 1.2 }}>
        Today
      </h2>
      <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#80796F', marginTop: 4, marginBottom: 16 }}>
        {todayDisplayDate}
      </p>

      {items.length === 0 ? (
        <div className="flex items-center gap-3 py-2">
          <CheckCircle2 style={{ width: 20, height: 20, color: '#6B7D6A', flexShrink: 0 }} strokeWidth={1.5} />
          <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 14, color: '#80796F', fontStyle: 'italic' }}>
            You&apos;re all clear today.
          </p>
        </div>
      ) : (
        <div>
          {items.map((e, i) => (
            <div key={e.id}>
              {i > 0 && <div style={{ height: 1, background: 'rgba(216,211,203,0.5)' }} />}
              <TaskRow entry={e} onToggle={toggle} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── This Week ────────────────────────────────────────────────────────────────

function getRelativeLabel(dateStr: string, todayStr: string): string {
  const tomorrowDate = new Date(todayStr + 'T12:00:00Z')
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1)
  const tomorrowStr = tomorrowDate.toISOString().slice(0, 10)
  if (dateStr === tomorrowStr) return 'Tomorrow'
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-ZA', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

export function ThisWeekWidget({
  items: initial,
  todayStr,
}: {
  items: DiaryItem[]
  todayStr: string
}) {
  const { items, toggle } = useToggle(initial)

  const byDay = items.reduce<Record<string, DiaryItem[]>>((acc, e) => {
    ;(acc[e.dueDate] ??= []).push(e)
    return acc
  }, {})
  const days = Object.keys(byDay).sort()

  // Cap at 8 total entries across all days
  let entryCount = 0
  const cappedDays = days.filter((date) => {
    if (entryCount >= 8) return false
    entryCount += byDay[date].length
    return true
  })

  return (
    <div className="glass-card" style={{ background: 'rgba(255,252,250,0.55)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.75)' }}>
      <div className="flex items-baseline justify-between mb-5">
        <div>
          <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#80796F', marginBottom: 6 }}>
            This Week
          </p>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: '#2C2C2A', fontWeight: 400, lineHeight: 1.2 }}>
            Coming Up
          </h2>
        </div>
        <Link
          href="/diary"
          className="flex items-center gap-1"
          style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F' }}
        >
          View all <ArrowRight style={{ width: 12, height: 12 }} />
        </Link>
      </div>

      {cappedDays.length === 0 ? (
        <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 14, color: '#80796F', fontStyle: 'italic' }}>
          Nothing due this week.
        </p>
      ) : (
        <div className="space-y-5">
          {cappedDays.map((date) => (
            <div key={date}>
              <p
                style={{
                  fontFamily: 'var(--font-noto-sans)',
                  fontSize: 10,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: '#80796F',
                  marginBottom: 6,
                }}
              >
                {getRelativeLabel(date, todayStr)}
              </p>
              <div>
                {byDay[date].map((e, i) => (
                  <div key={e.id}>
                    {i > 0 && <div style={{ height: 1, background: 'rgba(216,211,203,0.5)' }} />}
                    <TaskRow entry={e} onToggle={toggle} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
