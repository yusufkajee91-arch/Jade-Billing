'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { componentLogger } from '@/lib/debug'

const log = componentLogger('GlobalSearch')

interface MatterResult {
  id: string
  matterCode: string
  description: string
  clientCode: string
  clientName: string
  status: string
  type: 'matter'
}

export function GlobalSearch() {
  log.debug('render')
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MatterResult[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    log.debug('searching', { query: q })
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      if (!res.ok) {
        log.warn('search failed', { status: res.status })
        return
      }
      const data = await res.json()
      const matters: MatterResult[] = data.matters ?? []
      log.info('search results', { query: q, resultCount: matters.length })
      setResults(matters.slice(0, 8))
      setOpen(matters.length > 0)
      setActiveIndex(-1)
    } catch {
      log.warn('search request failed', { query: q })
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(value), 300)
  }

  const selectResult = (matter: MatterResult) => {
    setOpen(false)
    setQuery('')
    setResults([])
    router.push(`/matters/${matter.id}`)
  }

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) {
      if (e.key === 'Escape') {
        setQuery('')
        setOpen(false)
        inputRef.current?.blur()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex(prev => (prev < results.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex(prev => (prev > 0 ? prev - 1 : results.length - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (activeIndex >= 0 && activeIndex < results.length) {
          selectResult(results[activeIndex]!)
        }
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        setQuery('')
        inputRef.current?.blur()
        break
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Cleanup debounce
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <div ref={containerRef} style={{ position: 'relative', width: 400 }}>
      {/* Input */}
      <div style={{ position: 'relative' }}>
        <Search
          size={14}
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#A09A90',
            pointerEvents: 'none',
          }}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          onKeyDown={handleKeyDown}
          placeholder="Search matters and clients..."
          style={{
            width: '100%',
            fontFamily: 'var(--font-noto-sans)',
            fontSize: 13,
            padding: '9px 14px 9px 34px',
            borderRadius: 10,
            border: '1px solid rgba(216,211,203,0.6)',
            background: 'rgba(255,252,250,0.80)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            color: '#3E3B36',
            outline: 'none',
            transition: 'border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease',
            boxShadow: '0 1px 4px rgba(74,72,69,0.06)',
          }}
          onMouseOver={e => {
            (e.target as HTMLInputElement).style.borderColor = 'rgba(176,139,130,0.45)'
          }}
          onMouseOut={e => {
            if (document.activeElement !== e.target) {
              (e.target as HTMLInputElement).style.borderColor = 'rgba(216,211,203,0.6)'
            }
          }}
          onBlurCapture={e => {
            (e.target as HTMLInputElement).style.borderColor = 'rgba(216,211,203,0.6)';
            (e.target as HTMLInputElement).style.background = 'rgba(255,252,250,0.80)';
            (e.target as HTMLInputElement).style.boxShadow = '0 1px 4px rgba(74,72,69,0.06)'
          }}
          onFocusCapture={e => {
            (e.target as HTMLInputElement).style.borderColor = 'rgba(176,139,130,0.5)';
            (e.target as HTMLInputElement).style.background = 'rgba(255,252,250,0.95)';
            (e.target as HTMLInputElement).style.boxShadow = '0 2px 8px rgba(74,72,69,0.10)'
          }}
        />
        {loading && (
          <div
            style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 14,
              height: 14,
              border: '2px solid rgba(160,154,144,0.2)',
              borderTopColor: 'rgba(160,154,144,0.6)',
              borderRadius: '50%',
              animation: 'spin 0.6s linear infinite',
            }}
          />
        )}
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 50,
            background: 'rgba(255,252,250,0.95)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.80)',
            borderRadius: 12,
            boxShadow: '0 12px 40px rgba(74,72,69,0.18), 0 4px 12px rgba(74,72,69,0.08)',
            overflow: 'hidden',
          }}
        >
          {results.map((matter, idx) => (
            <button
              key={matter.id}
              onClick={() => selectResult(matter)}
              onMouseEnter={() => setActiveIndex(idx)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 14px',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.1s ease',
                background: idx === activeIndex ? 'rgba(176,139,130,0.12)' : 'transparent',
                borderBottom: idx < results.length - 1 ? '1px solid rgba(216,211,203,0.4)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-noto-sans)',
                    fontSize: 12,
                    color: '#80796F',
                    flexShrink: 0,
                  }}
                >
                  {matter.matterCode}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-noto-sans)',
                    fontSize: 13,
                    color: '#3E3B36',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {matter.description}
                </span>
              </div>
              <p
                style={{
                  fontFamily: 'var(--font-noto-sans)',
                  fontSize: 11,
                  color: '#A09A90',
                  margin: '2px 0 0',
                }}
              >
                {matter.clientName}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: translateY(-50%) rotate(360deg); } }`}</style>
    </div>
  )
}
