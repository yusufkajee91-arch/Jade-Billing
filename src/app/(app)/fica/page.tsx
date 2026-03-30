'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { FicaBadge } from '@/components/ui/fica-badge'
import { formatEntityType } from '@/lib/entity-types'

interface Client {
  id: string
  clientCode: string
  clientName: string
  entityType: string
  ficaStatus: string
  isActive: boolean
  _count: { matters: number }
}

const GLASS: React.CSSProperties = {
  background: 'rgba(255,252,250,0.62)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.80)',
  borderRadius: 20,
  boxShadow: '0 8px 32px rgba(74,72,69,0.08), 0 2px 8px rgba(74,72,69,0.04)',
}

const STATUS_TABS = [
  { id: 'all', label: 'All Clients' },
  { id: 'not_compliant', label: 'Not Compliant' },
  { id: 'partially_compliant', label: 'Partially Compliant' },
  { id: 'compliant', label: 'Compliant' },
] as const

type TabId = (typeof STATUS_TABS)[number]['id']

export default function FicaPage() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabId>('all')

  const fetchClients = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/clients')
      if (res.ok) setClients(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  const filtered = activeTab === 'all'
    ? clients
    : clients.filter((c) => c.ficaStatus === activeTab)

  const counts = {
    all: clients.length,
    not_compliant: clients.filter((c) => c.ficaStatus === 'not_compliant').length,
    partially_compliant: clients.filter((c) => c.ficaStatus === 'partially_compliant').length,
    compliant: clients.filter((c) => c.ficaStatus === 'compliant').length,
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
            FICA Compliance
          </h1>
        </div>
        <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: 'rgba(241,237,234,0.55)' }}>
          {counts.all} {counts.all === 1 ? 'client' : 'clients'}
        </span>
      </div>

      {/* Stat cards */}
      <div className="fade-up" style={{ animationDelay: '40ms', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        <div style={{ ...GLASS, padding: 20 }}>
          <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#80796F', marginBottom: 6 }}>Not Compliant</p>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: '#C0574A', margin: 0, lineHeight: 1 }}>{counts.not_compliant}</p>
        </div>
        <div style={{ ...GLASS, padding: 20 }}>
          <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#80796F', marginBottom: 6 }}>Partially Compliant</p>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: '#B08B82', margin: 0, lineHeight: 1 }}>{counts.partially_compliant}</p>
        </div>
        <div style={{ ...GLASS, padding: 20 }}>
          <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#80796F', marginBottom: 6 }}>Compliant</p>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: '#6B7D6A', margin: 0, lineHeight: 1 }}>{counts.compliant}</p>
        </div>
      </div>

      {/* Content */}
      <div className="fade-up" style={{ animationDelay: '80ms', ...GLASS, overflow: 'hidden' }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(216,211,203,0.5)', padding: '0 20px' }}>
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                fontFamily: 'var(--font-noto-sans)',
                fontSize: 11,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '14px 16px',
                border: 'none',
                borderBottom: `2px solid ${activeTab === tab.id ? '#B08B82' : 'transparent'}`,
                background: 'none',
                cursor: 'pointer',
                color: activeTab === tab.id ? '#3E3B36' : '#80796F',
                transition: 'color 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
              {counts[tab.id] > 0 && (
                <span style={{ marginLeft: 6, fontFamily: 'var(--font-noto-sans)', fontSize: 10, color: '#B08B82' }}>
                  {counts[tab.id]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="brand-table">
            <thead>
              <tr>
                <th>Client Code</th>
                <th>Client Name</th>
                <th>Entity Type</th>
                <th>FICA Status</th>
                <th>Active Matters</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6}>
                      <div style={{ height: 16, background: 'rgba(216,211,203,0.4)', borderRadius: 4 }} className="animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', paddingTop: 56, paddingBottom: 56 }}>
                    <ShieldCheck style={{ width: 36, height: 36, color: '#B08B82', margin: '0 auto 12px' }} strokeWidth={1.5} />
                    <p style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: '#80796F', fontStyle: 'italic' }}>
                      {activeTab === 'all' ? 'No clients yet.' : 'No clients with this status.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#80796F' }}>
                        {client.clientCode}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 14, color: '#3E3B36', fontWeight: 500 }}>
                        {client.clientName}
                        {!client.isActive && (
                          <span style={{ marginLeft: 8, fontSize: 10, color: '#80796F', fontWeight: 400 }}>(Inactive)</span>
                        )}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#80796F' }}>
                        {formatEntityType(client.entityType)}
                      </span>
                    </td>
                    <td>
                      <FicaBadge status={client.ficaStatus} />
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#80796F' }}>
                        {client._count.matters}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => router.push(`/clients/${client.id}?tab=fica`)}
                        style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: '#B08B82', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6 }}
                      >
                        Manage →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
