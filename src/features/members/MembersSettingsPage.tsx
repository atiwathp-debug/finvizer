import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Copy, Trash2, UserPlus, XCircle } from 'lucide-react'
import { inviteMemberSchema, type InviteMemberFormValues } from '@/lib/validations/invitation'
import {
  getCompanyMembers,
  removeMember as removeMemberApi,
  updateMemberRole,
} from '@/lib/supabase/members'
import {
  cancelInvitation,
  createInvitation,
  listInvitations,
  type CreateInvitationResult,
} from '@/lib/supabase/invitations'
import { logAuditEvent } from '@/lib/supabase/auditLog'
import { useAuthStore } from '@/stores/authStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useHasCompanyRole } from '@/lib/permissions/useHasCompanyRole'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { FormField } from '@/components/shared/FormField'
import { TableSkeleton } from '@/components/shared/LoadingSkeleton'
import { ErrorState } from '@/components/shared/ErrorState'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/Dialog'
import { toast } from '@/stores/toastStore'
import { assignableMemberRoles, memberStatusLabels, roleLabels, type Member } from '@/types/member'
import { invitationStatusLabels, type Invitation } from '@/types/invitation'
import { formatThaiDate } from '@/lib/utils/currency'

const MAX_INVITED_EMAILS = 2

export function MembersSettingsPage() {
  const company = useCompanyStore((state) => state.company)
  const user = useAuthStore((state) => state.user)
  const isOwner = useHasCompanyRole(['OWNER'])

  const [members, setMembers] = useState<Member[] | null>(null)
  const [invitations, setInvitations] = useState<Invitation[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteResult, setInviteResult] = useState<CreateInvitationResult | null>(null)
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Invitation | null>(null)

  const load = useCallback(async () => {
    if (!company) return
    setLoadError(null)
    try {
      const [memberList, invitationList] = await Promise.all([
        getCompanyMembers(company.id),
        isOwner ? listInvitations(company.id) : Promise.resolve([]),
      ])
      setMembers(memberList)
      setInvitations(invitationList)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    }
  }, [company, isOwner])

  useEffect(() => {
    void load()
  }, [load])

  const {
    register,
    handleSubmit,
    reset: resetInviteForm,
    formState: { errors, isSubmitting },
  } = useForm<InviteMemberFormValues>({ resolver: zodResolver(inviteMemberSchema) })

  const pendingInvitations = invitations?.filter((i) => i.status === 'PENDING') ?? []
  const activeNonOwnerCount = members?.filter((m) => m.role !== 'OWNER').length ?? 0
  const remainingSlots = Math.max(
    0,
    MAX_INVITED_EMAILS - activeNonOwnerCount - pendingInvitations.length,
  )

  const onInviteSubmit = async (values: InviteMemberFormValues) => {
    if (!company || !user) return
    try {
      const result = await createInvitation(company.id, values.email, values.role, user.id)
      void logAuditEvent({
        companyId: company.id,
        actorId: user.id,
        action: 'INVITE_MEMBER',
        entityType: 'invitation',
        entityId: result.invitation.id,
        metadata: { invitedEmail: values.email, invitedRole: values.role },
      })
      setInviteDialogOpen(false)
      resetInviteForm()
      setInviteResult(result)
      await load()
    } catch (error) {
      toast({
        title: 'เชิญสมาชิกไม่สำเร็จ',
        description: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
        tone: 'error',
      })
    }
  }

  const handleCopyInviteLink = async () => {
    if (!inviteResult) return
    try {
      await navigator.clipboard.writeText(inviteResult.inviteUrl)
      toast({ title: 'คัดลอกลิงก์แล้ว', tone: 'success' })
    } catch {
      toast({ title: 'คัดลอกไม่สำเร็จ', description: 'กรุณาคัดลอกลิงก์ด้วยตนเอง', tone: 'error' })
    }
  }

  const handleRoleChange = async (member: Member, role: (typeof assignableMemberRoles)[number]) => {
    if (!company || !user || role === member.role) return
    try {
      await updateMemberRole(member.id, role)
      void logAuditEvent({
        companyId: company.id,
        actorId: user.id,
        action: 'CHANGE_ROLE',
        entityType: 'company_member',
        entityId: member.id,
        metadata: { userId: member.userId, from: member.role, to: role },
      })
      toast({ title: 'เปลี่ยนสิทธิ์การใช้งานสำเร็จ', tone: 'success' })
      await load()
    } catch (error) {
      toast({
        title: 'เปลี่ยนสิทธิ์ไม่สำเร็จ',
        description: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
        tone: 'error',
      })
    }
  }

  const handleRemoveConfirm = async () => {
    if (!company || !user || !removeTarget) return
    try {
      await removeMemberApi(removeTarget.id)
      void logAuditEvent({
        companyId: company.id,
        actorId: user.id,
        action: 'REMOVE_MEMBER',
        entityType: 'company_member',
        entityId: removeTarget.id,
        metadata: { userId: removeTarget.userId },
      })
      toast({ title: 'ลบสมาชิกสำเร็จ', tone: 'success' })
      await load()
    } catch (error) {
      toast({
        title: 'ลบสมาชิกไม่สำเร็จ',
        description: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
        tone: 'error',
      })
    }
  }

  const handleCancelInviteConfirm = async () => {
    if (!company || !user || !cancelTarget) return
    try {
      await cancelInvitation(cancelTarget.id)
      void logAuditEvent({
        companyId: company.id,
        actorId: user.id,
        action: 'CANCEL_INVITATION',
        entityType: 'invitation',
        entityId: cancelTarget.id,
        metadata: { invitedEmail: cancelTarget.invitedEmail },
      })
      toast({ title: 'ยกเลิกคำเชิญสำเร็จ', tone: 'success' })
      await load()
    } catch (error) {
      toast({
        title: 'ยกเลิกคำเชิญไม่สำเร็จ',
        description: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
        tone: 'error',
      })
    }
  }

  if (!company) return null

  if (loadError) {
    return <ErrorState description={loadError} onRetry={() => void load()} />
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-white">
        <div className="flex flex-col gap-3 border-b border-line p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-ink">สมาชิกในบริษัท</p>
            <p className="mt-0.5 text-xs text-ink-muted">
              แพ็กเกจปัจจุบันรองรับ 1 เจ้าของบริษัท และผู้ใช้งานร่วมสูงสุด {MAX_INVITED_EMAILS} อีเมล
              (เหลือ {remainingSlots} ที่ว่าง) หากต้องการเพิ่มผู้ใช้งานเกินกว่านี้ จะเปิดให้ใช้งานในแผนชำระเงินในอนาคต
            </p>
          </div>
          {isOwner && (
            <Button size="sm" onClick={() => setInviteDialogOpen(true)} disabled={remainingSlots === 0}>
              <UserPlus className="size-4" aria-hidden="true" />
              เชิญสมาชิก
            </Button>
          )}
        </div>

        {members === null ? (
          <div className="p-4">
            <TableSkeleton rows={3} />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {members.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-medium text-ink">{member.displayName}</p>
                  <p className="text-xs text-ink-muted">{member.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {isOwner && member.role !== 'OWNER' ? (
                    <Select
                      value={member.role}
                      onChange={(e) =>
                        void handleRoleChange(
                          member,
                          e.target.value as (typeof assignableMemberRoles)[number],
                        )
                      }
                      aria-label={`เปลี่ยนสิทธิ์ของ ${member.displayName}`}
                      className="h-8 w-auto min-w-32 text-xs"
                    >
                      {assignableMemberRoles.map((role) => (
                        <option key={role} value={role}>
                          {roleLabels[role]}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <RoleBadge role={member.role} />
                  )}
                  <Badge tone={member.status === 'ACTIVE' ? 'success' : 'warning'}>
                    {memberStatusLabels[member.status]}
                  </Badge>
                  {isOwner && member.role !== 'OWNER' && (
                    <button
                      type="button"
                      onClick={() => setRemoveTarget(member)}
                      className="rounded-lg p-1.5 text-ink-muted hover:bg-red-50 hover:text-red-600"
                      aria-label={`ลบ ${member.displayName}`}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {isOwner && (invitations === null || pendingInvitations.length > 0) && (
        <div className="rounded-2xl border border-line bg-white">
          <div className="border-b border-line p-5">
            <p className="text-sm font-medium text-ink">คำเชิญที่รอตอบรับ</p>
          </div>
          {invitations === null ? (
            <div className="p-4">
              <TableSkeleton rows={1} />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {pendingInvitations.map((invitation) => (
                <li
                  key={invitation.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div>
                    <p className="text-sm font-medium text-ink">{invitation.invitedEmail}</p>
                    <p className="text-xs text-ink-muted">
                      หมดอายุ {formatThaiDate(invitation.expiresAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <RoleBadge role={invitation.invitedRole} />
                    <Badge tone="warning">{invitationStatusLabels[invitation.status]}</Badge>
                    <button
                      type="button"
                      onClick={() => setCancelTarget(invitation)}
                      className="rounded-lg p-1.5 text-ink-muted hover:bg-red-50 hover:text-red-600"
                      aria-label={`ยกเลิกคำเชิญ ${invitation.invitedEmail}`}
                    >
                      <XCircle className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Invite form */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogTitle>เชิญสมาชิกใหม่</DialogTitle>
          <DialogDescription>กรอกอีเมลและสิทธิ์การใช้งานที่ต้องการเชิญ</DialogDescription>
          <form className="mt-4 space-y-4" onSubmit={handleSubmit(onInviteSubmit)} noValidate>
            <FormField label="อีเมล" htmlFor="invite-email" error={errors.email?.message}>
              <Input id="invite-email" type="email" placeholder="you@company.com" {...register('email')} />
            </FormField>
            <FormField label="สิทธิ์การใช้งาน" htmlFor="invite-role" error={errors.role?.message}>
              <Select id="invite-role" defaultValue="" {...register('role')}>
                <option value="" disabled>
                  เลือกสิทธิ์การใช้งาน
                </option>
                {assignableMemberRoles.map((role) => (
                  <option key={role} value={role}>
                    {roleLabels[role]}
                  </option>
                ))}
              </Select>
            </FormField>
            <Button type="submit" className="w-full" isLoading={isSubmitting}>
              ส่งคำเชิญ
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* One-time invite link result */}
      <Dialog open={inviteResult !== null} onOpenChange={(open) => !open && setInviteResult(null)}>
        <DialogContent>
          <DialogTitle>สร้างคำเชิญสำเร็จ</DialogTitle>
          <DialogDescription>
            คัดลอกลิงก์นี้และส่งให้ {inviteResult?.invitation.invitedEmail} — ลิงก์นี้จะแสดงเพียงครั้งเดียวเท่านั้น
          </DialogDescription>
          <div className="mt-4 flex items-center gap-2">
            <Input value={inviteResult?.inviteUrl ?? ''} readOnly onFocus={(e) => e.target.select()} />
            <Button type="button" size="sm" onClick={() => void handleCopyInviteLink()}>
              <Copy className="size-4" aria-hidden="true" />
              คัดลอก
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title="ลบสมาชิก"
        description={`ต้องการลบ ${removeTarget?.displayName ?? ''} ออกจากบริษัทใช่หรือไม่`}
        confirmLabel="ลบสมาชิก"
        tone="danger"
        onConfirm={() => void handleRemoveConfirm()}
      />

      <ConfirmDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="ยกเลิกคำเชิญ"
        description={`ต้องการยกเลิกคำเชิญของ ${cancelTarget?.invitedEmail ?? ''} ใช่หรือไม่`}
        confirmLabel="ยกเลิกคำเชิญ"
        tone="danger"
        onConfirm={() => void handleCancelInviteConfirm()}
      />
    </div>
  )
}
