import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { registerSchema, type RegisterFormValues } from '@/lib/validations/auth'
import { signUp, resendConfirmationEmail } from '@/lib/supabase/auth'
import { mapAuthErrorMessage } from '@/lib/supabase/authErrors'
import { useAuthStore } from '@/stores/authStore'
import { deferNavigate } from '@/lib/utils/deferNavigate'
import { FormField } from '@/components/shared/FormField'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { toast } from '@/stores/toastStore'

interface LocationState {
  from?: { pathname: string }
}

export function RegisterPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const setUser = useAuthStore((state) => state.setUser)
  const [formError, setFormError] = useState<string | null>(null)
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<string | null>(null)
  const [resending, setResending] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) })

  const onSubmit = async (values: RegisterFormValues) => {
    setFormError(null)
    try {
      const result = await signUp(values.email, values.password, values.displayName)
      if (result.requiresEmailConfirmation) {
        setPendingConfirmationEmail(values.email)
        return
      }
      // An invite link (/invite/:token) sends unauthenticated users here via
      // `from` state — a newly registered invitee joins someone else's
      // company, so they should land back on the invite page, not onboarding.
      // RedirectIfAuthed honors the same `from` state, so it converges on
      // this exact target too — see the comment there for why that matters.
      const state = location.state as LocationState | null
      setUser(result.user)
      deferNavigate(navigate, state?.from?.pathname ?? '/onboarding/company')
    } catch (error) {
      setFormError(mapAuthErrorMessage(error).message)
    }
  }

  const handleResend = async () => {
    if (!pendingConfirmationEmail) return
    setResending(true)
    try {
      await resendConfirmationEmail(pendingConfirmationEmail)
      toast({ title: 'ส่งอีเมลแล้ว', description: 'กรุณาตรวจสอบกล่องจดหมายของคุณอีกครั้ง', tone: 'success' })
    } catch (error) {
      toast({ title: 'ส่งอีเมลไม่สำเร็จ', description: mapAuthErrorMessage(error).message, tone: 'error' })
    } finally {
      setResending(false)
    }
  }

  if (pendingConfirmationEmail) {
    return (
      <div className="text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <MailCheck className="size-6" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-ink">ยืนยันอีเมลของคุณ</h1>
        <p className="mt-2 text-sm text-ink-muted">
          เราได้ส่งลิงก์ยืนยันไปยัง <span className="font-medium text-ink">{pendingConfirmationEmail}</span>{' '}
          กรุณาตรวจสอบกล่องจดหมายและคลิกลิงก์เพื่อเปิดใช้งานบัญชี
        </p>
        <Button
          variant="secondary"
          className="mt-6 w-full"
          onClick={handleResend}
          isLoading={resending}
        >
          ส่งอีเมลยืนยันอีกครั้ง
        </Button>
        <p className="mt-4 text-sm text-ink-muted">
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-ink">สมัครสมาชิก</h1>
      <p className="mt-1 text-sm text-ink-muted">เริ่มต้นใช้งาน FinVizer สำหรับธุรกิจของคุณ</p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label="ชื่อที่แสดง" htmlFor="register-name" error={errors.displayName?.message}>
          <Input
            id="register-name"
            autoComplete="name"
            placeholder="สมชาย ใจดี"
            {...register('displayName')}
          />
        </FormField>

        <FormField label="อีเมล" htmlFor="register-email" error={errors.email?.message}>
          <Input
            id="register-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            {...register('email')}
          />
        </FormField>

        <FormField label="รหัสผ่าน" htmlFor="register-password" error={errors.password?.message}>
          <Input
            id="register-password"
            type="password"
            autoComplete="new-password"
            placeholder="อย่างน้อย 8 ตัวอักษร"
            {...register('password')}
          />
        </FormField>

        <FormField
          label="ยืนยันรหัสผ่าน"
          htmlFor="register-confirm-password"
          error={errors.confirmPassword?.message}
        >
          <Input
            id="register-confirm-password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            {...register('confirmPassword')}
          />
        </FormField>

        {formError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {formError}
          </div>
        )}

        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          สมัครสมาชิก
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        มีบัญชีอยู่แล้ว?{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:underline">
          เข้าสู่ระบบ
        </Link>
      </p>
    </div>
  )
}
