# Manual Test Checklist

Living checklist across all Sub Phases. Items not yet implemented are marked
`[ ] (Phase X)` — check them off as their phase lands. Re-run the whole list
before any release.

## Foundation (Phase 0A) — testable now

- [ ] `npm install` completes without errors
- [ ] `npm run dev` starts and the app loads at `http://localhost:5173`
- [ ] `npm run build` completes without TypeScript errors
- [ ] `npm run preview` serves the production build and it loads correctly
- [ ] With no `.env.local` present, app runs in Mock Mode and every
      placeholder route shows the "Mock Mode: ยังไม่ได้เชื่อมต่อ Supabase" banner
- [ ] Every route in `src/routes/index.tsx` renders its placeholder without
      a blank screen or console error
- [ ] Resizing the browser to a mobile width (375px) keeps the placeholder
      page readable and centered
- [ ] Manifest is installable: DevTools > Application > Manifest shows no
      errors, and 192/512/maskable icons load

## App Shell & Mock UI (Phase 0B) — testable now

> As of Phase 1A, `/dashboard`, `/customers`, `/documents`, and `/settings/*`
> require being logged in — register or log in first (see Phase 1A below),
> then re-run this section.

- [ ] Desktop (≥768px): sidebar nav (แดชบอร์ด/เอกสาร/ลูกค้า/ตั้งค่า) is
      visible, active route is highlighted, company badge + user menu show
      in the top bar
- [ ] Mobile (375px): sidebar is hidden, hamburger button opens a slide-in
      drawer with the same nav, clicking a nav link navigates and closes
      the drawer
- [ ] User menu dropdown opens; "ออกจากระบบ" opens a confirm dialog;
      confirming signs out for real and redirects to `/login` (see Phase 1A
      below)
- [x] Dashboard: real stats/charts/reports as of Phase 6A — see "Dashboard
      & Reports (Phase 6A)" below for the full checklist
- [x] Documents: real saved documents + detail page as of Phase 4B — see
      "Approve, Official Number & Immutability (Phase 4B)" below
- [x] Customers: real CRUD as of Phase 3A — see "Customer Management
      (Phase 3A)" below for the full checklist
- [ ] Settings: sub-nav (ข้อมูลบริษัท/สมาชิก/Template/เลขที่เอกสาร/
      ความเป็นส่วนตัว/ประวัติการใช้งาน) switches pages; every settings
      action button shows a "Mock Mode" toast explaining which phase
      implements it for real
- [x] Privacy settings: "ลบบัญชีของฉัน" opens a confirm dialog requiring the
      word `DELETE` to be typed before doing anything (see Phase 1E below
      for the full real-flow checklist)
- [ ] No console errors on any of the above routes/interactions

## Mock Mode (ongoing)

- [x] Dashboard, Documents, Customers, Settings show realistic Thai mock
      data with no network calls
- [x] Buttons requiring a real backend action (e.g. invite member, save
      company) that aren't implemented yet show a Mock Mode toast instead
      of a silent failure
- [x] Export JSON and Delete Account (Phase 1E) work for real in Mock Mode
      too — they simulate against `localStorage`, not a toast placeholder

## Auth (Phase 1A) — testable now

- [ ] `/` redirects to `/login`; visiting `/dashboard` while logged out
      redirects to `/login` (and back to `/dashboard` after logging in)
- [ ] Register with name + email + password (Mock Mode: min 8 chars, 1
      letter, 1 number) creates an account and redirects to
      `/onboarding/company`
- [ ] Registering with an email already used shows "อีเมลนี้ถูกใช้งานแล้ว"
- [ ] Login with correct credentials redirects to `/dashboard`; wrong
      password shows "อีเมลหรือรหัสผ่านไม่ถูกต้อง" (same message either way —
      doesn't reveal which field was wrong)
- [ ] Visiting `/login` or `/register` while already logged in redirects to
      `/dashboard`
- [ ] Logout (via the user menu, with confirm dialog) clears the session and
      redirects to `/login`; `/dashboard` is no longer reachable afterward
- [ ] Forgot Password: submitting any email shows the same "ตรวจสอบอีเมล"
      success message (no account-existence leak); in Mock Mode, the
      Reset Password page then works for that email in the same tab
- [ ] Reset Password: visiting `/reset-password` directly (no prior Forgot
      Password step) shows "ลิงก์ไม่ถูกต้องหรือหมดอายุ" in Mock Mode
- [ ] After resetting the password, logging in with the new password works
      and the old password no longer does
- [ ] `[ ]` (real Supabase, confirmations enabled) Register shows a "check
      your email" screen with a working "ส่งอีเมลยืนยันอีกครั้ง" resend button
- [ ] `[ ]` (real Supabase, confirmations enabled) Logging in before
      confirming shows "อีเมลนี้ยังไม่ได้ยืนยัน..." with a resend action
- [ ] All 4 auth forms show inline Thai validation errors (Zod) before
      hitting the network — e.g. empty email, mismatched confirm password

## Database & RLS (Phase 1B) — needs a real Supabase project

Not testable via `npm run test` (no live Postgres in this repo's Vitest
setup) — see [docs/rls-policy-notes.md](rls-policy-notes.md) for the full
policy-by-policy breakdown and a manual SQL verification recipe.

- [ ] `[ ]` All 5 migrations apply cleanly, in order, on a fresh project
- [ ] `[ ]` `select tablename from pg_tables where schemaname='public' and
      rowsecurity=false` returns zero rows (every table has RLS on)
- [ ] `[ ]` Registering a user creates a matching `profiles` row
      automatically (via `handle_new_user`), with `display_name` from the
      sign-up form
- [ ] `[ ]` User A cannot `select`/`update`/`delete` User B's company,
      members, invitations, or audit log rows
- [ ] `[ ]` A user with an existing `company_members` row cannot `insert`
      a second `companies` row (owner_id = themselves)
- [ ] `[ ]` A non-owner member cannot `update` or `delete` rows in
      `company_members` or `invitations` for their own company
- [ ] `[ ]` Attempting to `update` a company's `owner_id` to a different
      user is rejected
- [ ] `[ ]` `audit_logs` has no UPDATE/DELETE policy (query `pg_policies`)

## Company Onboarding (Phase 1C) — testable now

- [ ] A newly registered/logged-in user with no company is redirected to
      `/onboarding/company` when visiting any main-app route (`/dashboard`,
      `/customers`, `/documents`, `/settings/*`)
- [ ] The onboarding form validates: Thai name required, tax ID must be
      exactly 13 digits, company code letters/digits only (auto-uppercased
      on submit — e.g. `demo` → `DEMO`), email format, required
      phone/address/contact name
- [ ] Submitting a valid form creates the company (+ OWNER membership in
      real Supabase mode, atomically via the `create_company_with_owner`
      RPC — see `docs/rls-policy-notes.md`) and redirects to
      `/onboarding/template`, not `/dashboard`
- [ ] `CurrentCompanyBadge` in the top bar shows the real company name,
      code, and branch right after onboarding
- [ ] Visiting `/onboarding/company` again while already having a company
      redirects to `/dashboard` instead (1 user = 1 company, enforced by
      `RequireNoCompany`)
- [ ] Settings > ข้อมูลบริษัท pre-fills every field with the real company
      data; editing a field and saving shows a success toast and persists
      the change (reflected immediately in `CurrentCompanyBadge` too)
- [ ] Company code and branch (`HQ - สำนักงานใหญ่`) are shown but not
      editable in Settings
- [ ] "บันทึกการเปลี่ยนแปลง" is disabled until a field is actually changed
- [ ] `[ ]` (real Supabase) A user who already owns a company cannot
      `insert` a second one — rejected both by the onboarding form's
      `RequireNoCompany` guard and by RLS (see Phase 1B checklist above)

## Member Invitation & Roles (Phase 1D) — testable now

- [ ] Settings > สมาชิก: Owner sees "เชิญสมาชิก", fills email + role, submits
      → a one-time invite link dialog appears with a working "คัดลอก" button
- [ ] The invite link is never shown again after closing that dialog (only
      the token *hash* is persisted — check `finvizer_mock_invitations` in
      Mock Mode, or the `invitations` table in real Supabase: `token_hash`
      is a 64-char hex string, never the raw token)
- [ ] "เหลือ N ที่ว่าง" updates correctly after inviting; after 2 invited
      emails (active members + pending invites combined), "เชิญสมาชิก" is
      disabled
- [ ] Pending invitations show under "คำเชิญที่รอตอบรับ" with a cancel
      button (owner only); cancelling sets status to `CANCELLED` and frees
      up a slot
- [ ] Visiting `/invite/:token` while logged out shows a prompt with
      Login/Register links (not an automatic redirect) — both preserve the
      invite path and return there after a successful login/register
      (verified: registering as the invited email lands back on
      `/invite/:token`, not `/onboarding/company`)
- [ ] Visiting `/invite/:token` while logged in shows a confirm screen with
      the logged-in email, requiring an explicit "เข้าร่วมบริษัท" click
      (no auto-accept on page load)
- [ ] Accepting with the correct invited email creates an ACTIVE
      `company_members` row with the invited role, marks the invitation
      `ACCEPTED`, and grants immediate access to the main app (verified:
      `CurrentCompanyBadge`, dashboard, etc. all work right after accepting)
- [ ] Accepting with a *different* logged-in email shows
      "อีเมลของคุณไม่ตรงกับอีเมลที่ได้รับคำเชิญ"
- [ ] A user who already belongs to another company gets
      "คุณเป็นสมาชิกของบริษัทอื่นอยู่แล้ว..." when attempting to accept
- [ ] Re-using an already-accepted or invalid token shows
      "ลิงก์คำเชิญไม่ถูกต้องหรือถูกใช้งานไปแล้ว"
- [ ] A non-owner member (e.g. EDITOR) sees Settings > ข้อมูลบริษัท as
      read-only (no save button, fields disabled) and Settings > สมาชิก
      with no "เชิญสมาชิก" button and no remove/role-change controls on
      the member list (`PermissionGuard` / `useHasCompanyRole`)
- [ ] The Owner's own row never shows a role-change dropdown or remove
      button, even to the Owner
- [ ] `[ ]` (real Supabase) `accept_invitation` RPC re-validates everything
      server-side even if the client is bypassed — see
      `docs/rls-policy-notes.md`

## Template Selection (Phase 2A) — testable now

- [ ] Right after onboarding (or whenever `documentTemplate` is still
      `null`), visiting any main-app route (`/dashboard`, `/customers`,
      `/documents`, `/settings/*`) redirects to `/onboarding/template`
      instead — the main app is unreachable until a template is chosen
- [ ] `/onboarding/template` shows both **Executive Classic** (dark
      header, muted colors) and **Modern Accent** (gradient
      indigo-to-emerald header, rounded badge) with visibly different
      previews, in a 2-column grid on desktop and stacked cards on mobile
      (375px)
- [ ] "ดูตัวอย่างเต็ม" opens `FullTemplatePreviewDialog` with a larger
      version of the same preview (extra note/signature row only shown in
      this full view, not the card)
- [ ] As the Owner, clicking "เลือก Template นี้" (on a card or inside the
      dialog) saves it as the company default, shows a success toast, and
      redirects to `/dashboard`
- [ ] The selected template shows a "ใช้งานอยู่" badge and its "เลือก
      Template นี้" button becomes disabled/labeled "Template นี้ใช้งานอยู่"
- [ ] As a non-owner member reaching `/onboarding/template` (company has
      no template yet), a notice explains they must wait for the owner;
      "เลือก Template นี้" is disabled for them but "ดูตัวอย่างเต็ม" still
      works
- [ ] Settings > Template เอกสาร shows the same 2 templates and lets the
      Owner change the selection at any time (no redirect — this is the
      "change later" path); a non-owner sees it read-only with a notice,
      same pattern as Settings > ข้อมูลบริษัท
- [ ] Changing the template in Settings shows a success toast and updates
      immediately (no page reload needed)
- [ ] Both selection actions log an audit event
      (`SELECT_DOCUMENT_TEMPLATE` on first pick, `CHANGE_DOCUMENT_TEMPLATE`
      from Settings)
- [ ] Mock Mode: the choice persists in `finvizer_mock_companies`
      (`documentTemplate` field) and survives a page reload

## Document Numbering Settings (Phase 2B) — testable now

> This phase is settings-only — it stores a numbering *pattern* and
> *reset policy* per company (and optionally per document type). No
> `document_number` is ever generated here; that's Phase 2C, once a real
> documents table exists. The Phase 0B mock Documents list already shows
> "จะออกเลขเมื่ออนุมัติ" for Draft rows — see the App Shell & Mock UI
> section above.

- [ ] Settings > เลขที่เอกสาร shows the fixed warning: "เลขเอกสารจะถูกสร้าง
      โดยระบบเท่านั้น ไม่สามารถแก้เลขเอกสารเองได้ เพื่อป้องกันเลขซ้ำและรักษาความ
      ถูกต้องทางบัญชี"
- [ ] The 4 preset patterns each render a correct live preview using the
      real company code/branch code (e.g. `DEMO-QO-20260701-0001` for
      preset 2 with company code `DEMO`)
- [ ] Selecting "กำหนดเอง (Custom Pattern)" reveals the token builder; every
      token button appends a chip, dashes are inserted automatically
      between chips, and each chip has its own remove ("×") control
- [ ] `{PROJECT_CODE}` is visibly disabled with a "เร็ว ๆ นี้" badge and
      cannot be added to the pattern
- [ ] Custom Pattern Builder validation (live, as chips are added/removed):
  - [ ] Missing `{DOC_TYPE}` blocks saving with a clear error
  - [ ] Missing `{RUNNING:n}` blocks saving; adding a second `{RUNNING:n}`
        also blocks saving ("ใส่เลขรัน... ได้เพียงตำแหน่งเดียว")
  - [ ] Missing both `{YYYY}` and `{YY}` blocks saving
  - [ ] A pattern whose rendered preview exceeds 64 characters blocks
        saving and shows the character count
  - [ ] Adding `{CUSTOMER_CODE}` shows a non-blocking warning that every
        customer needs a code, but does not prevent saving
- [ ] Reset policy defaults to "รายเดือน" (MONTHLY) for a brand-new company
      that hasn't saved a default yet; all 4 options (รายวัน/รายเดือน/รายปี/
      ไม่รีเซ็ต) are selectable
- [ ] Saving the company-wide default shows a success toast and persists
      (survives a page reload)
- [ ] "ตั้งค่าเฉพาะ" on any of the 8 document types opens a dialog with the
      same editor, pre-filled from the current default; saving creates an
      override shown with a "ตั้งค่าเฉพาะ" badge in the list (others still
      show "ใช้ค่าเริ่มต้น")
- [ ] The revert ("↺") control on an overridden document type removes the
      override (after confirming) and it goes back to showing "ใช้ค่าเริ่มต้น"
- [ ] A non-owner member sees every pattern/preview read-only (no
      "ตั้งค่าเฉพาะ"/"บันทึก" controls) with a notice explaining only the
      owner can change it
- [ ] Desktop (≥768px) shows preset cards in a 2-column grid; mobile
      (375px) stacks them in a single column
- [ ] Both save actions log an audit event (`SAVE_NUMBERING_SETTING` on
      save, `REVERT_NUMBERING_SETTING` on revert)

## Document Number Generation Backend (Phase 2C) — unit-testable now, no UI yet

> This phase is backend-only, same as Phase 2B was settings-only — there's
> no Documents UI to click through yet (that's Phase 3/4). Everything
> below is exercised by `src/lib/mock/mockDocuments.test.ts`,
> `src/lib/mock/mockNumberingSequences.test.ts`,
> `src/lib/numbering/sequenceKey.test.ts`, and the extended
> `numberingPattern.test.ts` — run `npm run test` to verify all of it at
> once. Items marked `[ ]` need a real Supabase project to verify (see
> `docs/rls-policy-notes.md` step 8 for the exact SQL to run).

- [x] A newly created Draft has `document_number = null` and
      `status = 'DRAFT'`
- [x] Approving a Draft with a company-wide default pattern configured
      generates a `document_number` matching that pattern and flips
      `status` to `APPROVED`
- [x] Approving without any `numbering_settings` configured yet fails with
      a clear Thai error instead of generating a malformed number
- [x] A pattern using `{CUSTOMER_CODE}` refuses to approve a document with
      no `customer_code` set, and succeeds once one is provided
- [x] MONTHLY: two Drafts approved in the same month get consecutive
      numbers (`0001`, `0002`)
- [x] DAILY: numbers reset to `0001` on a new day but keep incrementing
      within the same day
- [x] YEARLY: numbers reset to `0001` on a new year but keep incrementing
      within the same year
- [x] NEVER: numbers keep incrementing across day/month/year boundaries,
      never resetting
- [x] Each document type has its own independent running counter — a
      Quotation and an Invoice approved back-to-back both start at `0001`
- [x] A per-document-type override (Settings > เลขที่เอกสาร, Phase 2B) is
      used instead of the company default when approving that type
- [x] If a rendered number collides with an existing one, approval
      silently retries (up to 3 times) and returns a different,
      non-colliding number instead of failing or duplicating
- [x] A Draft that's already been approved cannot be approved again — the
      stored `document_number`/`status` are provably unchanged after the
      failed retry
- [x] Deleting a Draft never touches the running sequence — the next
      approval afterward still starts at `0001` (no gap, since Drafts
      never had a number to begin with)
- [x] Deleting a non-Draft (`APPROVED`/`PAID`/`CANCELLED`) document is
      refused
- [ ] `[ ]` (real Supabase only) `approve_document` runs as a transaction-
      safe PostgreSQL RPC (`security definer`), not client-side — a raw
      `update documents set document_number = 'X'` fails with a
      permission/grant error regardless of role, since there is no UPDATE
      grant on the table at all
- [ ] `[ ]` (real Supabase only) Only `OWNER`/`ADMIN`/`ACCOUNTANT` can
      call `approve_document` successfully; `VIEWER` (and, by the table's
      own design, `EDITOR`) get "คุณไม่มีสิทธิ์อนุมัติเอกสาร"
- [ ] `[ ]` (real Supabase only) `DOCUMENT_NUMBER_GENERATED` and
      `APPROVE_DOCUMENT` audit_logs rows exist after a real approval,
      written atomically by the RPC itself

## Customer Management (Phase 3A) — testable now

- [ ] `/customers` shows a loading skeleton on first load, then either the
      table or the empty state ("ยังไม่มีลูกค้า") for a brand-new company
- [ ] "เพิ่มลูกค้า" opens a form; only รหัสลูกค้า and ชื่อลูกค้า are
      required — submitting with just those two succeeds
- [ ] Duplicate รหัสลูกค้า (case-insensitive is not required, but same
      exact code) within the same company is rejected with a clear error
- [ ] เลขประจำตัวผู้เสียภาษี, if filled in, must be exactly 13 digits;
      อีเมล, if filled in, must be a valid format — both are optional and
      the form accepts leaving them blank
- [ ] Creating/editing a customer shows a success toast and the table
      refreshes immediately (no manual reload needed)
- [ ] Search filters by name, code, or tax ID; a search with no matches
      shows "ไม่พบลูกค้าที่ตรงกับคำค้นหา" instead of the generic empty state
- [ ] With more than 10 customers, pagination controls appear
      ("ก่อนหน้า"/"ถัดไป" + "หน้า X จาก Y"); searching resets back to page 1
- [ ] Clicking a row (not the edit/delete icons) opens a read-only detail
      view showing every field, including หมายเหตุ (not shown in the table)
- [ ] The pencil icon (or "แก้ไข" in the detail view) opens the same form
      pre-filled; the trash icon (or "ลบ" in the detail view) opens a
      confirm dialog before soft-deleting
- [ ] A soft-deleted customer disappears from the list immediately and its
      รหัสลูกค้า can be reused by a new customer afterward
- [ ] A `VIEWER` member sees the list and can open the read-only detail
      view, but has no "เพิ่มลูกค้า" button and no edit/delete icons
      anywhere
- [ ] Desktop (≥768px) shows a real table; mobile (375px) stacks rows as
      cards, including the edit/delete actions
- [ ] Every create/update/soft-delete logs an audit event
      (`CREATE_CUSTOMER`/`UPDATE_CUSTOMER`/`SOFT_DELETE_CUSTOMER`)
- [ ] Mock Mode: customers persist in `finvizer_mock_customers` and
      survive a page reload; a second company (different browser profile
      or after switching accounts) never sees another company's customers
- [ ] `[ ]` (real Supabase only) A non-member of the company gets zero
      rows back from `customers`, not an error — see
      `docs/rls-policy-notes.md` step 9 for the exact SQL to run

## Document Draft Management (Phase 4A) — testable now

> Approve/official numbering is a separate phase (Phase 4B, below) — every
> document created here stays a Draft. Add at least one customer first
> (Phase 3A) so the form has someone to select.

- [ ] "สร้างเอกสารใหม่" on `/documents` navigates to `/documents/new` and
      shows the empty form with today's date pre-filled as วันที่ออกเอกสาร
- [ ] The live preview panel updates in real time as you type — company
      name, selected customer, line items, and totals all reflect the
      form without needing to save first
- [ ] The preview always shows "จะออกเลขเมื่ออนุมัติ" instead of a document
      number (every document here is a Draft)
- [ ] "เพิ่มรายการ" adds a new line item row; each row's "จำนวนเงิน" updates
      live as you change จำนวน/ราคา/หน่วย/ส่วนลด; the trash icon removes a row
- [ ] Saving with zero line items succeeds — a Draft is allowed to be a
      work in progress
- [ ] Selecting a customer, filling in at least one line item, and
      clicking "บันทึกฉบับร่าง" shows a success toast and moves the URL to
      `/documents/:id/edit` (the same page, now editing the saved Draft)
- [ ] Reloading `/documents/:id/edit` for that Draft re-loads all saved
      fields and line items correctly
- [ ] Editing the loaded Draft (e.g. changing a line item's price) and
      saving again updates the same document — no duplicate is created
- [ ] Calculation correctness, verified against the FinancialSummary and
      preview panel matching exactly:
  - [ ] VAT_EXCLUDED adds 7% on top of the (post-discount) subtotal
  - [ ] VAT_INCLUDED shows a VAT amount extracted from the total, and the
        grand total does **not** change when switching to/from this mode
        with the same line items
  - [ ] NON_VAT shows no VAT line at all
  - [ ] An item-level AMOUNT discount subtracts a fixed baht value from
        that item only
  - [ ] An item-level PERCENT discount subtracts a percentage of that
        item's own gross amount
  - [ ] The document-level discount (in FinancialSummary) applies once,
        after summing all item amounts, before VAT
  - [ ] All amounts display as Thai Baht (e.g. `฿1,250.00`), always 2
        decimals
- [ ] A PERCENT discount (item-level or document-level) entered as more
      than 100 is rejected with a clear validation error
- [ ] With zero customers in the company, the form shows a notice
      ("ยังไม่มีลูกค้า...") instead of letting you submit with no customer
- [ ] Visiting `/documents/:id/edit` for a document that is not a Draft
      (approve it first, via Phase 4B below) shows "ไม่สามารถแก้ไขได้"
      instead of the form — Approved/Paid/Cancelled documents are never
      editable
- [ ] A `VIEWER` member visiting `/documents/new` or `/documents/:id/edit`
      sees "ไม่มีสิทธิ์เข้าถึง" instead of the form
- [ ] Desktop (≥1024px) shows the form and live preview side by side;
      mobile/tablet stacks the preview below the form
- [ ] Both create and update log an audit event
      (`CREATE_DOCUMENT_DRAFT`/`UPDATE_DOCUMENT_DRAFT`)
- [ ] Mock Mode: Drafts persist in `finvizer_mock_documents` (including
      their `items` array) and survive a page reload
- [ ] `[ ]` (real Supabase only) A direct `update documents set
      document_number = 'X'` always fails, even on a Draft the caller
      owns — see `docs/rls-policy-notes.md` step 10 for the exact SQL to
      run

## Approve, Official Number & Immutability (Phase 4B) — testable now

> Requires at least one numbering pattern configured (Phase 2B,
> `/settings/numbering`) and a saved Draft with a customer and at least
> one line item (Phase 4A) before approving.

- [ ] Open a Draft at `/documents/:id` (navigate there from the `/documents`
      list, or the Draft's own edit page once saved) — the read-only
      preview shows the same totals as the editor, and "จะออกเลขเมื่ออนุมัติ"
      in place of a document number
- [ ] As `OWNER`/`ADMIN`/`ACCOUNTANT`, an "อนุมัติเอกสาร" button is visible
      on a Draft; as `EDITOR` or `VIEWER`, it is not
- [ ] Clicking "อนุมัติเอกสาร" shows a confirmation dialog before doing
      anything; cancelling the dialog leaves the document untouched
- [ ] Confirming approval shows a success toast that includes the newly
      generated official document number, and the page now shows
      `StatusBadge` "อนุมัติแล้ว" with the real document number in place of
      the Draft placeholder
- [ ] The approved document's `/documents/:id/edit` route now shows
      "ไม่สามารถแก้ไขได้" — Approved documents are read-only for editing
- [ ] The generated document number never changes afterwards, no matter
      what other status transitions happen next (mark paid, cancel)
- [ ] On an Approved **RECEIPT or RECEIPT_TAX_INVOICE**, "บันทึกว่าชำระแล้ว"
      is visible to `OWNER`/`ADMIN`/`ACCOUNTANT` only; on an Approved
      `QUOTATION`, `INVOICE`, `TAX_INVOICE`, `CREDIT_NOTE`, or
      `CREDIT_NOTE_TAX`, "บันทึกว่าชำระแล้ว" is **never** shown, even to an
      `OWNER` — only receipts represent money actually collected (see
      "Production readiness" below)
- [ ] "ยกเลิกเอกสาร" is visible on any Approved document to
      `OWNER`/`ADMIN`/`ACCOUNTANT`, regardless of document type
- [ ] "บันทึกว่าชำระแล้ว" flips the status to "ชำระแล้ว" (`StatusBadge`
      turns green) and shows a success toast; the document is still
      read-only, and no status-action buttons remain
- [ ] On a different Approved document, "ยกเลิกเอกสาร" shows a confirmation
      dialog first; confirming flips the status to "ยกเลิก" (`StatusBadge`
      turns red) and the document becomes read-only with no further
      actions available
- [ ] A `PAID` document cannot be cancelled, and a `CANCELLED` document
      cannot be marked paid — neither status exposes any action button
- [ ] `/documents` list shows real saved Drafts, Approved, Paid, and
      Cancelled documents (not the old static demo rows) — the status
      filter dropdown correctly narrows the list to each status, and the
      search box matches by document number or customer name
- [ ] Clicking any row in the `/documents` list navigates to that
      document's `/documents/:id` detail page
- [ ] Approving logs an audit event (`APPROVE_DOCUMENT` and
      `DOCUMENT_NUMBER_GENERATED`); marking paid logs
      `MARK_DOCUMENT_PAID`; cancelling logs `CANCEL_DOCUMENT`
- [ ] Mock Mode: approve/mark-paid/cancel all persist to
      `finvizer_mock_documents` and survive a page reload
- [ ] `[ ]` (real Supabase only) As `EDITOR`, calling
      `select public.mark_document_paid('<id>')` or
      `select public.cancel_document('<id>')` directly in the SQL editor
      raises a permission error — see `docs/rls-policy-notes.md` step 11

## Document Revision (Phase 4C) — testable now

> Requires an Approved document (Phase 4B) first — approve a Draft at
> `/documents/:id` before testing any of the below.

- [ ] On an Approved document that is **not** itself a revision, a
      "สร้าง Revision" button is visible to `OWNER`/`ADMIN`/`ACCOUNTANT`/
      `EDITOR`; it is not visible to `VIEWER`
- [ ] On a `DRAFT`, `PAID`, or `CANCELLED` document, "สร้าง Revision" is
      never shown
- [ ] On an Approved document that is *itself* a revision, "สร้าง
      Revision" is not shown either — revising a revision isn't supported
      in this phase
- [ ] Clicking "สร้าง Revision" creates a new Draft and navigates to its
      `/documents/:id/edit` page; the new Draft shows "จะออกเลขเมื่ออนุมัติ"
      (no revision number yet) and no `documentNumber`
- [ ] The new revision Draft's customer, line items, VAT mode, note, วัน
      ครบกำหนด (payment term), ประเภทเอกสาร, and totals all match the
      source document exactly; วันที่ออกเอกสาร is today's date, not the
      source's original issue date
- [ ] Editing the revision Draft (e.g. changing a line item) and saving
      works exactly like editing any other Draft (Phase 4A) — no
      duplicate is created
- [ ] Approving the revision Draft shows a success toast with the
      generated number in the form `ORIGINAL_NUMBER-R1`, and the detail
      page's `StatusBadge` turns "อนุมัติแล้ว"
- [ ] Creating and approving a **second** revision from the same original
      (not from the first revision) produces `ORIGINAL_NUMBER-R2`
- [ ] An approved revision is immutable exactly like any other Approved
      document: its `/documents/:id/edit` route shows "ไม่สามารถแก้ไขได้",
      and it can be marked paid / cancelled via the same Phase 4B actions
- [ ] The document detail page shows a "ประวัติ Revision" timeline listing
      the original plus every revision, each with its own `StatusBadge`
      and document number (or "จะออกเลขเมื่ออนุมัติ" for a still-Draft
      revision); the entry for the document currently being viewed is
      visually highlighted
- [ ] Visiting a revision's own detail page shows a "Revision R1 ของ
      ORIGINAL_NUMBER" line linking back to the original
- [ ] Clicking any entry in the timeline navigates to that document's own
      detail page
- [ ] A `VIEWER` member sees the timeline (read-only) but no "สร้าง
      Revision" button anywhere, and cannot edit a revision Draft
- [ ] An `EDITOR` member can create and edit a revision Draft but does not
      see an approve action on it (same Phase 4B approve-permission rule)
- [ ] Creating a revision logs `CREATE_DOCUMENT_REVISION`; approving one
      logs `APPROVE_REVISION` (not `DOCUMENT_NUMBER_GENERATED`/
      `APPROVE_DOCUMENT` — no numbering sequence is touched for a
      revision)
- [ ] Mock Mode: revisions persist in `finvizer_mock_documents`
      (`parentDocumentId`/`revisionNo` fields) and survive a page reload
- [ ] `[ ]` (real Supabase only) A direct
      `insert into documents (..., parent_document_id) values (..., '<id>')`
      always fails — only `create_document_revision()` can produce a
      revision row — see `docs/rls-policy-notes.md` step 12

## PDF Export (print-based, replaces Phase 5A's react-pdf export) — testable now

> Requires at least one document (Draft or Approved, Phase 4A/4B) to
> export. Switch the company's template at `/settings/templates` to test
> all three layouts against the same document.
>
> Export PDF no longer uses a separate PDF-rendering library. "ส่งออก PDF"
> opens `/documents/:id/print` in a new tab, which renders the exact same
> `<DocumentPreview>` component shown on the detail page and then calls the
> browser's own print dialog (`window.print()`) — "Save as PDF" in that
> dialog is what produces the file. There is only one layout
> implementation now, so the exported/printed output cannot drift from the
> on-screen preview.

- [ ] "ส่งออก PDF" is visible on every document's `/documents/:id` page,
      regardless of status (Draft/Approved/Paid/Cancelled) or whether it's
      a revision — exporting a copy is a read action, not gated behind the
      edit/approve permissions like the other buttons on this page
- [ ] Clicking it opens a new tab at `/documents/:id/print` showing just
      the document sheet (no sidebar/topbar/toast — this route renders
      outside the app shell), then the browser's print dialog opens
      automatically after a brief delay
- [ ] In the print dialog, the destination can be set to "Save as PDF"
      (or "Microsoft Print to PDF" etc.) — the suggested filename is
      `{ประเภทเอกสาร}-{เลขที่เอกสาร}.pdf`, or `{ประเภทเอกสาร}-DRAFT.pdf`
      for a Draft with no official number yet (from the tab's title)
- [ ] The print preview / saved PDF shows: company name/address/tax id
      (each name displaying in full, no clipping), customer name/address
      (also displaying in full), document type, document number (or "จะ
      ออกเลขเมื่ออนุมัติ" for a Draft), line items with quantity/unit/unit
      price/amount, VAT line (hidden for NON_VAT, labeled correctly for
      VAT_EXCLUDED vs VAT_INCLUDED), grand total, note, the due date
      (payment term), and the signature area at the bottom
- [ ] The printed page is A4 portrait with proper margins, white
      background, and no clipped or overflowing text/tables — matches
      `@media print { @page { size: A4 portrait; margin: 12mm } }` in
      `src/styles/index.css`
- [ ] With the company set to **Executive Classic** (`/settings/templates`),
      the header is dark slate with white text; with **Modern Accent**, the
      header is indigo/orange accented; with **Minimal Print**, the layout
      is plain black lines with no color — same as the on-screen preview,
      because it's the same component
- [ ] The logo renders at the configured position/size
      (`left_of_company_name` / `header_left` / `header_center` /
      `header_right` / `centered_logo_above_company` / `hidden`) exactly as
      it does in the on-screen detail-page preview
- [ ] The signature area renders each configured slot (Settings → ลายเซ็น
      เอกสาร) as: a line, then `(________________________)`, then the
      label — all centered — including any custom labels, not just the
      ผู้ซื้อ/ผู้ขาย defaults
- [ ] All Thai text (company name, customer name, line item descriptions,
      notes, labels) renders with correct glyphs — no tofu boxes or
      missing characters — and numbers/currency symbols (฿) render
      correctly alongside Thai text on the same line
- [ ] On an approved **revision**, the printed page shows a "Revision R1"
      (or R2, etc.) line near the document number, and the document number
      itself already includes the `-R1`/`-R2` suffix
- [ ] The grand total, subtotal, discount, and VAT amounts on the printed
      page match exactly what's shown on the detail page's preview for the
      same document (same `formatTHB` output, same figures — trivially
      true now since it's the same component, but confirm no stale state)
- [ ] Exporting a Draft with zero line items still renders correctly (shows
      "ยังไม่มีรายการ" in the items area) instead of erroring
- [ ] A customer name/note containing unusual characters (e.g. `<script>`
      tags, stray control characters) renders as inert plain text — no
      broken layout, no executed markup
- [ ] Mock Mode: the print route works with no Supabase project connected —
      rendered entirely from already-loaded local state
- [ ] `[ ]` (real Supabase only) Same print/export flow works unchanged
      against a real document loaded from Supabase — no separate code path
      exists for Mock Mode vs real mode
- [ ] Check `audit_logs` (or the on-screen timeline after reloading the
      detail page): an `EXPORT_DOCUMENT_PDF` event is recorded once per
      print-page load, not once per print-dialog interaction

## Document Conversion & Activity Timeline (Phase 6A) — testable now

> Requires an Approved document first (Phase 4B). Conversion is
> independent of revision (Phase 4C) — a document can be revised,
> converted, both, or neither.

- [ ] On an Approved `QUOTATION`, a "แปลงเอกสาร" button is visible to
      `OWNER`/`ADMIN`/`ACCOUNTANT`/`EDITOR`; not visible to `VIEWER`
- [ ] On an Approved `CREDIT_NOTE` or `CREDIT_NOTE_TAX` (terminal types,
      no outgoing conversions), "แปลงเอกสาร" is never shown
- [ ] On a `DRAFT`, `PAID`, or `CANCELLED` document, "แปลงเอกสาร" is never
      shown
- [ ] Clicking "แปลงเอกสาร" opens a dialog listing only the valid target
      types for this document's type (e.g. `QUOTATION` shows only
      `INVOICE`; `INVOICE` shows `RECEIPT` and `TAX_INVOICE`)
- [ ] Confirming creates a new Draft of the chosen type and navigates to
      its `/documents/:id/edit` page; the new Draft shows "จะออกเลขเมื่อ
      อนุมัติ" (no document number yet)
- [ ] The new Draft's customer, line items, VAT mode, note, วันครบกำหนด
      (payment term), and totals all match the source exactly; วันที่ออก
      เอกสาร is today's date, not the source's; ประเภทเอกสาร is the new
      target type, not the source's
- [ ] Approving the converted Draft gives it its own independent
      `document_number` from the normal numbering pattern (not derived
      from the source's number, unlike a revision's `-R1` suffix)
- [ ] The source document's detail page shows a "ประวัติการแปลงเอกสาร"
      panel listing every document converted from it, each with its own
      type/number/`StatusBadge`; the converted document's own detail page
      shows a "แปลงมาจาก {ประเภท} {เลขที่}" line linking back to the source
- [ ] Converting the same Approved document a second time to a different
      valid target (e.g. an `INVOICE` to both `RECEIPT` and
      `TAX_INVOICE`) works independently — both appear in the source's
      conversion history
- [ ] `[ ]` (real Supabase only) Calling
      `select public.create_document_conversion('<id>', 'RECEIPT')` on a
      `QUOTATION` (an invalid target) raises
      "ไม่สามารถแปลงเอกสารประเภทนี้เป็นประเภทที่เลือกได้" — see
      `docs/rls-policy-notes.md` step 13
- [ ] Every document's detail page shows a "ประวัติกิจกรรม" (activity
      timeline) section listing, in order: creating the draft, editing it
      (if edited), approving, marking paid or cancelling (if applicable),
      exporting a PDF (if exported), and — for a revision or converted
      document — its own creation event
- [ ] Creating a revision (Phase 4C) or exporting a PDF (Phase 5A) on a
      document adds a new entry to that same timeline without a page
      reload
- [ ] Mock Mode: the timeline shows real entries (not empty) — Mock Mode
      audit logging now persists to `localStorage`
      (`finvizer_mock_audit_logs`) as of this phase, unlike earlier
      phases where it was a no-op
- [ ] Settings > ประวัติการใช้งาน is unaffected by the above — it still
      shows its own static Thai demo data, not real entries (only the
      document timeline reads real ones this phase)

## Dashboard & Reports (Phase 6A, rewritten for production readiness) — testable now

> Create at least a few documents across different statuses and types
> (Draft, Approved, Paid, Cancelled; some QUOTATION → INVOICE → RECEIPT
> chains) first for the stats/charts to show anything meaningful.

- [ ] `/dashboard` shows a date-range filter (defaulting to today back 3
      months) above everything else, and exactly 3 stat cards computed
      from **INVOICE documents only**: จำนวนเอกสารที่รอการอนุมัติ (count of
      `DRAFT` documents of any type, within range), ยอดขายที่ออกใบแจ้งหนี้
      (sum of `grandTotal` for `INVOICE` documents with status
      `APPROVED` or `PAID`, within range), ยอดขายที่มีการชำระเงินแล้ว (sum
      of `grandTotal` for `INVOICE` documents with status `PAID`, within
      range) — a skeleton shows briefly on first load
- [ ] The bar chart compares ออกใบแจ้งหนี้ vs ชำระแล้ว per month, computed
      from `INVOICE` documents only — a `RECEIPT` or `QUOTATION` never
      contributes to either series
- [ ] "ลูกค้าที่มียอดขายสูงสุด" and "ลูกค้าที่ซื้อบ่อยที่สุด" are both
      computed from `INVOICE` documents only (`APPROVED`/`PAID`), sorted
      by total amount and by document count respectively — a customer
      with only `RECEIPT`/`QUOTATION`/Draft/Cancelled documents does not
      appear in either list
- [ ] "ติดตามสถานะใบเสนอราคา" lists every `QUOTATION` within the selected
      date range with a derived status badge: ฉบับร่าง (Draft),
      อนุมัติแล้ว รอแปลงเป็นใบแจ้งหนี้ (Approved, no conversion yet),
      แปลงเป็นใบแจ้งหนี้แล้ว (converted to an `APPROVED` `INVOICE`),
      ชำระแล้ว (the converted `INVOICE` is `PAID`), ยกเลิก (Cancelled) —
      this status is derived, never stored
- [ ] Narrowing the date range updates every card/chart/list on the page;
      widening it back out restores the previously hidden documents
      (verify by picking a range that excludes a known document, then a
      range that includes it again)
- [ ] A quotation issued outside the selected date range but converted to
      an invoice that was later paid still resolves correctly if the
      quotation itself is brought into range — the tracking table always
      resolves against the full document set, not just the visible range
- [ ] With zero documents in the company (or none in the selected range),
      stat cards show 0/฿0.00, the chart renders empty without erroring,
      and the customer lists / quotation table show empty states instead
      of blank content
- [ ] Mock Mode: dashboard stats compute correctly against
      `finvizer_mock_documents` with no Supabase project connected
- [ ] `[ ]` (real Supabase only) Same dashboard queries work unchanged
      against documents loaded from Supabase — `listDocuments()`/
      `listCustomers()` are the same calls `/documents` and `/customers`
      already use, just aggregated client-side

## Production readiness: Paid-status cascade & outstanding calculation — testable now

> Requires a full QUOTATION → INVOICE → {RECEIPT, TAX_INVOICE} conversion
> chain (Phase 6A conversion) with every step approved.

- [ ] "บันทึกว่าชำระแล้ว" only ever appears on an Approved `RECEIPT` or
      `RECEIPT_TAX_INVOICE` — confirmed above in the Phase 4B section
- [ ] Marking an Approved `RECEIPT` paid also flips its source `INVOICE`
      to `PAID`, and any sibling `TAX_INVOICE`/`RECEIPT_TAX_INVOICE`
      converted from that same `INVOICE` to `PAID` as well — revisit each
      document's own detail page to confirm the `StatusBadge`
- [ ] The `QUOTATION` at the start of that same chain stays `APPROVED` —
      it is never auto-marked paid
- [ ] A sibling document that was separately `CANCELLED` before the
      receipt was paid stays `CANCELLED` — the cascade never overrides a
      terminal status
- [ ] Each cascaded document's "ประวัติกิจกรรม" timeline shows its own
      `MARK_DOCUMENT_PAID` entry, distinguishable from the RECEIPT's own
      entry
- [ ] Outstanding/unpaid amounts (the Dashboard's ยอดขายที่ออกใบแจ้งหนี้
      minus ยอดขายที่มีการชำระเงินแล้ว) drop to reflect the newly-`PAID`
      invoice immediately after the cascade — no separate action needed
- [ ] `[ ]` (real Supabase only) `select public.mark_document_paid('<id>')`
      on an Approved `INVOICE`/`TAX_INVOICE`/`QUOTATION`/`CREDIT_NOTE`
      raises "บันทึกชำระเงินได้เฉพาะใบเสร็จรับเงินเท่านั้น" — see
      `docs/rls-policy-notes.md` step 14 for the full cascade verification

### Production readiness fix: conversion still allowed after PAID

> Continuing from the same chain above (`INVOICE` already `PAID` via its
> `RECEIPT`).

- [ ] On the now-`PAID` `INVOICE`'s detail page, "แปลงเอกสาร" is still
      visible (previously disappeared entirely once the invoice left
      `APPROVED`) — clicking it lists only the target types not yet
      created from this invoice (e.g. if `RECEIPT` already exists,
      only `TAX_INVOICE` is offered; once both exist, the button
      disappears since there's nothing left to convert to)
- [ ] Converting the `PAID` invoice to the missing type (e.g.
      `TAX_INVOICE`) succeeds exactly like converting an `APPROVED`
      source — creates a `DRAFT` with `sourceDocumentId` pointing back at
      the invoice; approving it works normally and gives it its own
      document number
- [ ] The newly-created document stays `APPROVED` after approval (not
      auto-`PAID`) — a known, documented limitation, see
      `docs/rls-policy-notes.md`'s `create_document_conversion` section
- [ ] A `DRAFT` or `CANCELLED` source document still cannot be converted
      — "แปลงเอกสารได้เฉพาะเอกสารที่อนุมัติแล้วหรือชำระแล้วเท่านั้น"
- [ ] "บันทึกว่าชำระแล้ว" still never appears on the `INVOICE` or
      `TAX_INVOICE` at any point in this flow — payment is only ever
      recorded through a `RECEIPT`/`RECEIPT_TAX_INVOICE`
- [ ] `[ ]` (real Supabase only) `select
      public.create_document_conversion('<paid-invoice-id>', 'TAX_INVOICE')`
      succeeds — see `docs/rls-policy-notes.md` step 15

## Privacy / PDPA (Phase 1E) — testable now

> Register/onboard first if you haven't (see Phase 1A/1C above). Test in a
> fresh browser profile or `localStorage.clear()` between runs so leftover
> accounts from earlier phases don't interfere.

- [ ] Settings > ความเป็นส่วนตัว shows the 4 data-storage bullets (Supabase
      AWS Singapore region, HTTPS/TLS, passwords never stored as plaintext,
      PDF downloads are not uploaded by default)
- [ ] "Export ข้อมูลเป็น JSON" downloads a `.json` file and shows a success
      toast; opening it shows `profile`, `company`, `members`, `auditLogs`,
      `customers`, and `documents` — the latter two reflect your actual
      saved data in both modes (via `listCustomers()`/`listDocuments()`),
      not a static demo fixture
- [ ] As the Owner, the export includes `invitations`; as a non-owner
      member, `invitations` is empty and a note in the file explains why
      (invitations are owner-only)
- [ ] Export logs an `EXPORT_DATA_JSON` audit event — check `audit_logs`
      in real mode, or `finvizer_mock_audit_logs` in Mock Mode (Phase 6A
      added a persisted Mock Mode audit trail; see the document detail
      page's "ประวัติกิจกรรม" timeline for the same data rendered)
- [ ] "ลบบัญชีของฉัน" opens a dialog showing the exact required warning:
      "การลบบัญชีนี้จะลบบริษัท เอกสาร ลูกค้า และสิทธิ์การเข้าถึงของผู้ใช้งานร่วมทั้งหมดอย่างถาวร
      ไม่สามารถกู้คืนได้"
- [ ] The confirm button ("ลบบัญชีถาวร") stays disabled until the input
      exactly matches `DELETE`
- [ ] As a non-owner member, the dialog additionally explains that only
      your own account/access will be removed, not the company
- [ ] Confirming as the **Owner**: the company, every member's access, and
      every invitation are gone; you're signed out and redirected to
      `/login`; a second owner's separately-created company/account is
      unaffected
- [ ] Confirming as a **non-owner member**: only your own account and
      membership are removed; the company, the owner, and any other
      members are untouched; you're redirected to `/login`
- [ ] `[ ]` (real Supabase only) Delete Account runs through the
      `delete-account` Edge Function using `service_role` — never a direct
      client DB call or the `service_role` key in frontend code (see
      `docs/rls-policy-notes.md` "RPCs that bypass RLS")
- [ ] `[ ]` (real Supabase only) After Owner deletion, the company row
      still exists with `deleted_at`/`deleted_by` set (soft delete, not
      hard delete) but is unreachable — `getCurrentCompanyForUser` filters
      `deleted_at is null`
- [ ] `[ ]` (real Supabase only) `DELETE_ACCOUNT_REQUESTED` and
      `DELETE_ACCOUNT_COMPLETED` audit_logs rows exist after deletion, and
      any of the deleted user's earlier audit_logs rows still exist with
      `actor_id` anonymized to `null`

## Production readiness pass 2: logo, templates, signatures, installments, safe deletion — testable now

> None of this pass touches the paid-status cascade, conversion-after-PAID
> logic, dashboard accounting, or quotation tracking from the sections
> above — re-run the relevant checks above once at the end of this pass to
> positively confirm zero regression, not just "we didn't touch the file."

### Company logo

- [ ] Settings > ข้อมูลบริษัท shows a dashed upload placeholder when no logo
      is set yet
- [ ] Uploading a PNG/JPEG/SVG/WEBP under the size limit (2MB real mode /
      500KB Mock Mode) shows the new logo immediately in Settings, in the
      document preview (next to the company name), and in an exported PDF
- [ ] Uploading a file over the size limit or an unsupported type is
      rejected client-side with a Thai error message — nothing is
      uploaded/saved
- [ ] Removing the logo clears it from Settings, the document preview, and
      newly-exported PDFs — the layout stays clean (no broken image, no
      leftover gap)
- [ ] `[ ]` (real Supabase only) The uploaded file appears under the
      public `company-logos` Storage bucket at `${company_id}/logo.<ext>`;
      a second company cannot overwrite the first company's logo (owner-
      scoped `storage.objects` RLS policies)

### Document templates (3rd template: Minimal Print)

- [ ] Settings > Template เอกสาร now lists 3 templates: Executive Classic,
      Modern Accent, and Minimal Print
- [ ] Selecting Minimal Print re-renders the on-screen document preview
      with a plain white header/black text/black border style (no color
      fill) — distinct from the other two
- [ ] An exported PDF under Minimal Print matches the on-screen preview's
      look; the grand-total box text is clearly legible (not white-on-
      white)
- [ ] Switching back to Executive Classic or Modern Accent renders
      pixel-equivalent to before this pass (regression check — these two
      templates' colors were not changed, only extracted into a shared
      file)

### Signature configuration

- [ ] A company that has never visited Settings > ลายเซ็นเอกสาร still shows
      ผู้ซื้อ/ผู้ขาย signature boxes on every document preview and PDF
      export, with zero setup required
- [ ] Settings > ลายเซ็นเอกสาร (Owner only) pre-populates ผู้ซื้อ/ผู้ขาย as
      editable rows when the company has no saved configuration yet
- [ ] Adding extra slots (e.g. ผู้จัดทำ, ผู้ตรวจสอบ, ผู้อนุมัติ, ผู้จัดการฝ่ายขาย),
      reordering, relabeling, and removing down to a minimum of 1 slot all
      work and persist after Save
- [ ] After saving a custom configuration, every document's preview and
      PDF export reflects the exact same slots/order/labels — no more
      hardcoded ผู้จัดทำเอกสาร/ผู้อนุมัติ boxes
- [ ] A non-owner member sees the page read-only (cannot edit/save)
- [ ] Saving logs an `UPDATE_SIGNATURE_SLOTS` audit event

### Installment payment terms

- [ ] Creating/editing a Draft shows "เงื่อนไขการชำระเงิน" defaulting to
      "ชำระเต็มจำนวน" — switching to "แบ่งชำระเป็นงวด" reveals the installment
      row editor
- [ ] Adding installment rows (percent or fixed amount, due date, note)
      shows each row's computed baht amount live, and the document preview
      renders an installment table between line items and totals
- [ ] Installment rows summing to less than 100% (a deposit-only plan) are
      allowed; rows summing to over 100% show a warning and block saving
- [ ] Saved installment rows survive a page reload — re-opening the Draft
      for editing shows the exact same rows
- [ ] Both the on-screen detail page and the exported PDF show the
      installment table when installments exist, and show nothing extra
      when they don't (Full-payment documents look exactly as before this
      pass)
- [ ] Switching a Draft with installment rows back to "ชำระเต็มจำนวน" and
      saving clears all of its installment rows

### Installment-aware conversion (assisted single-step)

> Requires an Approved/Paid source document (e.g. a QUOTATION) that has
> installment rows.

- [ ] The "แปลงเอกสาร" dialog on a source document with installment rows
      shows an extra "สำหรับงวดที่..." picker, defaulting to "ไม่ระบุ
      (คัดลอกยอดเต็มจำนวนตามปกติ)"
- [ ] Leaving the picker on the default and confirming behaves exactly as
      before this pass — the new Draft copies the source's full amount
      unchanged
- [ ] Picking a specific installment and confirming opens the new Draft's
      edit form pre-filled with a single line item ("งวดที่ {n} ตามเอกสาร
      ต้นทาง") at that installment's computed amount, with the document-
      level discount reset to zero — fully editable before saving
- [ ] `[ ]` Confirm via the mock/real conversion call that no installment
      info was ever passed into it — `create_document_conversion`/
      `createDocumentConversion` always receives exactly the same 3
      arguments as before this pass, and the created Draft's initial
      `grand_total` always equals the source's full amount (the picked-
      installment pre-fill happens only afterward, client-side, on the
      edit form)

### Safe document deletion

- [ ] A `DRAFT` document's detail page shows both "แก้ไข" and a "ลบฉบับร่าง"
      button (danger-styled) next to it
- [ ] Clicking "ลบฉบับร่าง" opens a confirmation dialog explaining the
      deletion is permanent and irreversible; confirming deletes the Draft
      and navigates back to `/documents`
- [ ] The delete logs a `DELETE_DOCUMENT_DRAFT` audit event before the
      document (and its audit trail) is gone
- [ ] `APPROVED`/`PAID`/`CANCELLED` documents show no delete button at
      all — only "ยกเลิกเอกสาร" (cancel/void) where applicable, which now
      has a tooltip clarifying that a numbered document can only be
      cancelled, not deleted
- [ ] Deleting a Draft that has installment rows also removes those rows
      (no orphaned data) — confirmed via the Draft's own `document_id`
      scoping, never affecting another document's rows
- [ ] Deleting a Draft does not affect any other document's number,
      conversion chain, or the Dashboard's totals — re-check the Dashboard
      after deleting a Draft that was never approved (it should show no
      change, since a Draft was never counted anywhere)

## Responsive / Mobile (ongoing)

- [ ] `[ ]` All primary flows (login, dashboard, document list, document
      form, settings) are usable at 375px width
- [ ] `[ ]` Tables/lists degrade to stacked cards or horizontal scroll on
      mobile, no clipped content
- [ ] `[ ]` Touch targets (buttons, menu items) are large enough on mobile
