import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { MobileNavDrawer } from '@/components/layout/MobileNavDrawer'
import { Toaster } from '@/components/ui/Toast'
import { isMockMode, MOCK_MODE_BANNER_TEXT } from '@/lib/mock'

export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="flex min-h-svh flex-col bg-surface">
      {isMockMode && (
        <div className="flex shrink-0 items-center justify-center bg-amber-400/90 px-4 py-1.5 text-center text-xs font-medium text-amber-950">
          {MOCK_MODE_BANNER_TEXT}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 border-r border-line bg-white md:block">
          <Sidebar />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onOpenMobileNav={() => setMobileNavOpen(true)} />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      <MobileNavDrawer open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
      <Toaster />
    </div>
  )
}
