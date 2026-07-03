import { Outlet } from 'react-router-dom'
import { FileStack } from 'lucide-react'
import { Toaster } from '@/components/ui/Toast'
import { isMockMode, MOCK_MODE_BANNER_TEXT } from '@/lib/mock'
import { cn } from '@/lib/utils/cn'

interface AuthLayoutProps {
  /** Wider for longer forms like Company Onboarding — defaults to the narrow auth-form width. */
  widthClassName?: string
}

export function AuthLayout({ widthClassName = 'max-w-sm' }: AuthLayoutProps) {
  return (
    <div className="flex min-h-svh flex-col bg-surface">
      {isMockMode && (
        <div className="flex shrink-0 items-center justify-center bg-amber-400/90 px-4 py-1.5 text-center text-xs font-medium text-amber-950">
          {MOCK_MODE_BANNER_TEXT}
        </div>
      )}

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="mb-8 flex items-center gap-2.5">
          <div className="flex size-10 items-center justify-center rounded-xl bg-brand-600 text-white">
            <FileStack className="size-5" aria-hidden="true" />
          </div>
          <span className="text-xl font-semibold text-ink">FinVizer</span>
        </div>

        <div className={cn('w-full rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-8', widthClassName)}>
          <Outlet />
        </div>

        <p className="mt-6 text-center text-xs text-ink-muted">
          ระบบจัดการเอกสารธุรกิจและบัญชีสำหรับธุรกิจไทย
        </p>
      </div>

      <Toaster />
    </div>
  )
}
