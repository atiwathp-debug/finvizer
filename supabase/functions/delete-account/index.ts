// Phase 1E: Delete Account
//
// Hard-deletes the calling user's auth.users row via the Admin API, which
// requires the service_role key — this can never run from the frontend
// (see docs/supabase-setup.md "Security notes"), hence the Edge Function.
//
// Behavior depends on the caller's role in their company (at most one,
// per the "1 user = 1 company" invariant enforced elsewhere in the schema):
//   - OWNER: soft-deletes the company (deleted_at/deleted_by, matching the
//     columns already read by getCurrentCompanyForUser's `.is('deleted_at',
//     null)` filter), then hard-deletes every company_members row and
//     invitations row for it — this is the "removes the company, documents,
//     customers, and every co-worker's access" behavior the Privacy
//     settings warning describes. The company row itself is kept (not hard
//     deleted) so its audit_logs survive as a historical record.
//   - Non-owner: only their own company_members row is removed. The
//     company and every other member's access is untouched.
//   - No company at all: nothing to clean up beyond the account itself.
//
// audit_logs rows for "DELETE_ACCOUNT_COMPLETED" (and any of the caller's
// earlier actions) are written/kept with a real actor_id right up until
// admin.deleteUser() runs; the on-delete-set-null FK added in
// supabase/migrations/20260705120000_account_deletion_support.sql then
// anonymizes them automatically instead of blocking the deletion.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ error: 'Missing Authorization header' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('[delete-account] missing required environment variables')
    return json({ error: 'Server misconfigured' }, 500)
  }

  // Verify the caller's JWT ourselves rather than trusting a client-supplied
  // user id — this client only ever has the anon role's permissions plus
  // whatever the caller's own JWT grants them.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser()
  if (userError || !user) {
    return json({ error: 'Unauthorized' }, 401)
  }
  const userId = user.id

  const admin = createClient(supabaseUrl, serviceRoleKey)

  try {
    const { data: membership, error: membershipError } = await admin
      .from('company_members')
      .select('id, company_id, role')
      .eq('user_id', userId)
      .eq('status', 'ACTIVE')
      .maybeSingle()
    if (membershipError) throw membershipError

    if (membership) {
      // Audit logging failing must never block account deletion itself —
      // logged and swallowed here, same discipline as the client-side
      // logAuditEvent helper (src/lib/supabase/auditLog.ts).
      const { error: requestedLogError } = await admin.from('audit_logs').insert({
        company_id: membership.company_id,
        actor_id: userId,
        action: 'DELETE_ACCOUNT_REQUESTED',
        entity_type: 'user',
        entity_id: userId,
        metadata: { role: membership.role },
      })
      if (requestedLogError) {
        console.error('[delete-account] failed to log DELETE_ACCOUNT_REQUESTED', requestedLogError)
      }

      if (membership.role === 'OWNER') {
        const { error: softDeleteError } = await admin
          .from('companies')
          .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
          .eq('id', membership.company_id)
        if (softDeleteError) throw softDeleteError

        const { error: deleteMembersError } = await admin
          .from('company_members')
          .delete()
          .eq('company_id', membership.company_id)
        if (deleteMembersError) throw deleteMembersError

        const { error: deleteInvitationsError } = await admin
          .from('invitations')
          .delete()
          .eq('company_id', membership.company_id)
        if (deleteInvitationsError) throw deleteInvitationsError
      } else {
        const { error: deleteMemberError } = await admin
          .from('company_members')
          .delete()
          .eq('id', membership.id)
        if (deleteMemberError) throw deleteMemberError
      }

      const { error: completedLogError } = await admin.from('audit_logs').insert({
        company_id: membership.company_id,
        actor_id: userId,
        action: 'DELETE_ACCOUNT_COMPLETED',
        entity_type: 'user',
        entity_id: userId,
        metadata: { role: membership.role },
      })
      if (completedLogError) {
        console.error('[delete-account] failed to log DELETE_ACCOUNT_COMPLETED', completedLogError)
      }
    }

    const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId)
    if (deleteUserError) throw deleteUserError

    return json({ success: true }, 200)
  } catch (error) {
    console.error('[delete-account] failed', { userId, error })
    return json({ error: 'ลบบัญชีไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' }, 500)
  }
})
