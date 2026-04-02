'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Check, X, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'
import { useSession } from 'next-auth/react'
import { componentLogger } from '@/lib/debug'

const log = componentLogger('FeeSchedulesPage')

interface Category {
  id: string
  name: string
  jurisdiction: string
  currency: string
  _count: { items: number }
}

interface ScheduleItem {
  id: string
  categoryId: string
  section: string
  description: string
  officialFeeCents: number
  professionalFeeCents: number
  vatRate: string
  isActive: boolean
  sortOrder: number | null
}

interface SectionGroup {
  section: string
  items: ScheduleItem[]
}

const GLASS: React.CSSProperties = {
  background: 'rgba(255,252,250,0.62)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.80)',
  borderRadius: 20,
  boxShadow: '0 8px 32px rgba(74,72,69,0.08), 0 2px 8px rgba(74,72,69,0.04)',
}

function fmt(cents: number) {
  return formatCurrency(cents)
}

export default function FeeSchedulesPage() {
  log.info('render')
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'admin'

  const [categories, setCategories] = useState<Category[]>([])
  const [activeCatId, setActiveCatId] = useState<string | null>(null)
  const [groups, setGroups] = useState<SectionGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingItems, setLoadingItems] = useState(false)

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editProfFee, setEditProfFee] = useState('')
  const [editOfficialFee, setEditOfficialFee] = useState('')

  // New item state
  const [addingSection, setAddingSection] = useState<string | null>(null)
  const [newDesc, setNewDesc] = useState('')
  const [newProf, setNewProf] = useState('')
  const [newOfficial, setNewOfficial] = useState('0')

  const fetchCategories = useCallback(async () => {
    log.info('fetching fee schedule categories')
    try {
      const res = await fetch('/api/fee-schedules')
      if (!res.ok) throw new Error()
      const data: Category[] = await res.json()
      log.info('fee schedule categories loaded', { count: data.length })
      setCategories(data)
      if (data.length > 0 && !activeCatId) setActiveCatId(data[0].id)
    } catch (err) {
      log.error('failed to load fee schedules', err)
      toast.error('Failed to load fee schedules')
    } finally {
      setLoading(false)
    }
  }, [activeCatId])

  const fetchItems = useCallback(async (catId: string) => {
    log.debug('fetching schedule items', { categoryId: catId })
    setLoadingItems(true)
    try {
      const res = await fetch(`/api/fee-schedules/${catId}/items`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      log.info('schedule items loaded', { groupCount: data.length })
      setGroups(data)
    } catch (err) {
      log.error('failed to load schedule items', err)
      toast.error('Failed to load schedule items')
    } finally {
      setLoadingItems(false)
    }
  }, [])

  useEffect(() => { fetchCategories() }, [fetchCategories])
  useEffect(() => { if (activeCatId) fetchItems(activeCatId) }, [activeCatId, fetchItems])

  async function saveEdit(item: ScheduleItem) {
    try {
      const res = await fetch(`/api/fee-schedules/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          professionalFeeCents: Math.round(parseFloat(editProfFee || '0') * 100),
          officialFeeCents: Math.round(parseFloat(editOfficialFee || '0') * 100),
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Updated')
      setEditingId(null)
      if (activeCatId) fetchItems(activeCatId)
    } catch {
      toast.error('Failed to save')
    }
  }

  async function deleteItem(id: string) {
    if (!confirm('Delete this item?')) return
    try {
      await fetch(`/api/fee-schedules/items/${id}`, { method: 'DELETE' })
      toast.success('Deleted')
      if (activeCatId) fetchItems(activeCatId)
    } catch {
      toast.error('Failed to delete')
    }
  }

  async function addItem(section: string) {
    if (!newDesc.trim() || !newProf) return
    try {
      const res = await fetch(`/api/fee-schedules/${activeCatId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section,
          description: newDesc.trim(),
          professionalFeeCents: Math.round(parseFloat(newProf || '0') * 100),
          officialFeeCents: Math.round(parseFloat(newOfficial || '0') * 100),
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Item added')
      setAddingSection(null)
      setNewDesc(''); setNewProf(''); setNewOfficial('0')
      if (activeCatId) fetchItems(activeCatId)
    } catch {
      toast.error('Failed to add item')
    }
  }

  function startEdit(item: ScheduleItem) {
    setEditingId(item.id)
    setEditProfFee((item.professionalFeeCents / 100).toFixed(2))
    setEditOfficialFee((item.officialFeeCents / 100).toFixed(2))
  }

  const activeCat = categories.find((c) => c.id === activeCatId)

  return (
    <div style={{ width: '100%', paddingTop: '16px' }}>
      {/* Dark header */}
      <div
        className="fade-up page-dark-header"
        style={{
          animationDelay: '0ms',
          background: 'rgba(74,72,69,0.92)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.07)',
          padding: '20px 28px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(241,237,234,0.50)', marginBottom: 4 }}>
            Billing
          </p>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 400, color: '#F1EDEA', margin: 0, lineHeight: 1.2 }}>
            Fee Schedules
            {activeCat && (
              <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 12, color: 'rgba(241,237,234,0.45)', fontWeight: 400, marginLeft: 16 }}>
                {activeCat.jurisdiction}
              </span>
            )}
          </h1>
        </div>
        <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: 'rgba(241,237,234,0.55)' }}>
          {activeCat ? `${activeCat._count.items} items` : ''}
        </span>
      </div>

      {loading ? (
        <div style={{ ...GLASS, padding: 48, textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#80796F' }}>Loading…</p>
        </div>
      ) : categories.length === 0 ? (
        <div style={{ ...GLASS, padding: 64, textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: '#80796F', fontStyle: 'italic' }}>No fee schedules configured.</p>
        </div>
      ) : (
        <div style={{ ...GLASS, overflow: 'hidden' }} className="fade-up">
          {/* Category tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(216,211,203,0.5)', padding: '0 20px', overflowX: 'auto' }}>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCatId(cat.id)}
                style={{
                  fontFamily: 'var(--font-noto-sans)',
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '14px 16px',
                  border: 'none',
                  borderBottom: `2px solid ${activeCatId === cat.id ? '#B08B82' : 'transparent'}`,
                  background: 'none',
                  cursor: 'pointer',
                  color: activeCatId === cat.id ? '#3E3B36' : '#80796F',
                  whiteSpace: 'nowrap',
                  transition: 'color 0.15s',
                }}
              >
                {cat.name}
                <span style={{ marginLeft: 6, fontFamily: 'var(--font-noto-sans)', fontSize: 10, color: '#B08B82' }}>
                  {cat._count.items}
                </span>
              </button>
            ))}
          </div>

          {/* Items */}
          <div style={{ padding: '0 0 8px' }}>
            {loadingItems ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#80796F' }}>Loading items…</p>
              </div>
            ) : groups.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: '#80796F', fontStyle: 'italic' }}>No items in this schedule.</p>
              </div>
            ) : (
              groups.map((group) => (
                <div key={group.section}>
                  {/* Section header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px 8px', borderTop: '1px solid rgba(216,211,203,0.4)' }}>
                    <p style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#B08B82', margin: 0, fontWeight: 600 }}>
                      {group.section}
                    </p>
                    {isAdmin && (
                      <button
                        onClick={() => { setAddingSection(group.section); setNewDesc(''); setNewProf(''); setNewOfficial('0') }}
                        style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, color: '#B08B82', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <Plus style={{ width: 12, height: 12 }} /> Add item
                      </button>
                    )}
                  </div>

                  {/* Section items */}
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(216,211,203,0.3)' }}>
                        <th style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#80796F', padding: '6px 24px', textAlign: 'left', fontWeight: 500 }}>Description</th>
                        <th style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#80796F', padding: '6px 16px', textAlign: 'right', fontWeight: 500, whiteSpace: 'nowrap', width: 140 }}>Official Fee</th>
                        <th style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#80796F', padding: '6px 16px', textAlign: 'right', fontWeight: 500, whiteSpace: 'nowrap', width: 160 }}>Professional Fee</th>
                        {isAdmin && <th style={{ width: 80 }} />}
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((item) => (
                        <tr key={item.id} style={{ borderBottom: '1px solid rgba(216,211,203,0.2)' }}>
                          <td style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: '#3E3B36', padding: '10px 24px' }}>
                            {item.description}
                            {!item.isActive && (
                              <span style={{ marginLeft: 8, fontSize: 10, color: '#80796F' }}>(inactive)</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                            {editingId === item.id ? (
                              <input
                                type="number"
                                value={editOfficialFee}
                                onChange={(e) => setEditOfficialFee(e.target.value)}
                                style={{ width: 90, fontFamily: 'var(--font-noto-sans)', fontSize: 13, textAlign: 'right', border: '1px solid #D8D3CB', borderRadius: 6, padding: '3px 8px', background: 'rgba(255,252,250,0.9)' }}
                                min="0"
                                step="0.01"
                              />
                            ) : (
                              <span style={{ fontFamily: 'var(--font-noto-sans)', fontSize: 13, color: item.officialFeeCents > 0 ? '#80796F' : 'rgba(128,121,111,0.35)' }}>
                                {item.officialFeeCents > 0 ? fmt(item.officialFeeCents) : '—'}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                            {editingId === item.id ? (
                              <input
                                type="number"
                                value={editProfFee}
                                onChange={(e) => setEditProfFee(e.target.value)}
                                style={{ width: 110, fontFamily: 'var(--font-noto-sans)', fontSize: 14, textAlign: 'right', border: '1px solid #D8D3CB', borderRadius: 6, padding: '3px 8px', background: 'rgba(255,252,250,0.9)' }}
                                min="0"
                                step="0.01"
                                autoFocus
                              />
                            ) : (
                              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 15, color: '#B08B82' }}>
                                {fmt(item.professionalFeeCents)}
                              </span>
                            )}
                          </td>
                          {isAdmin && (
                            <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                              {editingId === item.id ? (
                                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                  <button
                                    onClick={() => saveEdit(item)}
                                    style={{ padding: 5, borderRadius: 6, background: 'rgba(74,124,89,0.1)', border: '1px solid rgba(74,124,89,0.25)', cursor: 'pointer', color: '#4A7C59', display: 'flex' }}
                                  >
                                    <Check style={{ width: 13, height: 13 }} />
                                  </button>
                                  <button
                                    onClick={() => setEditingId(null)}
                                    style={{ padding: 5, borderRadius: 6, background: 'rgba(128,121,111,0.08)', border: '1px solid rgba(128,121,111,0.2)', cursor: 'pointer', color: '#80796F', display: 'flex' }}
                                  >
                                    <X style={{ width: 13, height: 13 }} />
                                  </button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', opacity: 0 }} className="row-actions">
                                  <button
                                    onClick={() => startEdit(item)}
                                    style={{ padding: 5, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#80796F', display: 'flex' }}
                                  >
                                    <Pencil style={{ width: 13, height: 13 }} />
                                  </button>
                                  <button
                                    onClick={() => deleteItem(item.id)}
                                    style={{ padding: 5, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#C0574A', display: 'flex' }}
                                  >
                                    <Trash2 style={{ width: 13, height: 13 }} />
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}

                      {/* Add item row */}
                      {addingSection === group.section && isAdmin && (
                        <tr style={{ background: 'rgba(176,139,130,0.04)', borderBottom: '1px solid rgba(216,211,203,0.3)' }}>
                          <td style={{ padding: '8px 24px' }}>
                            <input
                              type="text"
                              value={newDesc}
                              onChange={(e) => setNewDesc(e.target.value)}
                              placeholder="Description…"
                              style={{ width: '100%', fontFamily: 'var(--font-noto-sans)', fontSize: 13, border: '1px solid #D8D3CB', borderRadius: 6, padding: '5px 10px', background: 'rgba(255,252,250,0.9)' }}
                              autoFocus
                            />
                          </td>
                          <td style={{ padding: '8px 16px', textAlign: 'right' }}>
                            <input
                              type="number"
                              value={newOfficial}
                              onChange={(e) => setNewOfficial(e.target.value)}
                              style={{ width: 90, fontFamily: 'var(--font-noto-sans)', fontSize: 13, textAlign: 'right', border: '1px solid #D8D3CB', borderRadius: 6, padding: '5px 8px', background: 'rgba(255,252,250,0.9)' }}
                              min="0" step="0.01" placeholder="0.00"
                            />
                          </td>
                          <td style={{ padding: '8px 16px', textAlign: 'right' }}>
                            <input
                              type="number"
                              value={newProf}
                              onChange={(e) => setNewProf(e.target.value)}
                              style={{ width: 110, fontFamily: 'var(--font-noto-sans)', fontSize: 13, textAlign: 'right', border: '1px solid #D8D3CB', borderRadius: 6, padding: '5px 8px', background: 'rgba(255,252,250,0.9)' }}
                              min="0" step="0.01" placeholder="0.00"
                            />
                          </td>
                          <td style={{ padding: '8px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => addItem(group.section)}
                                style={{ padding: 5, borderRadius: 6, background: 'rgba(74,124,89,0.1)', border: '1px solid rgba(74,124,89,0.25)', cursor: 'pointer', color: '#4A7C59', display: 'flex' }}
                              >
                                <Check style={{ width: 13, height: 13 }} />
                              </button>
                              <button
                                onClick={() => setAddingSection(null)}
                                style={{ padding: 5, borderRadius: 6, background: 'rgba(128,121,111,0.08)', border: '1px solid rgba(128,121,111,0.2)', cursor: 'pointer', color: '#80796F', display: 'flex' }}
                              >
                                <X style={{ width: 13, height: 13 }} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <style>{`
        tr:hover .row-actions { opacity: 1 !important; transition: opacity 0.15s; }
        .row-actions { transition: opacity 0.15s; }
      `}</style>
    </div>
  )
}
