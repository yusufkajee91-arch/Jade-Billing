'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CalendarDiaryItem {
  id: string
  title: string
  isCompleted: boolean
  dueDate: string
  matter: { id: string; matterCode: string }
}

function useToggle(initial: CalendarDiaryItem[]) {
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

export function CalendarWidget({
  todayStr,
  items: initial,
}: {
  todayStr: string
  items: CalendarDiaryItem[]
}) {
  const todayDate = new Date(todayStr + 'T12:00:00Z')
  const todayYear = todayDate.getUTCFullYear()
  const todayMonth = todayDate.getUTCMonth()
  const todayDay = todayDate.getUTCDate()

  const [displayYear, setDisplayYear] = useState(todayYear)
  const [displayMonth, setDisplayMonth] = useState(todayMonth)
  const [selectedDay, setSelectedDay] = useState<number>(todayDay)

  const { items, toggle } = useToggle(initial)

  function prevMonth() {
    if (displayMonth === 0) { setDisplayYear((y) => y - 1); setDisplayMonth(11) }
    else setDisplayMonth((m) => m - 1)
    setSelectedDay(0)
  }
  function nextMonth() {
    if (displayMonth === 11) { setDisplayYear((y) => y + 1); setDisplayMonth(0) }
    else setDisplayMonth((m) => m + 1)
    setSelectedDay(0)
  }

  const firstDay = new Date(Date.UTC(displayYear, displayMonth, 1))
  const daysInMonth = new Date(Date.UTC(displayYear, displayMonth + 1, 0)).getUTCDate()
  const prevMonthDays = new Date(Date.UTC(displayYear, displayMonth, 0)).getUTCDate()
  const startDow = (firstDay.getUTCDay() + 6) % 7 // Mon=0

  const monthName = firstDay.toLocaleDateString('en-ZA', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

  // Data only available for current (today's) month
  const isDataMonth = displayYear === todayYear && displayMonth === todayMonth

  const padDay = (d: number) => String(d).padStart(2, '0')
  const padMonth = String(displayMonth + 1).padStart(2, '0')

  // Build date → items map (only relevant when showing data month)
  const dateMap = new Map<string, CalendarDiaryItem[]>()
  if (isDataMonth) {
    for (const item of items) {
      const list = dateMap.get(item.dueDate) ?? []
      list.push(item)
      dateMap.set(item.dueDate, list)
    }
  }

  const selectedDateStr = selectedDay > 0
    ? `${displayYear}-${padMonth}-${padDay(selectedDay)}`
    : null
  const selectedItems = selectedDateStr ? (dateMap.get(selectedDateStr) ?? []) : []

  // Build grid: [prev month trailing] [current month] [next month leading]
  const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7

  return (
    <div className="glass-card" style={{ background: 'rgba(255,252,250,0.55)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.75)' }}>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="flex items-center justify-center w-8 h-8 rounded-full transition-colors hover:bg-[rgba(176,139,130,0.12)]"
          style={{ color: '#B08B82' }}
          aria-label="Previous month"
        >
          <ChevronLeft style={{ width: 18, height: 18 }} />
        </button>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: '#2C2C2A', fontWeight: 400 }}>
          {monthName}
        </h2>
        <button
          onClick={nextMonth}
          className="flex items-center justify-center w-8 h-8 rounded-full transition-colors hover:bg-[rgba(176,139,130,0.12)]"
          style={{ color: '#B08B82' }}
          aria-label="Next month"
        >
          <ChevronRight style={{ width: 18, height: 18 }} />
        </button>
      </div>

      {/* Day of week headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 8 }}>
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
          <div
            key={d}
            style={{
              fontFamily: 'var(--font-noto-sans)',
              fontSize: 9,
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
              color: '#80796F',
              paddingBottom: 8,
              textAlign: 'center',
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {Array.from({ length: totalCells }, (_, i) => {
          const cellDay = i - startDow + 1
          const isCurrentMonth = cellDay >= 1 && cellDay <= daysInMonth
          const isPrevMonth = cellDay < 1
          const displayDay = isCurrentMonth
            ? cellDay
            : isPrevMonth
            ? prevMonthDays + cellDay
            : cellDay - daysInMonth

          if (!isCurrentMonth) {
            return (
              <div key={i} style={{ height: 38, opacity: 0.20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 14, color: '#2C2C2A' }}>
                  {displayDay}
                </span>
              </div>
            )
          }

          const dateStr = `${displayYear}-${padMonth}-${padDay(cellDay)}`
          const hasEntries = dateMap.has(dateStr)
          const isToday = isDataMonth && cellDay === todayDay
          const isSelected = cellDay === selectedDay

          return (
            <button
              key={i}
              onClick={() => setSelectedDay(cellDay === selectedDay ? 0 : cellDay)}
              className="flex flex-col items-center justify-center relative"
              style={{ height: 38, width: '100%' }}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  fontFamily: 'var(--font-noto-sans)',
                  fontSize: 14,
                  fontWeight: isToday || isSelected ? 500 : 400,
                  color: isToday ? '#ffffff' : isSelected ? '#B08B82' : '#2C2C2A',
                  background: isToday
                    ? '#B08B82'
                    : isSelected
                    ? 'rgba(176, 139, 130, 0.12)'
                    : 'transparent',
                  border: isSelected && !isToday ? '1.5px solid #B08B82' : 'none',
                  transition: 'background 0.15s ease',
                }}
                className={cn(!isToday && !isSelected && 'hover:bg-[rgba(176,139,130,0.08)]')}
              >
                {cellDay}
              </span>
              {hasEntries && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: 2,
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#8897C0',
                    opacity: isToday ? 0.7 : 1,
                  }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Selected day entries */}
      {selectedDay > 0 && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #D8D3CB' }}>
          {selectedItems.length === 0 ? (
            <div className="flex flex-col gap-2">
              <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#80796F', fontStyle: 'italic' }}>
                No entries for this day.
              </p>
              <Link
                href="/diary"
                style={{
                  fontFamily: 'var(--font-noto-sans)',
                  fontSize: 12,
                  color: '#B08B82',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                ＋ Add entry
              </Link>
            </div>
          ) : (
            <div>
              <div className="space-y-2">
                {selectedItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    {/* Matter code pill */}
                    <span
                      style={{
                        fontFamily: 'var(--font-noto-sans)',
                        fontSize: 10,
                        color: '#505E8A',
                        background: 'rgba(136, 151, 192, 0.15)',
                        borderRadius: 6,
                        padding: '2px 8px',
                        flexShrink: 0,
                      }}
                    >
                      {item.matter.matterCode}
                    </span>
                    <p
                      style={{
                        fontFamily: 'var(--font-noto-sans)',
                        fontSize: 13,
                        color: '#2C2C2A',
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        textDecoration: item.isCompleted ? 'line-through' : 'none',
                        opacity: item.isCompleted ? 0.5 : 1,
                      }}
                    >
                      {item.title}
                    </p>
                    {/* Complete checkbox */}
                    <button
                      onClick={() => toggle(item.id)}
                      className="flex-shrink-0 flex items-center justify-center"
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        border: item.isCompleted ? 'none' : '1.5px solid #D8D3CB',
                        background: item.isCompleted ? '#6B7D6A' : 'transparent',
                        transition: 'all 0.15s',
                        cursor: 'pointer',
                      }}
                      title={item.isCompleted ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {item.isCompleted && <Check style={{ width: 11, height: 11, color: 'white' }} strokeWidth={3} />}
                    </button>
                  </div>
                ))}
              </div>
              <Link
                href="/diary"
                style={{
                  fontFamily: 'var(--font-noto-sans)',
                  fontSize: 12,
                  color: '#B08B82',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  marginTop: 12,
                }}
              >
                ＋ Add entry
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
