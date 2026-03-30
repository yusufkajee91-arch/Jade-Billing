'use client'

import { useState } from 'react'
import type { Session } from 'next-auth'
import { Sidebar, MobileMenuButton } from '@/components/layout/sidebar'
import { FAB } from '@/components/layout/fab'
import { CommandPalette } from '@/components/search/command-palette'
import { TimeRecordingProvider } from '@/components/time-recording/time-recording-provider'
import { FeeEntrySlideOver } from '@/components/time-recording/fee-entry-slide-over'
import { GlobalSearch } from '@/components/search/global-search'

export function AppLayout({
  children,
  session,
}: {
  children: React.ReactNode
  session: Session
}) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <TimeRecordingProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />

        <div className="flex flex-col flex-1 overflow-hidden min-w-0" style={{ position: 'relative' }}>
          {/* Mobile top bar */}
          <div className="flex items-center gap-3 px-4 h-14 border-b border-border bg-card md:hidden flex-shrink-0">
            <MobileMenuButton onClick={() => setMobileOpen(true)} />
            <span className="font-serif text-lg text-foreground">
              Dolata &amp; Co
            </span>
          </div>

          {/* Global search bar — floats above page content */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 40,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: 64,
              pointerEvents: 'none',
            }}
            className="hidden md:flex"
          >
            <div style={{ pointerEvents: 'auto' }}>
              <GlobalSearch />
            </div>
          </div>

          <main className="flex-1 overflow-y-auto app-bg" style={{ paddingTop: '64px', paddingRight: '32px', paddingBottom: '32px', paddingLeft: '32px' }}>
            {children}
          </main>

          {/* Portalled overlays — inside the column div so their Base UI root nodes
              are in a flex-col context and do not steal width from the flex row */}
          <CommandPalette />
          <FeeEntrySlideOver session={session} />
        </div>

        <FAB />
      </div>
    </TimeRecordingProvider>
  )
}
