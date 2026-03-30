'use client'

import { useState } from 'react'
import { TrialBalance } from './trial-balance-report'
import { GeneralJournal } from './general-journal-report'
import { TrustRegister } from './trust-register-report'
import { DebtorsReport } from './debtors-report'
import { InvoiceRegister } from './invoice-register-report'
import { WipReport } from './wip-report'
import { FeePerformance } from './fee-performance-report'
import { TimeSummary } from './time-summary-report'
import { BankRecon } from './bank-recon-report'
import { TrustInvestmentsReport } from './trust-investments-report'
import { MatterLedgerReport } from './matter-ledger-report'
import { IncomeExpenseReport } from './income-expense-report'
import { BalanceSheetReport } from './balance-sheet-report'
import { GlDetailReport } from './gl-detail-report'

// ─── Types ────────────────────────────────────────────────────────────────────

type ReportId =
  | 'trial-balance'
  | 'general-journal'
  | 'trust-register'
  | 'debtors'
  | 'invoice-register'
  | 'wip'
  | 'fee-performance'
  | 'time-summary'
  | 'bank-recon'
  | 'trust-investments'
  | 'matter-ledger'
  | 'income-expense'
  | 'balance-sheet'
  | 'gl-detail'

interface Report {
  id: ReportId
  label: string
  description: string
  adminOnly?: boolean
}

const REPORTS: Report[] = [
  { id: 'trial-balance', label: 'Trial Balance', description: 'GL account balances as at a date' },
  { id: 'general-journal', label: 'General Journal', description: 'Double-entry journal for a period' },
  { id: 'income-expense', label: 'Income & Expense', description: 'Profit & loss for a period', adminOnly: true },
  { id: 'balance-sheet', label: 'Balance Sheet', description: 'Assets, liabilities & equity as at a date', adminOnly: true },
  { id: 'gl-detail', label: 'GL Account Detail', description: 'Per-account ledger with running balance', adminOnly: true },
  { id: 'trust-register', label: 'Trust Register', description: 'Trust balances per matter' },
  { id: 'trust-investments', label: 'Trust & Investments', description: 'Trust balances as at a date (exportable)', adminOnly: true },
  { id: 'matter-ledger', label: 'Matter Trust Ledger', description: 'Trust audit trail per matter' },
  { id: 'debtors', label: 'Debtors Age Analysis', description: 'Outstanding invoices by age bucket' },
  { id: 'invoice-register', label: 'Invoice Register', description: 'All invoices for a period' },
  { id: 'wip', label: 'WIP Report', description: 'Unbilled work in progress by matter' },
  { id: 'fee-performance', label: 'Fee Earner Performance', description: 'Fees per earner for a period', adminOnly: true },
  { id: 'time-summary', label: 'Time Recording', description: 'Detailed time entries for a period' },
  { id: 'bank-recon', label: 'Bank Reconciliation', description: 'Statement reconciliation report' },
]

// ─── Main ReportsView ─────────────────────────────────────────────────────────

export function ReportsView({ isAdmin }: { isAdmin: boolean }) {
  const [selected, setSelected] = useState<ReportId>('trial-balance')

  const visibleReports = REPORTS.filter((r) => !r.adminOnly || isAdmin)

  const renderReport = () => {
    switch (selected) {
      case 'trial-balance': return <TrialBalance />
      case 'general-journal': return <GeneralJournal />
      case 'trust-register': return <TrustRegister />
      case 'debtors': return <DebtorsReport />
      case 'invoice-register': return <InvoiceRegister />
      case 'wip': return <WipReport />
      case 'fee-performance': return isAdmin ? <FeePerformance /> : null
      case 'time-summary': return <TimeSummary isAdmin={isAdmin} />
      case 'bank-recon': return <BankRecon />
      case 'trust-investments': return isAdmin ? <TrustInvestmentsReport /> : null
      case 'matter-ledger': return <MatterLedgerReport />
      case 'income-expense': return isAdmin ? <IncomeExpenseReport /> : null
      case 'balance-sheet': return isAdmin ? <BalanceSheetReport /> : null
      case 'gl-detail': return isAdmin ? <GlDetailReport /> : null
    }
  }

  return (
    <div style={{ width: '100%', paddingTop: '16px' }}>
      {/* Dark header */}
      <div className="fade-up page-dark-header" style={{ animationDelay: '0ms', background: 'rgba(74,72,69,0.92)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', padding: '20px 28px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(241,237,234,0.50)', marginBottom: 4 }}>
            Compliance
          </p>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 400, color: '#F1EDEA', margin: 0, lineHeight: 1.2 }}>
            Reports
          </h1>
        </div>
        <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: 'rgba(241,237,234,0.55)' }}>
          {visibleReports.find(r => r.id === selected)?.label}
        </p>
      </div>

      <div className="fade-up" style={{ animationDelay: '80ms', display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* Left nav */}
        <aside style={{ width: 220, flexShrink: 0, background: 'rgba(255,252,250,0.62)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.80)', borderRadius: 20, boxShadow: '0 8px 32px rgba(74,72,69,0.08)', overflow: 'hidden', position: 'sticky', top: 20 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(216,211,203,0.6)' }}>
            <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#80796F' }}>Reports</p>
          </div>
          <nav>
            {visibleReports.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelected(r.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '12px 20px',
                  borderBottom: '1px solid rgba(216,211,203,0.4)',
                  background: selected === r.id ? 'rgba(176,139,130,0.10)' : 'transparent',
                  borderLeft: selected === r.id ? '3px solid #B08B82' : '3px solid transparent',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, fontWeight: selected === r.id ? 500 : 400, color: selected === r.id ? '#2C2C2A' : '#5C5852', lineHeight: 1.3 }}>{r.label}</p>
                <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, color: '#80796F', marginTop: 2, lineHeight: 1.3 }}>{r.description}</p>
              </button>
            ))}
          </nav>
        </aside>

        {/* Report content */}
        <div style={{ flex: 1, minWidth: 0, background: 'rgba(255,252,250,0.62)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.80)', borderRadius: 20, boxShadow: '0 8px 32px rgba(74,72,69,0.08)', overflow: 'hidden', padding: 24 }}>
          {renderReport()}
        </div>
      </div>
    </div>
  )
}
