import { LayoutDashboard, FileText, Users, Settings } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
}

export const navItems: NavItem[] = [
  { label: 'แดชบอร์ด', to: '/dashboard', icon: LayoutDashboard },
  { label: 'เอกสาร', to: '/documents', icon: FileText },
  { label: 'ลูกค้า', to: '/customers', icon: Users },
  { label: 'ตั้งค่า', to: '/settings/company', icon: Settings },
]
