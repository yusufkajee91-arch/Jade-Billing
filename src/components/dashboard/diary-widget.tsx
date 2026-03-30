'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DiaryItem {
  id: string
  title: string
  isCompleted: boolean
  dueDate: string // YYYY-MM-DD
  matter: { id: string; matterCode: string }
}

interface DiaryWidgetProps {
  todayEntries: DiaryItem[]
  weekEntries: DiaryItem[]
}

export function DiaryWidget({ todayEntries: initialToday, weekEntries: initialWeek }: DiaryWidgetProps) {
  const [today, setToday] = useState(initialToday)
  const [week, setWeek] = useState(initialWeek)

  const toggle = async (id: string, source: 'today' | 'week') => {
    const list = source === 'today' ? today : week
    const entry = list.find((e) => e.id === id)
    if (!entry) return
    const newVal = !entry.isCompleted

    const update = (prev: DiaryItem[]) =>
      prev.map((e) => (e.id === id ? { ...e, isCompleted: newVal } : e))

    if (source === 'today') setToday(update)
    else setWeek(update)

    try {
      await fetch(`/api/diary/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: newVal }),
      })
    } catch {
      // Revert on error
      const revert = (prev: DiaryItem[]) =>
        prev.map((e) => (e.id === id ? { ...e, isCompleted: !newVal } : e))
      if (source === 'today') setToday(revert)
      else setWeek(revert)
    }
  }

  const EntryRow = ({ entry, source }: { entry: DiaryItem; source: 'today' | 'week' }) => (
    <div
      className={cn(
        'flex items-start gap-3 py-2.5 pl-3 border-l-2 transition-colors',
        entry.isCompleted ? 'border-border' : 'border-[hsl(var(--primary))]',
      )}
    >
      <button
        onClick={() => toggle(entry.id, source)}
        className={cn(
          'mt-0.5 flex-shrink-0 w-4 h-4 rounded border transition-colors flex items-center justify-center',
          entry.isCompleted
            ? 'bg-[hsl(142_25%_42%)] border-[hsl(142_25%_42%)]'
            : 'border-border hover:border-primary',
        )}
        title={entry.isCompleted ? 'Mark incomplete' : 'Mark complete'}
      >
        {entry.isCompleted && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
      </button>
      <div className="flex-1 min-w-0">
        <Link
          href={`/matters/${entry.matter.id}`}
          className="font-sans text-[10px] text-muted-foreground hover:text-primary transition-colors"
        >
          {entry.matter.matterCode}
        </Link>
        <p
          className={cn(
            'font-sans text-sm leading-snug',
            entry.isCompleted ? 'line-through text-muted-foreground' : 'text-foreground',
          )}
        >
          {entry.title}
        </p>
      </div>
    </div>
  )

  // Group week entries by date
  const weekByDay = week.reduce<Record<string, DiaryItem[]>>((acc, e) => {
    ;(acc[e.dueDate] ??= []).push(e)
    return acc
  }, {})
  const weekDays = Object.keys(weekByDay).sort()

  return (
    <div className="space-y-8">
      {/* Today's entries */}
      <div>
        {today.length === 0 ? (
          <p className="font-sans text-sm text-muted-foreground italic">You&apos;re all clear today.</p>
        ) : (
          <div className="space-y-1">
            {today.map((e) => (
              <EntryRow key={e.id} entry={e} source="today" />
            ))}
          </div>
        )}
      </div>

      {/* This week's entries */}
      {weekDays.length > 0 && (
        <div>
          <h2 className="font-serif text-xl font-light text-foreground mb-4">This week</h2>
          <div className="space-y-5">
            {weekDays.map((date) => {
              const label = new Date(date + 'T12:00:00Z').toLocaleDateString('en-ZA', {
                weekday: 'long',
                day: 'numeric',
                month: 'short',
                timeZone: 'UTC',
              })
              return (
                <div key={date}>
                  <p className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground mb-2">
                    {label}
                  </p>
                  <div className="space-y-1">
                    {weekByDay[date].map((e) => (
                      <EntryRow key={e.id} entry={e} source="week" />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
