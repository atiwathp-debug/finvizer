import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, XCircle } from 'lucide-react'
import { resetPasswordSchema, type ResetPasswordFormValues } from '@/lib/validations/auth'
import { updatePassword } from '@/lib/supabase/auth'
import { mapAuthErrorMessage } from '@/lib/supabase/authErrors'
import { consumePendingMockReset } from '@/lib/mock/mockAuth'
import { isMockMode } from '@/lib/mock'
import { FormField } from '@/components/shared/FormField'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Mock Mode has no real token exchange — the target email was handed off
  // by ForgotPasswordPage via sessionStorage. If it's missing, this link
  // wasn't reached through the forgot-password flow, so treat it the same
  // as an invalid/expired real link. Captured once on mount (lazy useState
  // initializer): a successful reset clears that sessionStorage key, and
  // re-reading it on every render would make the post-success re-render
  // see it as "gone" and show the invalid-link screen instead of success.
  const [mockEmail] = useState<string | null>(() =>
    isMockMode ? consumePendingMockReset() : null,
  )
  const invalidMockLink = isMockMode && !mockEmail

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({ resolver: zodResolver(resetPasswordSchema) })

  const onSubmit = async (values: ResetPasswordFormValues) => {
    setFormError(null)
    try {
      await updatePassword(values.password, mockEmail)
      setSuccess(true)
    } catch (error) {
      setFormError(mapAuthErrorMessage(error).message)
    }
  }

  if (invalidMockLink) {
    return (
      <div className="text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <XCircle className="size-6" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-ink">ลิงก์ไม่ถูกต้องหรือหมดอายุ</h1>
        <p className="mt-2 text-sm text-ink-muted">กรุณาขอลิงก์รีเซ็ตรหัสผ่านใหม่อีกครั้ง</p>
        <Button asChild className="mt-6 w-full">
          <Link to="/forgot-password">ขอลิงก์ใหม่</Link>
        </Button>
      </div>
    )
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent-50 text-accent-600">
          <CheckCircle2 className="size-6" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-ink">ตั้งรหัสผ่านใหม่สำเร็จ</h1>
        <p className="mt-2 text-sm text-ink-muted">คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้ทันที</p>
        <Button className="mt-6 w-full" onClick={() => navigate('/login', { replace: true })}>
          ไปหน้าเข้าสู่ระบบ
        </Button>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-ink">ตั้งรหัสผ่านใหม่</h1>
      <p className="mt-1 text-sm text-ink-muted">กรอกรหัสผ่านใหม่สำหรับบัญชีของคุณ</p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label="รหัสผ่านใหม่" htmlFor="reset-password" error={errors.password?.message}>
          <Input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            placeholder="อย่างน้อย 8 ตัวอักษร"
            {...register('password')}
          />
        </FormField>

        <FormField
          label="ยืนยันรหัสผ่านใหม่"
          htmlFor="reset-confirm-password"
          error={errors.confirmPassword?.message}
        >
          <Input
            id="reset-confirm-password"
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
          ตั้งรหัสผ่านใหม่
        </Button>
      </form>
    </div>
  )
}
