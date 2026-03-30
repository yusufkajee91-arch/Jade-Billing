'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const settingsNav = [
  { label: 'General', href: '/settings' },
  { label: 'Users', href: '/settings/users' },
  { label: 'Fee Levels', href: '/settings/fee-levels' },
  { label: 'Posting Codes', href: '/settings/posting-codes' },
  { label: 'Import Data', href: '/settings/import-data' },
]

export function SettingsNav() {
  const pathname = usePathname()

  return (
    <nav style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(216,211,203,0.6)', marginBottom: 24 }}>
      {settingsNav.map((item) => {
        const isActive =
          item.href === '/settings'
            ? pathname === '/settings'
            : pathname.startsWith(item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              fontFamily: 'var(--font-noto-sans)',
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '12px 16px',
              textDecoration: 'none',
              borderBottom: `2px solid ${isActive ? '#B08B82' : 'transparent'}`,
              marginBottom: -1,
              color: isActive ? '#3E3B36' : '#80796F',
              transition: 'color 0.15s ease',
            }}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
