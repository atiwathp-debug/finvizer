import { NavLink, Outlet } from 'react-router-dom'
import { PageHeader } from '@/components/shared/PageHeader'
import { cn } from '@/lib/utils/cn'

const settingsNav = [
  { label: 'ข้อมูลบริษัท', to: '/settings/company' },
  { label: 'สมาชิก', to: '/settings/members' },
  { label: 'Template เอกสาร', to: '/settings/templates' },
  { label: 'ลายเซ็นเอกสาร', to: '/settings/signatures' },
  { label: 'เลขที่เอกสาร', to: '/settings/numbering' },
  { label: 'ความเป็นส่วนตัว', to: '/settings/privacy' },
  { label: 'ประวัติการใช้งาน', to: '/settings/audit-logs' },
]

export function SettingsLayout() {
  return (
    <div className="space-y-6">
      <PageHeader title="ตั้งค่า" description="จัดการข้อมูลบริษัท สมาชิก และการตั้งค่าระบบ" />

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <nav className="flex w-max gap-1 border-b border-line sm:w-full">
          {settingsNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-brand-600 text-brand-700'
                    : 'border-transparent text-ink-muted hover:text-ink',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <Outlet />
    </div>
  )
}
