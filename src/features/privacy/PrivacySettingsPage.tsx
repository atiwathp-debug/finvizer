import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, ShieldCheck, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormField } from '@/components/shared/FormField'
import { useAuthStore } from '@/stores/authStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useHasCompanyRole } from '@/lib/permissions/useHasCompanyRole'
import { deleteAccount, exportAccountData } from '@/lib/supabase/account'
import { logAuditEvent } from '@/lib/supabase/auditLog'
import { downloadJson } from '@/lib/utils/downloadJson'
import { toast } from '@/stores/toastStore'

const DELETE_CONFIRMATION_WORD = 'DELETE'
const DELETE_WARNING =
  'การลบบัญชีนี้จะลบบริษัท เอกสาร ลูกค้า และสิทธิ์การเข้าถึงของผู้ใช้งานร่วมทั้งหมดอย่างถาวร ไม่สามารถกู้คืนได้'

export function PrivacySettingsPage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const signOut = useAuthStore((state) => state.signOut)
  const company = useCompanyStore((state) => state.company)
  const role = useCompanyStore((state) => state.currentUserRole)
  const isOwner = useHasCompanyRole(['OWNER'])

  const [isExporting, setIsExporting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const handleExport = async () => {
    if (!user || !company || !role) return
    setIsExporting(true)
    try {
      const payload = await exportAccountData(user, company, role)
      downloadJson(`finvizer-export-${company.companyCode}-${Date.now()}.json`, payload)
      void logAuditEvent({
        companyId: company.id,
        actorId: user.id,
        action: 'EXPORT_DATA_JSON',
        entityType: 'company',
        entityId: company.id,
      })
      toast({ title: 'ส่งออกข้อมูลสำเร็จ', tone: 'success' })
    } catch (error) {
      toast({
        title: 'ส่งออกข้อมูลไม่สำเร็จ',
        description: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
        tone: 'error',
      })
    } finally {
      setIsExporting(false)
    }
  }

  const closeDeleteDialog = (open: boolean) => {
    setDeleteDialogOpen(open)
    if (!open) setConfirmText('')
  }

  const handleDelete = async () => {
    if (!user || !company) return
    setIsDeleting(true)
    try {
      // Logged client-side (RLS-covered insert, same as every other feature
      // page) while the account still fully exists — the Edge Function
      // logs DELETE_ACCOUNT_COMPLETED itself afterward, since by then this
      // client's own session may no longer be able to write here (see
      // supabase/functions/delete-account/index.ts).
      void logAuditEvent({
        companyId: company.id,
        actorId: user.id,
        action: 'DELETE_ACCOUNT_REQUESTED',
        entityType: 'user',
        entityId: user.id,
      })
      await deleteAccount(user)
    } catch (error) {
      toast({
        title: 'ลบบัญชีไม่สำเร็จ',
        description: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
        tone: 'error',
      })
      setIsDeleting(false)
      return
    }

    // The account no longer exists server-side past this point, so any
    // failure from here on is just best-effort local cleanup — never
    // re-surface it as a deletion failure.
    try {
      await signOut()
    } catch {
      setUser(null)
    }
    navigate('/login', { replace: true })
    toast({ title: 'ลบบัญชีสำเร็จ', description: 'ขอบคุณที่ใช้งาน FinVizer', tone: 'success' })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden="true" />
          <div className="text-sm text-ink-muted">
            <p className="font-medium text-ink">ข้อมูลของคุณถูกเก็บอย่างไร</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>ข้อมูลถูกเก็บบน Supabase โครงสร้างพื้นฐาน AWS ภูมิภาค Singapore (ap-southeast-1)</li>
              <li>การเชื่อมต่อทั้งหมดระหว่างเบราว์เซอร์กับเซิร์ฟเวอร์เข้ารหัสผ่าน HTTPS/TLS</li>
              <li>
                รหัสผ่านไม่ถูกเก็บเป็น plaintext — ใช้ระบบ hash ของ Supabase Auth (หรือจำลองด้วย SHA-256 ต่อบัญชีใน
                Mock Mode)
              </li>
              <li>ไฟล์ PDF ดาวน์โหลดจากเบราว์เซอร์ของคุณโดยตรงเท่านั้น ไม่ได้อัปโหลดขึ้นเซิร์ฟเวอร์เป็นค่าเริ่มต้น</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <p className="font-medium text-ink">ส่งออกข้อมูลทั้งหมด</p>
        <p className="mt-1 text-sm text-ink-muted">
          ดาวน์โหลดข้อมูลโปรไฟล์ บริษัท สมาชิก{isOwner ? ' คำเชิญ' : ''} และประวัติการใช้งานของคุณเป็นไฟล์ JSON
        </p>
        <Button
          variant="secondary"
          className="mt-3"
          onClick={() => void handleExport()}
          isLoading={isExporting}
        >
          <Download className="size-4" aria-hidden="true" />
          Export ข้อมูลเป็น JSON
        </Button>
      </div>

      <div className="rounded-2xl border border-red-200 bg-red-50/40 p-5 sm:p-6">
        <p className="font-medium text-red-700">ลบบัญชีถาวร</p>
        <p className="mt-1 text-sm text-ink-muted">{DELETE_WARNING}</p>
        {!isOwner && (
          <p className="mt-1 text-sm text-ink-muted">
            คุณไม่ใช่เจ้าของบริษัท การลบบัญชีของคุณจะลบเฉพาะบัญชีและสิทธิ์การเข้าถึงของคุณเองเท่านั้น
            บริษัทและข้อมูลของสมาชิกท่านอื่นจะไม่ถูกลบ
          </p>
        )}
        <Button variant="danger" className="mt-3" onClick={() => setDeleteDialogOpen(true)}>
          <Trash2 className="size-4" aria-hidden="true" />
          ลบบัญชีของฉัน
        </Button>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={closeDeleteDialog}>
        <DialogContent>
          <DialogTitle>ยืนยันการลบบัญชี</DialogTitle>
          <DialogDescription>{DELETE_WARNING}</DialogDescription>
          <div className="mt-4">
            <FormField label={`พิมพ์ "${DELETE_CONFIRMATION_WORD}" เพื่อยืนยัน`} htmlFor="delete-confirm-input">
              <Input
                id="delete-confirm-input"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={DELETE_CONFIRMATION_WORD}
                autoComplete="off"
                autoFocus
              />
            </FormField>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => closeDeleteDialog(false)} disabled={isDeleting}>
              ยกเลิก
            </Button>
            <Button
              variant="danger"
              onClick={() => void handleDelete()}
              disabled={confirmText !== DELETE_CONFIRMATION_WORD || isDeleting}
              isLoading={isDeleting}
            >
              ลบบัญชีถาวร
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
