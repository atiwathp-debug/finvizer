import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { loginSchema, type LoginFormValues } from '@/lib/validations/auth'
import { signIn, resendConfirmationEmail } from '@/lib/supabase/auth'
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

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const setUser = useAuthStore((state) => state.setUser)
  const [formError, setFormError] = useState<string | null>(null)
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null)
  const [resending, setResending] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (values: LoginFormValues) => {
    setFormError(null)
    setUnconfirmedEmail(null)
    try {
      const user = await signIn(values.email, values.password)
      // RedirectIfAuthed honors the same `from` state (falling back to
      // /dashboard), so it converges on this exact target too — see the
      // comment there for why that matters.
      const state = location.state as LocationState | null
      setUser(user)
      deferNavigate(navigate, state?.from?.pathname ?? '/dashboard')
    } catch (error) {
      const mapped = mapAuthErrorMessage(error)
      setFormError(mapped.message)
      if (mapped.code === 'EMAIL_NOT_CONFIRMED') {
        setUnconfirmedEmail(values.email)
      }
    }
  }

  const handleResend = async () => {
    if (!unconfirmedEmail) return
    setResending(true)
    try {
      await resendConfirmationEmail(unconfirmedEmail)
      toast({ title: 'ส่งอีเมลแล้ว', description: 'กรุณาตรวจสอบกล่องจดหมายของคุณอีกครั้ง', tone: 'success' })
    } catch (error) {
      toast({ title: 'ส่งอีเมลไม่สำเร็จ', description: mapAuthErrorMessage(error).message, tone: 'error' })
    } finally {
      setResending(false)
    }
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-ink">เข้าสู่ระบบ</h1>
      <p className="mt-1 text-sm text-ink-muted">ยินดีต้อนรับกลับเข้าสู่ FinVizer</p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label="อีเมล" htmlFor="login-email" error={errors.email?.message}>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            {...register('email')}
          />
        </FormField>

        <FormField label="รหัสผ่าน" htmlFor="login-password" error={errors.password?.message}>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            {...register('password')}
          />
        </FormField>

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-brand-600 hover:underline">
            ลืมรหัสผ่าน?
          </Link>
        </div>

        {formError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <p>{formError}</p>
            {unconfirmedEmail && (
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="mt-1.5 font-medium underline disabled:opacity-60"
              >
                {resending ? 'กำลังส่ง...' : 'ส่งอีเมลยืนยันอีกครั้ง'}
              </button>
            )}
          </div>
        )}

        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          เข้าสู่ระบบ
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        ยังไม่มีบัญชี?{' '}
        <Link to="/register" className="font-medium text-brand-600 hover:underline">
          สมัครสมาชิก
        </Link>
      </p>
    </div>
  )
}
