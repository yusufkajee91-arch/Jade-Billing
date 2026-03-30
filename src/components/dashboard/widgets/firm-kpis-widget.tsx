import Link from 'next/link'
import { Shield, Users, FileText, AlertTriangle } from 'lucide-react'

export interface AdminKpis {
  trustBalanceCents: number
  debtorsCents: number
  unsentCents: number
  ficaIssues: number
}

function formatAmount(cents: number) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

interface KpiTileProps {
  icon: React.ElementType
  label: string
  value: string
  iconBg: string
  iconColor: string
  borderColor: string
  href: string
}

function KpiTile({ icon: Icon, label, value, iconBg, iconColor, borderColor, href }: KpiTileProps) {
  return (
    <Link href={href} className="block group" style={{ paddingLeft: 16, borderLeft: `3px solid ${borderColor}` }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
          transition: 'transform 0.2s ease',
        }}
        className="group-hover:scale-110"
      >
        <Icon style={{ width: 18, height: 18, color: iconColor }} strokeWidth={1.5} />
      </div>
      <p style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: '#2C2C2A', lineHeight: 1, marginBottom: 6 }}>
        {value}
      </p>
      <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#80796F' }}>
        {label}
      </p>
    </Link>
  )
}

export function FirmKpisWidget({ kpis }: { kpis: AdminKpis }) {
  return (
    <div className="glass-card" style={{ background: 'rgba(255,252,250,0.55)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.75)' }}>
      <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#80796F', marginBottom: 6 }}>
        Firm KPIs
      </p>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: '#2C2C2A', fontWeight: 400, marginBottom: 24, lineHeight: 1.2 }}>
        Firm Overview
      </h2>

      <div className="grid grid-cols-2 gap-6">
        <KpiTile
          href="/trust"
          icon={Shield}
          label="Held in Trust"
          value={formatAmount(kpis.trustBalanceCents)}
          iconBg="rgba(136, 151, 192, 0.15)"
          iconColor="#8897C0"
          borderColor="#8897C0"
        />
        <KpiTile
          href="/debtors"
          icon={Users}
          label="Debtors Outstanding"
          value={formatAmount(kpis.debtorsCents)}
          iconBg="rgba(176, 139, 130, 0.15)"
          iconColor="#B08B82"
          borderColor="#B08B82"
        />
        <KpiTile
          href="/invoices"
          icon={FileText}
          label="Unsent Invoices"
          value={formatAmount(kpis.unsentCents)}
          iconBg="rgba(176, 139, 130, 0.12)"
          iconColor="#C4998F"
          borderColor="#C4998F"
        />
        <KpiTile
          href="/fica"
          icon={AlertTriangle}
          label="FICA Issues"
          value={`${kpis.ficaIssues} ${kpis.ficaIssues === 1 ? 'client' : 'clients'}`}
          iconBg="rgba(154, 58, 58, 0.12)"
          iconColor="#9A3A3A"
          borderColor="#9A3A3A"
        />
      </div>
    </div>
  )
}
