import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, LogOut, User as UserIcon, ChevronDown } from 'lucide-react'
import { CurrentCompanyBadge } from '@/components/shared/CurrentCompanyBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/stores/toastStore'
import { mapAuthErrorMessage } from '@/lib/supabase/authErrors'

export function TopBar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const signOut = useAuthStore((state) => state.signOut)

  const handleLogout = async () => {
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch (error) {
      toast({ title: 'ออกจากระบบไม่สำเร็จ', description: mapAuthErrorMessage(error).message, tone: 'error' })
    }
  }

  return (
    <header className="flex h-16 items-center gap-3 border-b border-line bg-white px-4 sm:px-6">
      <button
        type="button"
        onClick={onOpenMobileNav}
        className="rounded-lg p-2 text-ink-muted hover:bg-surface hover:text-ink md:hidden"
        aria-label="เปิดเมนูนำทาง"
      >
        <Menu className="size-5" />
      </button>

      <div className="min-w-0 flex-1">
        <CurrentCompanyBadge />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex shrink-0 items-center gap-2 rounded-lg p-1.5 outline-none hover:bg-surface">
          <div className="flex size-8 items-center justify-center rounded-full bg-brand-100 text-brand-700">
            <UserIcon className="size-4" aria-hidden="true" />
          </div>
          <span className="hidden text-sm font-medium text-ink sm:inline">
            {user?.displayName ?? 'ผู้ใช้งาน'}
          </span>
          <ChevronDown className="hidden size-4 text-ink-muted sm:inline" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() =>
              toast({ title: 'ยังไม่พร้อมใช้งาน', description: 'หน้าโปรไฟล์จะเปิดใช้งานในเฟสถัดไป' })
            }
          >
            <UserIcon className="size-4" aria-hidden="true" />
            โปรไฟล์ของฉัน
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-red-600 data-[highlighted]:bg-red-50"
            onSelect={() => setLogoutConfirmOpen(true)}
          >
            <LogOut className="size-4" aria-hidden="true" />
            ออกจากระบบ
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={logoutConfirmOpen}
        onOpenChange={setLogoutConfirmOpen}
        title="ออกจากระบบ"
        description="คุณต้องการออกจากระบบใช่หรือไม่"
        confirmLabel="ออกจากระบบ"
        tone="danger"
        onConfirm={handleLogout}
      />
    </header>
  )
}
