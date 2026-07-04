import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { companySettingsSchema, type CompanySettingsFormValues } from '@/lib/validations/company'
import {
  LOGO_MAX_BYTES_MOCK,
  removeCompanyLogo,
  updateCompany,
  uploadCompanyLogo,
} from '@/lib/supabase/company'
import { updateMockCompanyLogo } from '@/lib/mock/mockCompany'
import { logAuditEvent } from '@/lib/supabase/auditLog'
import { useAuthStore } from '@/stores/authStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useHasCompanyRole } from '@/lib/permissions/useHasCompanyRole'
import { isMockMode } from '@/lib/mock'
import { FormField } from '@/components/shared/FormField'
import { LogoUploadField } from '@/components/shared/LogoUploadField'
import { PhaseNotice } from '@/components/shared/PhaseNotice'
import { ErrorState } from '@/components/shared/ErrorState'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { toast } from '@/stores/toastStore'

/** Reads a File as a data: URL — used only for Mock Mode's logo storage (no Supabase Storage equivalent there). */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('อ่านไฟล์ไม่สำเร็จ'))
    reader.readAsDataURL(file)
  })
}

export function CompanySettingsPage() {
  const company = useCompanyStore((state) => state.company)
  const setCompany = useCompanyStore((state) => state.setCompany)
  const user = useAuthStore((state) => state.user)
  const isOwner = useHasCompanyRole(['OWNER'])
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CompanySettingsFormValues>({
    resolver: zodResolver(companySettingsSchema),
    values: company
      ? {
          nameTh: company.nameTh,
          nameEn: company.nameEn ?? '',
          taxId: company.taxId,
          address: company.address ?? '',
          phone: company.phone ?? '',
          email: company.email ?? '',
          contactName: company.contactName ?? '',
        }
      : undefined,
  })

  if (!company) {
    return <ErrorState title="ไม่พบข้อมูลบริษัท" onRetry={() => window.location.reload()} />
  }

  const handleLogoUpload = async (file: File) => {
    if (isMockMode && file.size > LOGO_MAX_BYTES_MOCK) {
      toast({ title: 'ไฟล์มีขนาดใหญ่เกินไป', description: 'ขนาดไม่เกิน 500KB ในโหมด Mock', tone: 'error' })
      return
    }
    setIsUploadingLogo(true)
    try {
      const updated = isMockMode
        ? updateMockCompanyLogo(company.id, await readFileAsDataUrl(file))
        : { ...company, logoUrl: await uploadCompanyLogo(company.id, file) }
      setCompany(updated)
      if (user) {
        void logAuditEvent({
          companyId: updated.id,
          actorId: user.id,
          action: 'UPDATE_COMPANY',
          entityType: 'company',
          entityId: updated.id,
        })
      }
      toast({ title: 'อัปโหลดโลโก้สำเร็จ', tone: 'success' })
    } catch (error) {
      toast({
        title: 'อัปโหลดโลโก้ไม่สำเร็จ',
        description: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
        tone: 'error',
      })
    } finally {
      setIsUploadingLogo(false)
    }
  }

  const handleLogoRemove = async () => {
    setIsUploadingLogo(true)
    try {
      const updated = isMockMode ? updateMockCompanyLogo(company.id, null) : await removeCompanyLogo(company.id)
      setCompany(updated)
      if (user) {
        void logAuditEvent({
          companyId: updated.id,
          actorId: user.id,
          action: 'UPDATE_COMPANY',
          entityType: 'company',
          entityId: updated.id,
        })
      }
      toast({ title: 'ลบโลโก้สำเร็จ', tone: 'success' })
    } catch (error) {
      toast({
        title: 'ลบโลโก้ไม่สำเร็จ',
        description: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
        tone: 'error',
      })
    } finally {
      setIsUploadingLogo(false)
    }
  }

  const onSubmit = async (values: CompanySettingsFormValues) => {
    try {
      const updated = await updateCompany(company.id, values)
      setCompany(updated)
      if (user) {
        void logAuditEvent({
          companyId: updated.id,
          actorId: user.id,
          action: 'UPDATE_COMPANY',
          entityType: 'company',
          entityId: updated.id,
        })
      }
      toast({ title: 'บันทึกข้อมูลบริษัทสำเร็จ', tone: 'success' })
    } catch (error) {
      toast({
        title: 'บันทึกไม่สำเร็จ',
        description: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
        tone: 'error',
      })
    }
  }

  return (
    <div className="space-y-4">
      {!isOwner && (
        <PhaseNotice>คุณมีสิทธิ์ดูข้อมูลบริษัทเท่านั้น — เฉพาะเจ้าของบริษัทที่แก้ไขได้</PhaseNotice>
      )}
      {isOwner && isMockMode && (
        <PhaseNotice>ข้อมูลนี้บันทึกในเบราว์เซอร์ของคุณเท่านั้น (Mock Mode)</PhaseNotice>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-2xl border border-line bg-white p-5 sm:p-6"
        noValidate
      >
        <LogoUploadField
          logoUrl={company.logoUrl}
          disabled={!isOwner}
          isUploading={isUploadingLogo}
          onUpload={(file) => void handleLogoUpload(file)}
          onRemove={() => void handleLogoRemove()}
        />

        <fieldset disabled={!isOwner} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="ชื่อบริษัท (ไทย)" htmlFor="settings-name-th" error={errors.nameTh?.message}>
            <Input id="settings-name-th" {...register('nameTh')} />
          </FormField>

          <FormField label="ชื่อบริษัท (อังกฤษ)" htmlFor="settings-name-en" error={errors.nameEn?.message}>
            <Input id="settings-name-en" {...register('nameEn')} />
          </FormField>

          <FormField label="รหัสบริษัท" htmlFor="settings-code">
            <Input id="settings-code" value={company.companyCode} disabled readOnly />
          </FormField>

          <FormField label="เลขประจำตัวผู้เสียภาษี" htmlFor="settings-tax-id" error={errors.taxId?.message}>
            <Input id="settings-tax-id" {...register('taxId')} />
          </FormField>

          <FormField label="สาขา" htmlFor="settings-branch">
            <Input
              id="settings-branch"
              value={`${company.branchCode} - ${company.branchName}`}
              disabled
              readOnly
            />
          </FormField>

          <FormField label="เบอร์โทร" htmlFor="settings-phone" error={errors.phone?.message}>
            <Input id="settings-phone" {...register('phone')} />
          </FormField>

          <FormField label="อีเมลบริษัท" htmlFor="settings-email" error={errors.email?.message}>
            <Input id="settings-email" type="email" {...register('email')} />
          </FormField>

          <FormField label="ผู้ติดต่อ" htmlFor="settings-contact" error={errors.contactName?.message}>
            <Input id="settings-contact" {...register('contactName')} />
          </FormField>

          <div className="sm:col-span-2">
            <FormField label="ที่อยู่" htmlFor="settings-address" error={errors.address?.message}>
              <Input id="settings-address" {...register('address')} />
            </FormField>
          </div>
        </fieldset>

        {isOwner && (
          <div className="mt-6 flex justify-end">
            <Button type="submit" isLoading={isSubmitting} disabled={!isDirty}>
              บันทึกการเปลี่ยนแปลง
            </Button>
          </div>
        )}
      </form>
    </div>
  )
}
