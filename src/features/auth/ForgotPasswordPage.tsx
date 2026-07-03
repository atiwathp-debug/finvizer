import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '@/lib/validations/auth'
import { requestPasswordReset } from '@/lib/supabase/auth'
import { mapAuthErrorMessage } from '@/lib/supabase/authErrors'
import { FormField } from '@/components/shared/FormField'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export function ForgotPasswordPage() {
  const [formError, setFormError] = useState<string | null>(null)
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({ resolver: zodResolver(forgotPasswordSchema) })

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    setFormError(null)
    try {
      await requestPasswordReset(values.email)
      // Always show success regardless of whether the account exists —
      // avoids leaking which emails are registered.
      setSubmittedEmail(values.email)
    } catch (error) {
      setFormError(mapAuthErrorMessage(error).message)
    }
  }

  if (submittedEmail) {
    return (
      <div className="text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <MailCheck className="size-6" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-ink">ตรวจสอบอีเมลของคุณ</h1>
        <p className="mt-2 text-sm text-ink-muted">
          ถ้าอีเมล <span className="font-medium text-ink">{submittedEmail}</span> มีอยู่ในระบบ
          เราได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้แล้ว
        </p>
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
      <h1 className="text-lg font-semibold text-ink">ลืมรหัสผ่าน</h1>
      <p className="mt-1 text-sm text-ink-muted">
        กรอกอีเมลที่ใช้สมัครสมาชิก เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้คุณ
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label="อีเมล" htmlFor="forgot-email" error={errors.email?.message}>
          <Input
            id="forgot-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            {...register('email')}
          />
        </FormField>

        {formError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {formError}
          </div>
        )}

        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          ส่งลิงก์รีเซ็ตรหัสผ่าน
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        <Link to="/login" className="font-medium text-brand-600 hover:underline">
          กลับไปหน้าเข้าสู่ระบบ
        </Link>
      </p>
    </div>
  )
}
