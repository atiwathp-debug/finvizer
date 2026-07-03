import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { companyOnboardingSchema, type CompanyOnboardingFormValues } from '@/lib/validations/company'
import { createCompany } from '@/lib/supabase/company'
import { logAuditEvent } from '@/lib/supabase/auditLog'
import { useAuthStore } from '@/stores/authStore'
import { useCompanyStore } from '@/stores/companyStore'
import { deferNavigate } from '@/lib/utils/deferNavigate'
import { FormField } from '@/components/shared/FormField'
import { LogoUploadPlaceholder } from '@/components/shared/LogoUploadPlaceholder'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { toast } from '@/stores/toastStore'

export function CompanyOnboardingPage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const setCompanyAndRole = useCompanyStore((state) => state.setCompanyAndRole)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CompanyOnboardingFormValues>({ resolver: zodResolver(companyOnboardingSchema) })

  const onSubmit = async (values: CompanyOnboardingFormValues) => {
    if (!user) return
    setFormError(null)
    try {
      const company = await createCompany(user.id, values)
      // Update the store before navigating: RequireNoCompany also reacts to
      // this status change and would otherwise race an explicit navigate()
      // to /dashboard instead of /onboarding/template — see deferNavigate.
      setCompanyAndRole(company, 'OWNER')
      void logAuditEvent({
        companyId: company.id,
        actorId: user.id,
        action: 'CREATE_COMPANY',
        entityType: 'company',
        entityId: company.id,
      })
      toast({ title: 'สร้างบริษัทสำเร็จ', tone: 'success' })
      deferNavigate(navigate, '/onboarding/template')
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    }
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-ink">ตั้งค่าบริษัท</h1>
      <p className="mt-1 text-sm text-ink-muted">
        กรอกข้อมูลบริษัทของคุณเพื่อเริ่มต้นใช้งาน FinVizer — สามารถแก้ไขได้ภายหลังใน Settings
      </p>

      <form className="mt-6 space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
        <LogoUploadPlaceholder />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="ชื่อบริษัท (ไทย)" htmlFor="onboard-name-th" error={errors.nameTh?.message}>
            <Input id="onboard-name-th" placeholder="บริษัท เดโม เทรดดิ้ง จำกัด" {...register('nameTh')} />
          </FormField>

          <FormField label="ชื่อบริษัท (อังกฤษ)" htmlFor="onboard-name-en" error={errors.nameEn?.message}>
            <Input id="onboard-name-en" placeholder="Demo Trading Co., Ltd." {...register('nameEn')} />
          </FormField>

          <FormField label="รหัสบริษัท" htmlFor="onboard-code" error={errors.companyCode?.message}>
            <Input id="onboard-code" placeholder="DEMO" {...register('companyCode')} />
          </FormField>

          <FormField label="เลขประจำตัวผู้เสียภาษี" htmlFor="onboard-tax-id" error={errors.taxId?.message}>
            <Input id="onboard-tax-id" placeholder="0105561000001" {...register('taxId')} />
          </FormField>

          <FormField label="สาขา" htmlFor="onboard-branch">
            <Input id="onboard-branch" value="HQ - สำนักงานใหญ่" disabled readOnly />
          </FormField>

          <FormField label="เบอร์โทร" htmlFor="onboard-phone" error={errors.phone?.message}>
            <Input id="onboard-phone" placeholder="02-123-4567" {...register('phone')} />
          </FormField>

          <FormField label="อีเมลบริษัท" htmlFor="onboard-email" error={errors.email?.message}>
            <Input id="onboard-email" type="email" placeholder="contact@company.com" {...register('email')} />
          </FormField>

          <FormField label="ผู้ติดต่อ" htmlFor="onboard-contact" error={errors.contactName?.message}>
            <Input id="onboard-contact" placeholder="สมชาย ใจดี" {...register('contactName')} />
          </FormField>

          <div className="sm:col-span-2">
            <FormField label="ที่อยู่" htmlFor="onboard-address" error={errors.address?.message}>
              <Input id="onboard-address" placeholder="99/9 ถนนสุขุมวิท กรุงเทพมหานคร" {...register('address')} />
            </FormField>
          </div>
        </div>

        {formError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {formError}
          </div>
        )}

        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          บันทึกและดำเนินการต่อ
        </Button>
      </form>
    </div>
  )
}
