import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { companySettingsSchema, type CompanySettingsFormValues } from '@/lib/validations/company'
import {
  LOGO_MAX_BYTES_MOCK,
  removeCompanyLogo,
  updateCompany,
  updateCompanyLogoLayout,
  uploadCompanyLogo,
} from '@/lib/supabase/company'
import { updateMockCompanyLogo, updateMockCompanyLogoLayout } from '@/lib/mock/mockCompany'
import { logAuditEvent } from '@/lib/supabase/auditLog'
import { useAuthStore } from '@/stores/authStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useHasCompanyRole } from '@/lib/permissions/useHasCompanyRole'
import { isMockMode } from '@/lib/mock'
import { FormField } from '@/components/shared/FormField'
import { LogoUploadField } from '@/components/shared/LogoUploadField'
import { CompanyLogo } from '@/components/shared/CompanyLogo'
import { PhaseNotice } from '@/components/shared/PhaseNotice'
import { ErrorState } from '@/components/shared/ErrorState'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { toast } from '@/stores/toastStore'
import {
  LOGO_POSITION_OPTIONS,
  LOGO_SIZE_DEFAULT,
  LOGO_SIZE_MAX,
  LOGO_SIZE_MIN,
  logoPositionDescriptions,
  logoPositionLabels,
  type LogoPosition,
} from '@/types/logoLayout'

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
  const [logoSize, setLogoSize] = useState(company?.logoSize ?? LOGO_SIZE_DEFAULT)
  const [logoPosition, setLogoPosition] = useState<LogoPosition>(company?.logoPosition ?? 'left_of_company_name')
  const [isSavingLogoLayout, setIsSavingLogoLayout] = useState(false)

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

  // Resyncs whenever the store's own values change — on first load, and
  // right after this page's own save below updates the store — same
  // "values" resync idea as react-hook-form's `values:` option above,
  // just for this plain-useState section instead of an RHF-managed field.
  useEffect(() => {
    if (!company) return
    setLogoSize(company.logoSize)
    setLogoPosition(company.logoPosition)
  }, [company])

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

  const isLogoLayoutDirty = logoSize !== company.logoSize || logoPosition !== company.logoPosition

  const handleSaveLogoLayout = async () => {
    setIsSavingLogoLayout(true)
    try {
      const input = { logoSize, logoPosition }
      const updated = isMockMode
        ? updateMockCompanyLogoLayout(company.id, input)
        : await updateCompanyLogoLayout(company.id, input)
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
      toast({ title: 'บันทึกการจัดวางโลโก้สำเร็จ', tone: 'success' })
    } catch (error) {
      toast({
        title: 'บันทึกการจัดวางโลโก้ไม่สำเร็จ',
        description: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
        tone: 'error',
      })
    } finally {
      setIsSavingLogoLayout(false)
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

      <div className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <p className="font-medium text-ink">การจัดวางโลโก้ในเอกสาร</p>
        <p className="mt-1 text-sm text-ink-muted">
          กำหนดขนาดและตำแหน่งโลโก้ที่จะแสดงในหัวเอกสาร (ตัวอย่าง เอกสาร PDF) — ใช้ร่วมกันทั้ง 3 Template
        </p>

        <fieldset disabled={!isOwner} className="mt-5 space-y-6">
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="logo-size" className="text-sm font-medium text-ink">
                ขนาดโลโก้
              </label>
              <span className="text-sm text-ink-muted">{logoSize}px</span>
            </div>
            <input
              id="logo-size"
              type="range"
              min={LOGO_SIZE_MIN}
              max={LOGO_SIZE_MAX}
              step={4}
              value={logoSize}
              onChange={(e) => setLogoSize(Number(e.target.value))}
              className="mt-2 w-full accent-brand-600 disabled:opacity-50"
            />
            <div className="mt-1 flex justify-between text-xs text-ink-muted">
              <span>{LOGO_SIZE_MIN}px</span>
              <span>{LOGO_SIZE_MAX}px</span>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-ink">ตำแหน่งโลโก้</p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {LOGO_POSITION_OPTIONS.map((position) => (
                <label
                  key={position}
                  className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm transition-colors ${
                    logoPosition === position
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-line hover:bg-surface'
                  } ${!isOwner ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  <input
                    type="radio"
                    name="logo-position"
                    value={position}
                    checked={logoPosition === position}
                    onChange={() => setLogoPosition(position)}
                    disabled={!isOwner}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block font-medium text-ink">{logoPositionLabels[position]}</span>
                    <span className="block text-xs text-ink-muted">{logoPositionDescriptions[position]}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {company.logoUrl && (
            <div>
              <p className="text-sm font-medium text-ink">ตัวอย่าง</p>
              <div className="mt-2 rounded-lg border border-line bg-surface p-4">
                {logoPosition === 'centered_logo_above_company' ? (
                  <div className="flex flex-col items-center gap-1 text-center">
                    <CompanyLogo logoUrl={company.logoUrl} size={logoSize} />
                    <span className="text-sm font-medium text-ink">{company.nameTh}</span>
                    {company.address && <span className="text-xs text-ink-muted">{company.address}</span>}
                    <span className="text-xs text-ink-muted">เลขประจำตัวผู้เสียภาษี {company.taxId}</span>
                    {company.phone && <span className="text-xs text-ink-muted">โทร {company.phone}</span>}
                  </div>
                ) : (
                  <div
                    className={`flex items-center gap-3 ${
                      logoPosition === 'header_center'
                        ? 'justify-center'
                        : logoPosition === 'header_right'
                          ? 'flex-row-reverse justify-end'
                          : 'justify-start'
                    }`}
                  >
                    <CompanyLogo logoUrl={company.logoUrl} size={logoSize} />
                    <span className="text-sm font-medium text-ink">{company.nameTh}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </fieldset>

        {isOwner && (
          <div className="mt-6 flex justify-end">
            <Button
              type="button"
              isLoading={isSavingLogoLayout}
              disabled={!isLogoLayoutDirty}
              onClick={() => void handleSaveLogoLayout()}
            >
              บันทึกการจัดวางโลโก้
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
