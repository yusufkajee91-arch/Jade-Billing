'use client'

import { useState, useEffect, useRef } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

interface Earner {
  id: string
  initials: string
  name: string
  monthlyTargetCents: number | null
  color: string
}

interface ChartData {
  earners: Earner[]
  data: Array<Record<string, number>>
  today: number
  daysInCurrentMonth: number
  currentMonthName: string
}

function formatY(cents: number): string {
  if (cents >= 100_000_000) return `R${(cents / 100_000_000).toFixed(0)}m`
  if (cents >= 100_000) return `R${(cents / 100_000).toFixed(0)}k`
  return `R${(cents / 100).toFixed(0)}`
}

function EarnersTooltip({
  active,
  payload,
  label,
  earners,
}: {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number; color: string }>
  label?: number
  earners: Earner[]
}) {
  if (!active || !payload?.length) return null
  const earnerMap = new Map(earners.map((e) => [e.id, e]))
  const visible = payload.filter((p) => p.value > 0)
  if (!visible.length) return null

  return (
    <div className="bg-card border border-border rounded shadow-md px-3 py-2 text-xs font-sans space-y-1 min-w-[160px]">
      <p className="font-medium text-foreground tracking-wide uppercase text-[10px]">Day {label}</p>
      {visible.map((entry) => {
        const earner = earnerMap.get(entry.dataKey)
        return (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              {earner?.initials ?? entry.dataKey}
            </span>
            <span className="font-sans text-foreground font-medium">
              {formatCurrency(entry.value)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function AllEarnersChart() {
  const [chart, setChart] = useState<ChartData | null>(null)
  const [loading, setLoading] = useState(true)
  const chartContainerRef = useRef<HTMLDivElement | null>(null)
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    fetch('/api/dashboard/fees-chart-earners')
      .then((r) => r.json())
      .then(setChart)
      .catch(() => setChart(null))
      .finally(() => setLoading(false))
  }, [])

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

  const xTicks = chart
    ? [1, 5, 10, 15, 20, 25, chart.daysInCurrentMonth].filter(
        (d, i, arr) => arr.indexOf(d) === i,
      )
    : [1, 5, 10, 15, 20, 25, 31]

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground mb-1">
            All Fee Earners
          </p>
          <h2 className="font-serif text-xl font-normal text-foreground">
            {chart?.currentMonthName ?? '…'} — Cumulative by Earner
          </h2>
        </div>

        {/* Legend */}
        {chart && chart.earners.length > 0 && (
          <div className="flex items-center gap-4 flex-wrap justify-end max-w-xs">
            {chart.earners.map((earner) => (
              <div key={earner.id} className="flex items-center gap-1.5">
                <span
                  className="block w-5 h-[2px] rounded-full"
                  style={{ backgroundColor: earner.color }}
                />
                <span className="font-sans text-[11px] text-muted-foreground">
                  {earner.initials}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chart */}
      <div ref={chartContainerRef} className="h-64 w-full" style={{ minWidth: 0, minHeight: 256 }}>
        {loading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground font-sans text-xs tracking-wide uppercase animate-pulse">
            Loading…
          </div>
        ) : !chart?.earners?.length ? (
          <div className="h-full flex items-center justify-center text-muted-foreground font-sans text-xs text-center">
            No fee entries recorded this month.
          </div>
        ) : chartSize.width === 0 || chartSize.height === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground font-sans text-xs tracking-wide uppercase animate-pulse">
            Rendering…
          </div>
        ) : (
          <LineChart
            width={chartSize.width}
            height={chartSize.height}
            data={chart.data}
            margin={{ top: 4, right: 4, left: 8, bottom: 0 }}
          >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(33 15% 79% / 0.6)"
                vertical={false}
              />
              <XAxis
                dataKey="day"
                ticks={xTicks}
                tick={{ fontSize: 11, fontFamily: 'var(--font-noto-sans)', fill: 'hsl(30 5% 50%)' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fontFamily: 'var(--font-noto-sans)', fill: 'hsl(30 5% 50%)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatY}
                width={52}
              />
              <Tooltip
                content={<EarnersTooltip earners={chart.earners} />}
                cursor={{ stroke: 'hsl(33 15% 79%)', strokeWidth: 1 }}
              />
              <ReferenceLine
                x={chart.today}
                stroke="hsl(10 22% 60% / 0.4)"
                strokeWidth={1}
                strokeDasharray="2 3"
              />
              {chart.earners.map((earner) => (
                <Line
                  key={earner.id}
                  type="monotone"
                  dataKey={earner.id}
                  stroke={earner.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0, fill: earner.color }}
                  connectNulls={false}
                />
              ))}
          </LineChart>
        )}
      </div>
    </div>
  )
}
