import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, Mail, XCircle } from 'lucide-react'
import { acceptInvitation } from '@/lib/supabase/invitations'
import { logAuditEvent } from '@/lib/supabase/auditLog'
import { useAuthStore } from '@/stores/authStore'
import { useCompanyStore } from '@/stores/companyStore'
import { Button } from '@/components/ui/Button'
import { toast } from '@/stores/toastStore'

export function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const authStatus = useAuthStore((state) => state.status)
  const user = useAuthStore((state) => state.user)
  const syncCompanyForUser = useCompanyStore((state) => state.syncForUser)
  const existingCompany = useCompanyStore((state) => state.company)

  const [isAccepting, setIsAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [acceptedCompanyName, setAcceptedCompanyName] = useState<string | null>(null)

  if (!token) {
    return (
      <div className="text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <XCircle className="size-6" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-ink">ลิงก์คำเชิญไม่ถูกต้อง</h1>
      </div>
    )
  }

  const handleAccept = async () => {
    if (!user) return
    setIsAccepting(true)
    setError(null)
    try {
      const company = await acceptInvitation(token, user)
      void logAuditEvent({
        companyId: company.id,
        actorId: user.id,
        action: 'ACCEPT_INVITATION',
        entityType: 'company',
        entityId: company.id,
      })
      await syncCompanyForUser(user.id)
      setAcceptedCompanyName(company.nameTh)
      toast({ title: 'เข้าร่วมบริษัทสำเร็จ', tone: 'success' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsAccepting(false)
    }
  }

  if (acceptedCompanyName) {
    return (
      <div className="text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent-50 text-accent-600">
          <CheckCircle2 className="size-6" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-ink">เข้าร่วมบริษัทสำเร็จ</h1>
        <p className="mt-2 text-sm text-ink-muted">
          คุณได้เข้าร่วม <span className="font-medium text-ink">{acceptedCompanyName}</span> เรียบร้อยแล้ว
        </p>
        <Button className="mt-6 w-full" onClick={() => navigate('/dashboard', { replace: true })}>
          ไปที่แดชบอร์ด
        </Button>
      </div>
    )
  }

  if (existingCompany) {
    return (
      <div className="text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent-50 text-accent-600">
          <CheckCircle2 className="size-6" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-ink">คุณเป็นสมาชิกบริษัทอยู่แล้ว</h1>
        <p className="mt-2 text-sm text-ink-muted">
          บัญชีนี้เป็นสมาชิกของ <span className="font-medium text-ink">{existingCompany.nameTh}</span>{' '}
          อยู่แล้ว — คำเชิญนี้อาจเคยถูกใช้งานไปแล้ว หรือบัญชีนี้เข้าร่วมบริษัทอื่นอยู่
        </p>
        <Button className="mt-6 w-full" onClick={() => navigate('/dashboard', { replace: true })}>
          ไปที่แดชบอร์ด
        </Button>
      </div>
    )
  }

  if (authStatus === 'unauthenticated') {
    const redirectState = { from: { pathname: location.pathname } }
    return (
      <div className="text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Mail className="size-6" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-ink">คำเชิญเข้าร่วมบริษัท</h1>
        <p className="mt-2 text-sm text-ink-muted">
          กรุณาเข้าสู่ระบบหรือสมัครสมาชิกด้วยอีเมลเดียวกับที่ได้รับคำเชิญ เพื่อเข้าร่วมบริษัท
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button asChild>
            <Link to="/login" state={redirectState}>
              เข้าสู่ระบบ
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/register" state={redirectState}>
              สมัครสมาชิก
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <Mail className="size-6" aria-hidden="true" />
      </div>
      <h1 className="mt-4 text-lg font-semibold text-ink">คำเชิญเข้าร่วมบริษัท</h1>
      <p className="mt-2 text-sm text-ink-muted">
        คุณเข้าสู่ระบบด้วยอีเมล <span className="font-medium text-ink">{user?.email}</span>{' '}
        ต้องการเข้าร่วมบริษัทนี้หรือไม่
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      <Button className="mt-6 w-full" onClick={() => void handleAccept()} isLoading={isAccepting}>
        เข้าร่วมบริษัท
      </Button>
    </div>
  )
}
