'use client'

import { Download, Printer } from 'lucide-react'
import React from 'react'

export const ACCENT = '#8897C0'

export function ReportHeader({
  title,
  onPrint,
  onExport,
}: {
  title: string
  onPrint?: () => void
  onExport?: () => void
}) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <p className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground mb-1">Reports</p>
        <h1 className="font-serif text-2xl font-light text-foreground">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 font-sans text-xs tracking-wide uppercase text-muted-foreground hover:text-foreground transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        )}
        {onPrint && (
          <button
            onClick={onPrint}
            className="flex items-center gap-1.5 font-sans text-xs tracking-wide uppercase text-muted-foreground hover:text-foreground transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </button>
        )}
      </div>
    </div>
  )
}

export function FilterRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3 mb-6 p-4 rounded-lg border border-border bg-muted/20">
      {children}
    </div>
  )
}

export function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

export const inputCls =
  'h-8 px-3 rounded border border-border bg-background font-sans text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary'

export function RunButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="h-8 px-4 rounded bg-primary text-primary-foreground font-sans text-xs tracking-widest uppercase disabled:opacity-50 hover:bg-[hsl(5_20%_50%)] transition-colors"
    >
      {loading ? 'Loading…' : 'Run Report'}
    </button>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-16 text-center text-muted-foreground font-sans text-xs tracking-wide uppercase">
      {message}
    </div>
  )
}

export function TableWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">{children}</table>
      </div>
    </div>
  )
}

export const thCls = 'text-left px-4 py-3 font-sans text-[10px] tracking-widest uppercase text-muted-foreground'
export const thRCls = thCls + ' text-right'
export const tdCls = 'px-4 py-3 font-sans text-sm text-foreground'
export const tdMCls = 'px-4 py-3 font-sans text-sm'
export const tdRCls = tdMCls + ' text-right'

export function THead({ children }: { children: React.ReactNode }) {
  return <thead><tr className="border-b border-border bg-muted/30">{children}</tr></thead>
}

export function TFoot({ children }: { children: React.ReactNode }) {
  return <tfoot><tr className="border-t-2 border-border bg-muted/20">{children}</tr></tfoot>
}

export function fmtHours(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}
