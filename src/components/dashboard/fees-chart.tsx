'use client'

import { useState, useEffect, useRef } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

// ─── Brand palette ────────────────────────────────────────────────────────────

const C_CURRENT = '#B08B82'   // rose-taupe
const C_PREVIOUS = '#A8A09A'  // warm stone gray
const C_TARGET = '#6B7D6A'    // muted sage
const C_GRID = 'rgba(216, 211, 203, 0.6)'  // D8D3CB
const C_TICK = '#80796F'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DayData {
  day: number
  current: number
  previous: number
  target?: number
}

interface ChartPayload {
  currentMonthName: string
  previousMonthName: string
  today: number
  daysInCurrentMonth: number
  monthlyTargetCents: number | null
  data: DayData[]
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

interface TooltipEntry {
  dataKey: string
  value: number
  color: string
}

function ChartTooltip({
  active,
  payload,
  label,
  currentMonthName,
  previousMonthName,
}: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: number
  currentMonthName: string
  previousMonthName: string
}) {
  if (!active || !payload?.length) return null

  const labels: Record<string, string> = {
    current: currentMonthName,
    previous: previousMonthName,
    target: 'Target',
  }

  return (
    <div
      style={{
        background: 'rgba(255, 252, 250, 0.95)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(216, 211, 203, 0.8)',
        borderRadius: 10,
        padding: '10px 14px',
        boxShadow: '0 4px 16px rgba(74, 72, 69, 0.10)',
        minWidth: 150,
      }}
    >
      <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#80796F', marginBottom: 6 }}>
        Day {label}
      </p>
      {payload.filter((entry) => entry.value > 0).map((entry) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5" style={{ color: '#80796F', fontFamily: 'var(--font-noto-sans)', fontSize: 12 }}>
            <span
              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            {labels[entry.dataKey] ?? entry.dataKey}
          </span>
          <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#2C2C2A', fontWeight: 500 }}>
            {formatCurrency(entry.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Y-axis formatter ─────────────────────────────────────────────────────────

function formatYAxis(cents: number): string {
  if (cents >= 100_000_000) return `R${(cents / 100_000_000).toFixed(0)}m`
  if (cents >= 100_000) return `R${(cents / 100_000).toFixed(0)}k`
  return `R${(cents / 100).toFixed(0)}`
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FeesChart({
  isAdmin,
  defaultScope = 'mine',
  showScopeToggle = true,
  bare = false,
}: {
  isAdmin: boolean
  defaultScope?: 'mine' | 'all'
  showScopeToggle?: boolean
  bare?: boolean
}) {
  const [scope, setScope] = useState<'mine' | 'all'>(defaultScope)
  const canToggle = isAdmin && showScopeToggle
  const [chart, setChart] = useState<ChartPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const chartContainerRef = useRef<HTMLDivElement | null>(null)
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    setLoading(true)
    fetch(`/api/dashboard/fees-chart?scope=${scope}`)
      .then((r) => r.json())
      .then((data) => setChart(data))
      .catch(() => setChart(null))
      .finally(() => setLoading(false))
  }, [scope])

  useEffect(() => {
    const node = chartContainerRef.current
    if (!node) return

    const updateSize = () => {
      const rect = node.getBoundingClientRect()
      setChartSize({
        width: Math.max(0, Math.round(rect.width)),
        height: Math.max(0, Math.round(rect.height)),
      })
    }

    updateSize()

    const frameId = requestAnimationFrame(updateSize)
    const observer = new ResizeObserver(updateSize)
    observer.observe(node)

    return () => {
      cancelAnimationFrame(frameId)
      observer.disconnect()
    }
  }, [])

  const maxDay = chart
    ? chart.data[chart.data.length - 1]?.day ?? chart.daysInCurrentMonth
    : 31
  const xTicks = chart
    ? [1, 5, 10, 15, 20, 25, maxDay].filter((d, i, arr) => arr.indexOf(d) === i)
    : [1, 5, 10, 15, 20, 25, 31]

  const header = (
    <div className="flex items-center justify-between mb-4">
      <div>
        <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#80796F', marginBottom: 6 }}>
          Fees Recorded
        </p>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: '#2C2C2A', fontWeight: 400, lineHeight: 1.2 }}>
          {chart?.currentMonthName ?? '…'} — Cumulative
        </h2>
      </div>

      {canToggle && (
        <div
          className="flex items-center gap-0.5 p-0.5 rounded-lg"
          style={{ background: 'rgba(74, 72, 69, 0.07)' }}
        >
          {(['mine', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              style={{
                fontFamily: 'var(--font-noto-sans)',
                fontSize: 11,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                padding: '6px 14px',
                borderRadius: 8,
                transition: 'all 0.2s',
                background: scope === s ? 'rgba(255,252,250,0.9)' : 'transparent',
                color: scope === s ? '#2C2C2A' : '#80796F',
                boxShadow: scope === s ? '0 1px 3px rgba(74,72,69,0.10)' : 'none',
              }}
            >
              {s === 'mine' ? 'My Fees' : 'All Earners'}
            </button>
          ))}
        </div>
      )}
    </div>
  )

  const body = (
    <>
      {/* Legend */}
      {chart && (
        <div className="flex items-center gap-6 mb-4">
          <LegendItem color={C_CURRENT} label={chart.currentMonthName} type="area" />
          <LegendItem color={C_PREVIOUS} label={chart.previousMonthName} type="area" />
          {chart.monthlyTargetCents != null && (
            <LegendItem color={C_TARGET} label="Target" type="dotted" />
          )}
        </div>
      )}

      {/* Chart */}
      <div ref={chartContainerRef} className="h-64 w-full" style={{ minWidth: 0, minHeight: 256 }}>
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#80796F' }}
              className="animate-pulse"
            >
              Loading…
            </p>
          </div>
        ) : !chart?.data?.length ? (
          <div className="h-full flex items-center justify-center text-center">
            <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#80796F' }}>
              No fee entries yet this month.<br />Record time to see your chart.
            </p>
          </div>
        ) : chartSize.width === 0 || chartSize.height === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#80796F' }}
              className="animate-pulse"
            >
              Rendering…
            </p>
          </div>
        ) : (
          <AreaChart
            width={chartSize.width}
            height={chartSize.height}
            data={chart.data}
            margin={{ top: 4, right: 4, left: 8, bottom: 0 }}
          >
              <defs>
                <linearGradient id="gradCurrent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C_CURRENT} stopOpacity={0.22} />
                  <stop offset="95%" stopColor={C_CURRENT} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradPrevious" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C_PREVIOUS} stopOpacity={0.14} />
                  <stop offset="95%" stopColor={C_PREVIOUS} stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke={C_GRID} vertical={false} />

              <XAxis
                dataKey="day"
                ticks={xTicks}
                tick={{ fontSize: 11, fontFamily: 'var(--font-noto-sans)', fill: C_TICK }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}`}
              />

              <YAxis
                tick={{ fontSize: 11, fontFamily: 'var(--font-noto-sans)', fill: C_TICK }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatYAxis}
                width={52}
              />

              <Tooltip
                content={
                  <ChartTooltip
                    currentMonthName={chart.currentMonthName}
                    previousMonthName={chart.previousMonthName}
                  />
                }
                cursor={{ stroke: '#D8D3CB', strokeWidth: 1 }}
              />

              <ReferenceLine
                x={chart.today}
                stroke={`${C_CURRENT}66`}
                strokeWidth={1}
                strokeDasharray="2 3"
              />

              <Area
                type="monotone"
                dataKey="previous"
                stroke={C_PREVIOUS}
                strokeWidth={1.5}
                fill="url(#gradPrevious)"
                dot={false}
                activeDot={false}
              />

              {chart.monthlyTargetCents != null && (
                <Area
                  type="monotone"
                  dataKey="target"
                  stroke={C_TARGET}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  fill="none"
                  dot={false}
                  activeDot={false}
                />
              )}

              <Area
                type="monotone"
                dataKey="current"
                stroke={C_CURRENT}
                strokeWidth={2}
                fill="url(#gradCurrent)"
                dot={false}
                activeDot={{ r: 3, fill: C_CURRENT, strokeWidth: 0 }}
                connectNulls={false}
              />
          </AreaChart>
        )}
      </div>
    </>
  )

  if (bare) {
    return (
      <div>
        {header}
        {body}
      </div>
    )
  }

  // Non-bare: use glass card styling (for standalone use)
  return (
    <div className="glass-card glass-card-no-hover">
      {header}
      {body}
    </div>
  )
}

// ─── Legend item ──────────────────────────────────────────────────────────────

function LegendItem({ color, label, type }: { color: string; label: string; type: 'area' | 'dotted' }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex-shrink-0 w-6 h-[2px] relative">
        {type === 'dotted' ? (
          <svg width="24" height="2" viewBox="0 0 24 2" fill="none">
            <line x1="0" y1="1" x2="24" y2="1" stroke={color} strokeWidth="2" strokeDasharray="4 3" />
          </svg>
        ) : (
          <span className="block w-6 h-[2px] rounded-full" style={{ backgroundColor: color }} />
        )}
      </span>
      <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, color: '#80796F' }}>{label}</span>
    </div>
  )
}
