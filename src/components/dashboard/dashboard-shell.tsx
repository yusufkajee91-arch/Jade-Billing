'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Settings2 } from 'lucide-react'
import Link from 'next/link'
import { FeeChartWidget } from '@/components/dashboard/widgets/fee-chart-widget'
import { UnbilledWorkWidget } from '@/components/dashboard/widgets/unbilled-work-widget'
import { UnsentInvoicesWidget } from '@/components/dashboard/widgets/unsent-invoices-widget'
import { FirmKpisWidget } from '@/components/dashboard/widgets/firm-kpis-widget'
import { AllEarnersChartWidget } from '@/components/dashboard/widgets/all-earners-chart-widget'
import { CalendarWidget } from '@/components/dashboard/widgets/calendar-widget'
import { TodayTasksWidget, ThisWeekWidget } from '@/components/dashboard/widgets/tasks-widget'
import { CustomisePanel } from '@/components/dashboard/customise-panel'
import type { WipRow } from '@/components/dashboard/widgets/unbilled-work-widget'
import type { UnsentInvoice } from '@/components/dashboard/widgets/unsent-invoices-widget'
import type { AdminKpis } from '@/components/dashboard/widgets/firm-kpis-widget'
import type { DiaryItem } from '@/components/dashboard/widgets/tasks-widget'
import type { CalendarDiaryItem } from '@/components/dashboard/widgets/calendar-widget'
import { componentLogger } from '@/lib/debug'

const log = componentLogger('DashboardShell')

// ─── Types ────────────────────────────────────────────────────────────────────

export type WidgetId =
  | 'feeChart'
  | 'unbilledWork'
  | 'unsentInvoices'
  | 'firmKpis'
  | 'allEarnersChart'
  | 'calendar'
  | 'todayTasks'
  | 'thisWeek'

export interface WidgetDef {
  label: string
  zone: 'left' | 'right'
  adminOnly: boolean
}

export const WIDGET_DEFS: Record<WidgetId, WidgetDef> = {
  feeChart: { label: 'Fee Chart', zone: 'left', adminOnly: false },
  unbilledWork: { label: 'Unbilled Work', zone: 'left', adminOnly: false },
  unsentInvoices: { label: 'Awaiting Sending', zone: 'left', adminOnly: false },
  firmKpis: { label: 'Firm KPIs', zone: 'left', adminOnly: true },
  allEarnersChart: { label: 'All Earners Chart', zone: 'left', adminOnly: true },
  calendar: { label: 'Calendar', zone: 'right', adminOnly: false },
  todayTasks: { label: "Today's Tasks", zone: 'right', adminOnly: false },
  thisWeek: { label: 'This Week', zone: 'right', adminOnly: false },
}

export const DEFAULT_LEFT: WidgetId[] = [
  'feeChart',
  'unbilledWork',
  'unsentInvoices',
  'firmKpis',
  'allEarnersChart',
]
export const DEFAULT_RIGHT: WidgetId[] = ['calendar', 'todayTasks', 'thisWeek']

export interface WidgetPrefs {
  leftOrder: WidgetId[]
  rightOrder: WidgetId[]
  hidden: WidgetId[]
}

export interface DashboardData {
  userId: string
  isAdmin: boolean
  firstName: string
  todayDisplayDate: string
  todayStr: string
  wip: WipRow[]
  wipTotal: number
  todayDiaryItems: DiaryItem[]
  weekDiaryItems: DiaryItem[]
  calendarItems: CalendarDiaryItem[]
  unsentInvoices: UnsentInvoice[]
  adminKpis: AdminKpis | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mergeOrder(saved: WidgetId[], defaults: WidgetId[]): WidgetId[] {
  const valid = saved.filter((id) => defaults.includes(id))
  const missing = defaults.filter((id) => !valid.includes(id))
  return [...valid, ...missing]
}

function loadPrefs(key: string): WidgetPrefs {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return { leftOrder: DEFAULT_LEFT, rightOrder: DEFAULT_RIGHT, hidden: [] }
    const parsed = JSON.parse(raw) as Partial<WidgetPrefs>
    return {
      leftOrder: mergeOrder(parsed.leftOrder ?? [], DEFAULT_LEFT),
      rightOrder: mergeOrder(parsed.rightOrder ?? [], DEFAULT_RIGHT),
      hidden: (parsed.hidden ?? []).filter((id): id is WidgetId => id in WIDGET_DEFS),
    }
  } catch {
    return { leftOrder: DEFAULT_LEFT, rightOrder: DEFAULT_RIGHT, hidden: [] }
  }
}

// ─── Greeting phrase (time-aware) ─────────────────────────────────────────────

function useGreetingPhrase() {
  const [phrase, setPhrase] = useState('Good morning')
  useEffect(() => {
    const h = new Date().getHours()
    setPhrase(h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening')
  }, [])
  return phrase
}

// ─── Sortable widget wrapper ──────────────────────────────────────────────────

function SortableWidget({
  id,
  children,
  fadeDelay,
}: {
  id: WidgetId
  children: React.ReactNode
  fadeDelay: number
}) {
  const [hovered, setHovered] = useState(false)
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  return (
    <div
      className="dash-fade-up"
      style={{ animationDelay: `${fadeDelay}ms` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        ref={setNodeRef}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
          opacity: isDragging ? 0.4 : 1,
          position: 'relative',
        }}
      >
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 10,
            opacity: hovered ? 1 : 0,
            transition: 'opacity 0.15s ease',
            cursor: 'grab',
            padding: 4,
            borderRadius: 8,
            color: '#80796F',
            background: 'rgba(255,252,250,0.8)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Drag to reorder"
        >
          <GripVertical style={{ width: 16, height: 16 }} />
        </button>
        {children}
      </div>
    </div>
  )
}

// ─── Dark header bar ──────────────────────────────────────────────────────────

function formatAmount(cents: number) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function DarkHeaderBar({
  firstName,
  todayDisplayDate,
  pendingTasks,
  wipTotal,
  onCustomise,
}: {
  firstName: string
  todayDisplayDate: string
  pendingTasks: number
  wipTotal: number
  onCustomise: () => void
}) {
  const phrase = useGreetingPhrase()

  const summaryParts: string[] = []
  if (pendingTasks > 0) summaryParts.push(`${pendingTasks} ${pendingTasks === 1 ? 'task' : 'tasks'} due today`)
  if (wipTotal > 0) summaryParts.push(`${formatAmount(wipTotal)} unbilled`)

  return (
    <div
      className="dash-fade-up"
      style={{ animationDelay: '0ms', marginBottom: 24 }}
    >
      <div
        style={{
          background: 'rgba(74, 72, 69, 0.92)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRadius: 16,
          border: '1px solid rgba(255, 255, 255, 0.07)',
          padding: '20px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
        }}
      >
        {/* Left: greeting + date */}
        <div>
          <h1
            suppressHydrationWarning
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 24,
              fontWeight: 400,
              color: '#F1EDEA',
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            {phrase}, <strong style={{ fontWeight: 600 }}>{firstName}</strong>
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-noto-sans)',
              fontSize: 11,
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
              color: 'rgba(241, 237, 234, 0.50)',
              marginTop: 4,
            }}
          >
            {todayDisplayDate}
          </p>
        </div>

        {/* Right: summary + actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          {summaryParts.length > 0 && (
            <p
              style={{
                fontFamily: 'var(--font-noto-sans)',
                fontSize: 13,
                color: 'rgba(241, 237, 234, 0.65)',
              }}
            >
              {summaryParts.join(' · ')}
            </p>
          )}

          <Link
            href="/timesheet"
            style={{
              fontFamily: 'var(--font-noto-sans)',
              fontSize: 12,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#ffffff',
              background: '#B08B82',
              borderRadius: 40,
              padding: '10px 22px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              textDecoration: 'none',
              transition: 'background 0.2s ease',
              whiteSpace: 'nowrap',
            }}
            className="hover:bg-[#93706A]"
          >
            Record Time
          </Link>

          <button
            onClick={onCustomise}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(241,237,234,0.60)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              flexShrink: 0,
            }}
            className="hover:bg-[rgba(255,255,255,0.12)] hover:text-[rgba(241,237,234,0.90)]"
            aria-label="Customise dashboard"
          >
            <Settings2 style={{ width: 16, height: 16 }} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main shell ───────────────────────────────────────────────────────────────

export function DashboardShell({ data }: { data: DashboardData }) {
  log.info('mount', {
    userId: data.userId,
    isAdmin: data.isAdmin,
    wipCount: data.wip.length,
    wipTotal: data.wipTotal,
    todayDiaryItems: data.todayDiaryItems.length,
    unsentInvoices: data.unsentInvoices.length,
    calendarItems: data.calendarItems.length,
  })
  const storageKey = `dashboard-prefs-v1-${data.userId}`

  const [prefs, setPrefs] = useState<WidgetPrefs>({
    leftOrder: DEFAULT_LEFT,
    rightOrder: DEFAULT_RIGHT,
    hidden: [],
  })
  const [prefsLoaded, setPrefsLoaded] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)

  useEffect(() => {
    setPrefs(loadPrefs(storageKey))
    setPrefsLoaded(true)
  }, [storageKey])

  const savePrefs = useCallback(
    (next: WidgetPrefs) => {
      setPrefs(next)
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {}
    },
    [storageKey],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  function handleDragEnd(event: DragEndEvent, zone: 'left' | 'right') {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const order = zone === 'left' ? prefs.leftOrder : prefs.rightOrder
    const oldIdx = order.indexOf(active.id as WidgetId)
    const newIdx = order.indexOf(over.id as WidgetId)
    if (oldIdx === -1 || newIdx === -1) return
    const next = arrayMove(order, oldIdx, newIdx)
    savePrefs(zone === 'left' ? { ...prefs, leftOrder: next } : { ...prefs, rightOrder: next })
  }

  function isVisible(id: WidgetId): boolean {
    if (WIDGET_DEFS[id].adminOnly && !data.isAdmin) return false
    if (prefs.hidden.includes(id)) return false
    return true
  }

  const visibleLeft = prefs.leftOrder.filter(isVisible)
  const visibleRight = prefs.rightOrder.filter(isVisible)

  function renderWidget(id: WidgetId) {
    switch (id) {
      case 'feeChart':
        return <FeeChartWidget isAdmin={data.isAdmin} />
      case 'unbilledWork':
        return <UnbilledWorkWidget wip={data.wip} wipTotal={data.wipTotal} />
      case 'unsentInvoices':
        return <UnsentInvoicesWidget invoices={data.unsentInvoices} />
      case 'firmKpis':
        return data.adminKpis ? <FirmKpisWidget kpis={data.adminKpis} /> : null
      case 'allEarnersChart':
        return <AllEarnersChartWidget />
      case 'calendar':
        return <CalendarWidget todayStr={data.todayStr} items={data.calendarItems} />
      case 'todayTasks':
        return (
          <TodayTasksWidget
            items={data.todayDiaryItems}
            todayDisplayDate={data.todayDisplayDate}
          />
        )
      case 'thisWeek':
        return <ThisWeekWidget items={data.weekDiaryItems} todayStr={data.todayStr} />
      default:
        return null
    }
  }

  const pendingTasks = data.todayDiaryItems.filter((e) => !e.isCompleted).length

  if (!prefsLoaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#80796F' }}>
          Loading…
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Dark header bar — spans full width, above grid */}
      <DarkHeaderBar
        firstName={data.firstName}
        todayDisplayDate={data.todayDisplayDate}
        pendingTasks={pendingTasks}
        wipTotal={data.wipTotal}
        onCustomise={() => setPanelOpen(true)}
      />

      {/* Two-zone grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}>
        {/* Left zone */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(e) => handleDragEnd(e, 'left')}
        >
          <SortableContext items={visibleLeft} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {visibleLeft.map((id, i) => {
                const content = renderWidget(id)
                if (!content) return null
                return (
                  <SortableWidget key={id} id={id} fadeDelay={(i + 1) * 100}>
                    {content}
                  </SortableWidget>
                )
              })}
            </div>
          </SortableContext>
        </DndContext>

        {/* Right zone */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(e) => handleDragEnd(e, 'right')}
        >
          <SortableContext items={visibleRight} strategy={verticalListSortingStrategy}>
            <div style={{ position: 'sticky', top: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {visibleRight.map((id, i) => {
                const content = renderWidget(id)
                if (!content) return null
                return (
                  <SortableWidget
                    key={id}
                    id={id}
                    fadeDelay={(visibleLeft.length + i + 1) * 100}
                  >
                    {content}
                  </SortableWidget>
                )
              })}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <CustomisePanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        prefs={prefs}
        isAdmin={data.isAdmin}
        onSave={savePrefs}
      />
    </>
  )
}
