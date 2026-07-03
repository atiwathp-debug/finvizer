import { NavLink } from 'react-router-dom'
import { FileStack } from 'lucide-react'
import { navItems } from '@/components/layout/navigation'
import { cn } from '@/lib/utils/cn'

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-brand-600 text-white">
          <FileStack className="size-5" aria-hidden="true" />
        </div>
        <span className="text-lg font-semibold text-ink">FinVizer</span>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-ink-muted hover:bg-surface hover:text-ink',
              )
            }
          >
            <item.icon className="size-5" aria-hidden="true" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-line px-5 py-4 text-xs text-ink-muted">
        แพ็กเกจปัจจุบันรองรับ 1 บริษัท และผู้ใช้งานร่วมสูงสุด 2 อีเมล
      </div>
    </div>
  )
}
