'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useTheme } from 'next-themes'
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  Clock,
  FileText,
  Landmark,
  Building2,
  ArrowLeftRight,
  CreditCard,
  ShieldCheck,
  BarChart3,
  Settings,
  LogOut,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Menu,
  Receipt,
  CalendarDays,
  Palette,
  BookOpen,
  ClipboardList,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  trust?: boolean
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: 'Practice',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="h-[18px] w-[18px]" /> },
      { label: 'Matters', href: '/matters', icon: <FolderOpen className="h-[18px] w-[18px]" /> },
      { label: 'Clients', href: '/clients', icon: <Users className="h-[18px] w-[18px]" /> },
      { label: 'My Time Sheet', href: '/timesheet', icon: <Clock className="h-[18px] w-[18px]" /> },
      { label: 'Diary', href: '/diary', icon: <CalendarDays className="h-[18px] w-[18px]" /> },
      { label: 'Practice Overview', href: '/practice', icon: <ClipboardList className="h-[18px] w-[18px]" /> },
    ],
  },
  {
    label: 'Billing',
    items: [
      { label: 'Invoicing', href: '/invoices', icon: <FileText className="h-[18px] w-[18px]" /> },
      { label: 'Debtors', href: '/debtors', icon: <Receipt className="h-[18px] w-[18px]" /> },
      { label: 'Fee Schedules', href: '/fee-schedules', icon: <BookOpen className="h-[18px] w-[18px]" /> },
    ],
  },
  {
    label: 'Accounts',
    items: [
      { label: 'Trust Account', href: '/trust', icon: <Landmark className="h-[18px] w-[18px]" />, trust: true },
      { label: 'Business Account', href: '/business', icon: <Building2 className="h-[18px] w-[18px]" /> },
      { label: 'Bank Recon', href: '/reconciliation', icon: <ArrowLeftRight className="h-[18px] w-[18px]" /> },
      { label: 'Collections', href: '/collections', icon: <CreditCard className="h-[18px] w-[18px]" /> },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { label: 'FICA', href: '/fica', icon: <ShieldCheck className="h-[18px] w-[18px]" /> },
      { label: 'Reports', href: '/reports', icon: <BarChart3 className="h-[18px] w-[18px]" /> },
    ],
  },
]

interface SidebarProps {
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { theme, setTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const [sidebarLight, setSidebarLight] = useState(false)
  const [firmLogo, setFirmLogo] = useState<string | null>(null)
  const [firmName, setFirmName] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed')
    if (stored !== null) setCollapsed(stored === 'true')
    const storedLight = localStorage.getItem('sidebar-light')
    if (storedLight !== null) setSidebarLight(storedLight === 'true')
    // Load firm logo
    fetch('/api/firm-settings')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.logoFilePath) setFirmLogo(data.logoFilePath)
        if (data?.tradingName) setFirmName(data.tradingName)
        else if (data?.firmName) setFirmName(data.firmName)
      })
      .catch(() => null)
  }, [])

  const toggleSidebarLight = () => {
    const next = !sidebarLight
    setSidebarLight(next)
    localStorage.setItem('sidebar-light', String(next))
  }

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const isAdmin = session?.user?.role === 'admin'

  const NavItemComponent = ({ item }: { item: NavItem }) => {
    const active = isActive(item.href)
    const trustActive = active && item.trust

    return (
      <Link
        href={item.href}
        onClick={onMobileClose}
        title={collapsed ? item.label : undefined}
        className={cn(
          'flex items-center gap-3 px-4 py-2.5 transition-all duration-150 relative',
          'font-sans text-[12px] tracking-wide uppercase',
          active
            ? [
                'text-[hsl(var(--sidebar-active-fg))]',
                trustActive
                  ? 'bg-[rgba(136,151,192,0.12)] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[2px] before:bg-[hsl(var(--trust-500))]'
                  : 'bg-[rgba(176,139,130,0.12)] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[2px] before:bg-[hsl(var(--primary))]',
              ]
            : 'text-[hsl(var(--sidebar-foreground))] hover:text-[hsl(var(--sidebar-active-fg))] hover:bg-white/5',
        )}
      >
        <span className="flex-shrink-0">{item.icon}</span>
        {!collapsed && (
          <span className="truncate">{item.label}</span>
        )}
      </Link>
    )
  }

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col h-screen bg-[hsl(var(--sidebar-bg))] transition-all duration-200 z-50 flex-shrink-0',
          collapsed ? 'w-16' : 'w-60',
          'fixed md:static',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
        style={sidebarLight ? {
          '--sidebar-bg': '36 14% 88%',
          '--sidebar-foreground': '30 7% 47%',
          '--sidebar-active-fg': '60 3% 17%',
          '--sidebar-muted': '30 5% 57%',
          '--sidebar-divider': 'hsl(0 0% 0% / 0.09)',
        } as React.CSSProperties : undefined}
      >
        {/* Logo area */}
        <div className="h-16 flex items-center px-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            {firmLogo ? (
              <img
                src={firmLogo}
                alt="Firm logo"
                className="flex-shrink-0 object-contain"
                style={{ height: 32, width: collapsed ? 32 : 'auto', maxWidth: collapsed ? 32 : 120 }}
                onError={() => setFirmLogo(null)}
              />
            ) : (
              <div className="flex-shrink-0 w-8 h-8 rounded flex items-center justify-center bg-[hsl(10_22%_60%_/_0.2)]">
                <span className="font-serif text-[18px] text-[hsl(var(--sidebar-active-fg))] leading-none select-none">
                  D&amp;C
                </span>
              </div>
            )}
            {!collapsed && !firmLogo && (
              <span className="font-sans text-[10px] tracking-widest uppercase text-[hsl(var(--sidebar-muted))]">
                {firmName ?? 'Dolata & Co'}
              </span>
            )}
            {!collapsed && firmLogo && firmName && (
              <span className="font-sans text-[10px] tracking-widest uppercase text-[hsl(var(--sidebar-muted))] truncate">
                {firmName}
              </span>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2">
          {navGroups.map((group) => (
            <div key={group.label} className="border-t sidebar-divider pt-2 mt-1">
              {!collapsed && (
                <p className="font-sans text-[10px] tracking-widest uppercase text-[hsl(var(--sidebar-muted))] px-4 py-1.5">
                  {group.label}
                </p>
              )}
              {group.items.map((item) => (
                <NavItemComponent key={item.href} item={item} />
              ))}
            </div>
          ))}

          {/* Settings — admin only */}
          {isAdmin && (
            <div className="border-t sidebar-divider pt-2 mt-1">
              <NavItemComponent
                item={{
                  label: 'Settings',
                  href: '/settings',
                  icon: <Settings className="h-[18px] w-[18px]" />,
                }}
              />
            </div>
          )}
        </nav>

        {/* User section */}
        <div className="border-t sidebar-divider p-3 space-y-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7 flex-shrink-0">
              <AvatarFallback className="bg-[hsl(10_22%_60%_/_0.2)] text-[hsl(var(--sidebar-active-fg))] text-[10px] font-sans">
                {session?.user?.initials ?? '??'}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="font-sans text-[11px] text-[hsl(var(--sidebar-active-fg))] truncate leading-tight">
                  {session?.user?.name ?? 'User'}
                </p>
                <p className="font-sans text-[10px] text-[hsl(var(--sidebar-muted))] capitalize">
                  {session?.user?.role?.replace('_', ' ') ?? ''}
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Sidebar colour toggle */}
            <button
              onClick={toggleSidebarLight}
              title={sidebarLight ? 'Switch to dark sidebar' : 'Switch to light sidebar'}
              className="p-1.5 rounded text-[hsl(var(--sidebar-foreground))] hover:text-[hsl(var(--sidebar-active-fg))] hover:bg-white/10 transition-colors"
              aria-label="Toggle sidebar colour"
            >
              <Palette className="h-4 w-4" />
            </button>

            {/* Theme toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title="Toggle colour scheme"
              className="p-1.5 rounded text-[hsl(var(--sidebar-foreground))] hover:text-[hsl(var(--sidebar-active-fg))] hover:bg-white/10 transition-colors"
              aria-label="Toggle colour scheme"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>

            {/* Sign out */}
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              title="Sign out"
              className="p-1.5 rounded text-[hsl(var(--sidebar-foreground))] hover:text-[hsl(var(--sidebar-active-fg))] hover:bg-white/10 transition-colors"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={toggleCollapsed}
          className="border-t sidebar-divider p-3 flex items-center justify-end text-[hsl(var(--sidebar-muted))] hover:text-[hsl(var(--sidebar-active-fg))] transition-colors flex-shrink-0"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <span className="font-sans text-[10px] tracking-wide uppercase mr-2">Collapse</span>
              <ChevronLeft className="h-4 w-4" />
            </>
          )}
        </button>
      </aside>
    </>
  )
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-2 rounded text-foreground hover:bg-secondary transition-colors md:hidden"
      aria-label="Open menu"
    >
      <Menu className="h-5 w-5" />
    </button>
  )
}
