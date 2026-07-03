# Supabase Setup

FinVizer works without Supabase — leave `.env.local` unset and the app runs in
**Mock Mode** (simulated auth, company, customers, and documents, with a
"Mock Mode: ยังไม่ได้เชื่อมต่อ Supabase" banner). This guide is for connecting
a real Supabase project once you're ready.

## Quick checklist

Follow top to bottom, once, for a brand-new project. Each step links to
its detailed section below.

- [ ] **1.** Create a Supabase project in the Singapore region (§1)
- [ ] **2.** Copy the Project URL + anon key into `.env.local` (§2–3)
- [ ] **3.** Apply all 15 migrations in `supabase/migrations/`, **in
      filename order**, via `supabase db push` or the SQL Editor (§4) —
      never skip or reorder one, later migrations reference functions/
      columns earlier ones create
- [ ] **4.** Confirm RLS is enabled everywhere:
      `select tablename, rowsecurity from pg_tables where schemaname = 'public' and rowsecurity = false;`
      must return **zero rows** (§4)
- [ ] **5.** (Optional but recommended) Regenerate
      `src/types/database.ts` from the live schema:
      `supabase gen types typescript --linked > src/types/database.ts` (§4)
- [ ] **6.** Deploy the `delete-account` Edge Function:
      `supabase functions deploy delete-account` (§5)
- [ ] **7.** Configure Authentication > URL Configuration (Site URL +
      Redirect URLs for every environment you use) (§6)
- [ ] **8.** Decide on email confirmation — off for local dev, on before
      going live (§7)
- [ ] **9.** Restart `npm run dev` (or rebuild) — the "Mock Mode" banner
      should disappear
- [ ] **10.** Work through every `[ ]` (real Supabase only) item in
      [docs/manual-test-checklist.md](manual-test-checklist.md) and every
      numbered manual-verification step in
      [docs/rls-policy-notes.md](rls-policy-notes.md#manual-verification-needs-a-real-supabase-project)
      — this is the only way any of it has been tested; every phase of
      this project was built and browser-verified against Mock Mode only

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Choose region **Southeast Asia (Singapore)** (`ap-southeast-1`) to keep
   latency low for Thai users and to satisfy the PDPA data-location
   disclosure this app makes in Settings > Privacy & Data.
3. Set a strong database password and store it in a password manager — it is
   not needed by the frontend, only for direct DB access (e.g. via `psql` or
   the SQL editor).

> Claude Code does not create Supabase projects automatically. Project
> creation, migrations, RLS policies, and Edge Functions are prepared as
> files in this repo (`supabase/migrations`, `supabase/functions`) for you
> to review and apply yourself, or via the Supabase CLI once you provide
> your own access token.

## 2. Get your API credentials

In your Supabase project dashboard: **Project Settings > API**.

- **Project URL** → `VITE_SUPABASE_URL`
- **anon / publishable key** → `VITE_SUPABASE_ANON_KEY`

Never use the **service_role** key here. It must only ever be used inside
Supabase Edge Functions (server-side), never in frontend code or committed
to git.

## 3. Configure the app

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Restart `npm run dev` after changing env vars. `.env.local` is gitignored.

## 4. Apply migrations

Database schema, Row Level Security policies, and helper functions ship as
SQL files under `supabase/migrations/`. Apply them either via:

- **Supabase CLI**: `supabase link` then `supabase db push`, or
- **SQL Editor**: paste each migration file's contents in, **in filename
  order** (they're numbered and depend on each other — e.g. the RLS
  policies migration calls helper functions defined in the one before it).

### Phase 1B migrations (profiles, companies, members, invitations, audit log)

| File | What it does |
| --- | --- |
| `20260702120000_extensions_and_enums.sql` | `member_role`, `member_status`, `invitation_status`, `document_template` enums |
| `20260702120100_tables.sql` | `profiles`, `companies`, `company_members`, `invitations`, `audit_logs` + indexes + `updated_at` triggers |
| `20260702120200_auth_trigger.sql` | Auto-creates a `profiles` row when a user signs up (reads `display_name` from the metadata Register sends) |
| `20260702120300_rls_helper_functions.sql` | `is_company_member`, `has_company_role`, `is_company_owner` |
| `20260702120400_rls_policies.sql` | Enables RLS and adds policies + grants on all 5 tables |

### Phase 1C migration (Company Onboarding)

| File | What it does |
| --- | --- |
| `20260703120000_create_company_with_owner.sql` | `create_company_with_owner(...)` RPC — atomically inserts the company and the caller's OWNER `company_members` row in one transaction. `security invoker`, so it still goes through the RLS policies above; it just wraps both inserts so a failure on the second rolls back the first. Called from `src/lib/supabase/company.ts`'s `createCompany()`. |

### Phase 1D migration (Member Invitation & Roles)

| File | What it does |
| --- | --- |
| `20260704120000_accept_invitation.sql` | `accept_invitation(p_token_hash)` RPC — validates the token hash, expiry, invited-email match, and "not already in another company", then atomically creates the ACTIVE `company_members` row and marks the invitation `ACCEPTED`. `security definer` (unlike the Phase 1C RPC): the invited user isn't the company owner, so it intentionally bypasses `invitations`/`company_members` RLS after re-validating everything itself. Called from `src/lib/supabase/invitations.ts`'s `acceptInvitation()`. |

Invitation creation itself (`createInvitation()`) doesn't need an RPC — it's
a plain `insert` into `invitations` that already goes through the
`invitations_insert_owner_within_limit` RLS policy from Phase 1B. The raw
invite token is generated and SHA-256-hashed entirely client-side
(`src/lib/utils/inviteToken.ts`); only the hash is ever sent to Supabase, in
both directions (creation and acceptance) — the server never sees the raw
token.

### Phase 1E migration (Privacy, Export JSON & Delete Account)

| File | What it does |
| --- | --- |
| `20260705120000_account_deletion_support.sql` | Relaxes `companies.owner_id`, `companies.deleted_by`, and `audit_logs.actor_id` from a plain foreign key to `on delete set null`. Hard-deleting a user's `auth.users` row (via the `delete-account` Edge Function below) would otherwise fail with a foreign key violation for any company they own or any audit log row they authored — this lets those references be anonymized instead of blocking the deletion. No RPC is added by this migration; it only changes constraint behavior. |

This migration doesn't add an RPC because account deletion needs
`service_role` (to call the Auth Admin API and hard-delete the
`auth.users` row) — see the Edge Function in section 5 below instead.

### Phase 2B migration (Document Numbering Settings)

| File | What it does |
| --- | --- |
| `20260706120000_numbering_settings.sql` | `numbering_reset_policy` enum (`DAILY`/`MONTHLY`/`YEARLY`/`NEVER`) and the `numbering_settings` table — stores each company's numbering *configuration* (pattern + reset policy) only. One row with `document_type = null` is the company-wide default; additional rows with a specific `document_type` override it for that type. Two partial unique indexes enforce at most one default and at most one override per type. RLS: any active member can `select`, only the owner can `insert`/`update`/`delete`. |

This migration does **not** implement actual document-number *generation*
(the atomic running counter used when a Draft is approved) — that's Phase
2C, which will read this table's configuration as input to its own
RPC/Edge Function. Phase 2B only lets the Owner configure the pattern and
reset policy; no `document_number` is ever assigned by this phase, in
Mock Mode or real Supabase.

### Phase 2C migration (Document Number Generation Backend)

| File | What it does |
| --- | --- |
| `20260707120000_document_numbering_generation.sql` | A minimal `documents` table (no line items/VAT/customer FK — just enough to test numbering: type, status, optional `customer_code`, `document_number`), a `numbering_sequences` running-counter table, a `render_numbering_pattern()` SQL helper, and the `approve_document(p_document_id)` RPC that assigns the official number when a Draft is approved. |

**Why an RPC, not an Edge Function**: this is a pure database transaction
(read `numbering_settings`, atomically increment a counter, write
`documents` + `audit_logs`) with no need for `service_role`, the Auth
Admin API, or any external call — a `security definer` PL/pgSQL function
is transaction-safe and simpler to reason about than an Edge Function
here, per the master spec's own preference for RPC when suitable.

**`documents` is intentionally immutable outside this RPC**: there is no
`UPDATE` grant *or* policy on the table at all, so no direct client call —
authorized or not — can ever set `status` or `document_number`. Only
`approve_document()`'s elevated privileges can, exactly once per document
(`status <> 'DRAFT'` check blocks re-approval).

**How numbering actually generates a number**:
1. Re-validates the caller has `OWNER`/`ADMIN`/`ACCOUNTANT` role in the
   document's company (`has_company_role`) and that the document is still
   `DRAFT`.
2. Resolves the effective `numbering_settings` row — a `document_type`
   override if one exists, else the company-wide default — and errors
   clearly if neither exists yet.
3. If the pattern uses `{CUSTOMER_CODE}`, requires the document to have
   one set (the Phase 2B UI already warns about this; this is the
   backend enforcement of that same rule).
4. Derives `sequence_key` from `reset_policy` (`YYYYMMDD`/`YYYYMM`/`YYYY`/a
   constant), then atomically increments the matching
   `numbering_sequences` row via `insert ... on conflict do update`,
   which takes a row lock and so safely serializes concurrent approvals
   for the same company+type+bucket without an explicit advisory lock.
5. Renders the pattern via `render_numbering_pattern()` — a hand-written
   mirror of `src/lib/validations/numberingPattern.ts`'s
   `renderPatternPreview()`, since Postgres has no regex-replace-with-
   callback; the two must be kept in sync by hand if the token set ever
   changes.
6. Writes `status = 'APPROVED'`, `document_number`, `approved_by`,
   `approved_at`. On a `unique_violation` (the `documents_number_unique`
   constraint), retries up to 3 times — each retry's `on conflict do
   update` advances `running_number` past the collision automatically.
7. Logs `DOCUMENT_NUMBER_GENERATED` and `APPROVE_DOCUMENT` to
   `audit_logs` itself (unlike `accept_invitation`, which leaves audit
   logging to the caller — see `docs/rls-policy-notes.md` for why this
   one logs server-side instead).

Mock Mode mirrors every step of this above (`src/lib/mock/mockDocuments.ts`,
`src/lib/mock/mockNumberingSequences.ts`) against `localStorage`, so
Drafts, approval, sequence resets, and collision retries all work
identically with no Supabase project connected — see
`docs/manual-test-checklist.md`.

### Phase 3A migration (Customer Management)

| File | What it does |
| --- | --- |
| `20260708120000_customers.sql` | The `customers` table — `customer_code`, `name`, `tax_id`, `branch`, `address`, `phone`, `email`, `contact_name`, `note`, plus `deleted_at`/`deleted_by` for soft delete. A partial unique index enforces `customer_code` uniqueness only among a company's *active* customers, so a deleted customer's code can be reused. No RPC — every write is a plain RLS-covered insert/update. |

No Edge Function or RPC is needed for this phase: creating, editing, and
soft-deleting a customer are all ordinary role-checked
insert/update operations (see `docs/rls-policy-notes.md`), unlike Phase
2C's document approval which needed an atomic counter and therefore a
`security definer` RPC. Soft delete is just another `UPDATE` — there is no
`DELETE` grant on this table at all, so a customer can never be hard-
deleted by a client regardless of role.

### Phase 4A migration (Document Draft Management)

| File | What it does |
| --- | --- |
| `20260709120000_document_drafts.sql` | Extends the Phase 2C `documents` table with everything a real Draft needs: `customer_id` (FK to `customers`), `vat_mode`, `issue_date`, `due_date`, `note`, `document_discount_type`/`document_discount_value`, and the computed `subtotal`/`discount_total`/`vat_amount`/`grand_total`. Adds a scoped `documents_update_draft_only` UPDATE policy (Draft-only, `status`/`document_number` pinned). Creates `document_items` (line items: description, quantity, unit, unit_price, discount_type, discount_value, amount, sort_order) with RLS joined through `documents` — every write requires the parent document to still be `DRAFT`. |

**Why editing was previously impossible and now isn't**: Phase 2C
deliberately shipped `documents` with no UPDATE grant/policy at all, since
nothing needed to edit a Draft yet and `document_number`/`status` needed
to stay untouchable outside `approve_document()`. This migration adds
exactly one narrowly-scoped UPDATE path: `status = 'DRAFT'` on both sides
of the policy (so it can never itself move a document out of Draft), and
`document_number is null` in the `with check` (so it can never assign a
number either). `approve_document()` remains the only way either of those
two columns ever changes — see `docs/rls-policy-notes.md`.

**No RPC needed for saving**: unlike Phase 2C's atomic number generation,
saving a Draft (with or without line items) has no concurrency/collision
concern — it's a plain calculation (via
`src/lib/calculations/documentTotals.ts`) followed by an ordinary
RLS-covered `insert`/`update`. Real mode does two round trips (the
`documents` row, then replacing `document_items`) rather than a single
transaction — see the code comment in `src/lib/supabase/documents.ts` for
the tradeoff this accepts.

### Phase 4B migration (Approve, Official Number & Immutability)

| File | What it does |
| --- | --- |
| `20260710120000_document_status_actions.sql` | Two `security definer` RPCs, `mark_document_paid(p_document_id)` (`APPROVED -> PAID`) and `cancel_document(p_document_id)` (`APPROVED -> CANCELLED`), each granted to `authenticated` only and each self-logging its own audit event (`MARK_DOCUMENT_PAID` / `CANCEL_DOCUMENT`). |

**Why two more RPCs instead of reusing `approve_document`'s UPDATE path**:
`documents` still has no UPDATE grant for non-Draft rows — Phase 4A's
`documents_update_draft_only` policy only ever matches `status = 'DRAFT'`
rows, so an `APPROVED` document is just as unreachable to a direct client
UPDATE as it was before. Rather than widen that policy (which would risk
loosening the Draft-only invariant it exists to enforce), Phase 4B adds
two more narrowly-scoped `security definer` functions, following
`approve_document`'s exact shape: role-check (`OWNER`/`ADMIN`/`ACCOUNTANT`
— same list, `EDITOR` cannot approve/mark paid/cancel), status-check, then
a single-column `UPDATE` plus one `audit_logs` insert, all in one
transaction.

**Why `cancel_document` only accepts `APPROVED`, not `DRAFT` or `PAID`**:
a `DRAFT` is discarded via the existing `documents_delete_draft_only`
policy instead — it never had an official number to void, so "cancel"
doesn't apply. A `PAID` document is treated as final; correcting a paid
document is a future-phase credit-note concern, not a status flip back to
`CANCELLED`.

Mock Mode mirrors both RPCs' validation (`markMockDocumentPaid`/
`cancelMockDocument` in `src/lib/mock/mockDocuments.ts`) against
`localStorage`. At the time this phase shipped, Mock Mode audit logging
was a pure no-op (nothing read it back yet) — Phase 6A changed that (see
the Phase 6A section below), and these two functions now self-log the
same way the real RPCs do.

### Phase 4C migration (Document Revision)

| File | What it does |
| --- | --- |
| `20260711120000_document_revisions.sql` | Adds `parent_document_id` (FK back to `documents`, revisions only) and `revision_no` (null until approved) columns plus a defensive `unique (parent_document_id, revision_no)` constraint. Tightens `documents_insert_editors` to require `parent_document_id is null`, so a revision can only come from the new `create_document_revision(p_document_id)` RPC. Extends `approve_document(p_document_id)` (same function, `create or replace`) to branch: a revision Draft skips the numbering-pattern path entirely and instead derives `document_number` as `"PARENT_NUMBER-R{n}"`. |

**A revision is just a `documents` row with `parent_document_id` set** —
same table, same `DRAFT -> APPROVED` lifecycle, same Phase 4B
`PAID`/`CANCELLED` transitions available afterward. This is why editing a
revision Draft needed **zero new code**: Phase 4A's
`saveDraftDocument()`/`DocumentForm` flow already works on any row where
`status = 'DRAFT'`, and the `documents_update_draft_only` policy never
looks at `parent_document_id`.

**Why `create_document_revision` is its own RPC instead of a plain
client insert**: the ordinary Draft-creation INSERT policy has no way to
safely validate "the source is APPROVED, belongs to my company, and is
itself not a revision" *and* copy a whole row + its line items atomically
— and critically, without a `security definer` function, nothing stops a
client from setting `parent_document_id` to an arbitrary id (including
another company's document, or a Draft) on a raw insert. Phase 4C closes
that gap two ways at once: the RLS policy now flatly forbids
`parent_document_id` on any client-authored insert, and the RPC is the
only path that can ever produce one, having independently re-validated
everything the master spec asks for (source is `APPROVED`, source has no
parent of its own).

**Why `approve_document` was extended instead of adding a separate
`approve_revision` RPC**: the master spec's instruction to "use existing
document approval / numbering backend-safe flow where appropriate" — a
revision's Draft-to-Approved transition needs the exact same role/status
checks and the exact same immutability guarantee as an ordinary document,
just a different way of computing the number. One function with a branch
keeps that guarantee in one place rather than two functions that could
drift apart.

**Why `PAID` documents can't be revised**: documented in
`docs/rls-policy-notes.md`'s `create_document_revision` section — in
short, a paid document represents settled money, and revising it without
a correction/credit-note workflow (not built yet) risks silently
misrepresenting what was actually collected. Only `APPROVED` (not `PAID`,
not `CANCELLED`, not `DRAFT`) can be revised in this phase.

Mock Mode mirrors this entirely (`createMockDocumentRevision`,
`listMockDocumentRevisions`, and a revision branch inside
`approveMockDraftDocument`, all in `src/lib/mock/mockDocuments.ts`)
against `localStorage`.

### Phase 6A migration (Document Conversion) + Mock Mode audit logging change

| File | What it does |
| --- | --- |
| `20260712120000_document_conversion.sql` | Adds `source_document_id` (FK back to `documents`, set only on a converted document). Adds `is_valid_document_conversion(from, to)`, a SQL mirror of `src/types/document.ts`'s `documentConversionMap` DAG (RFQ -> QUOTATION -> INVOICE -> {RECEIPT, TAX_INVOICE} -> {RECEIPT_TAX_INVOICE, CREDIT_NOTE, CREDIT_NOTE_TAX}, no edge ever points backwards, so no conversion loop is possible). Adds `create_document_conversion(p_document_id, p_target_type)`, a `security definer` RPC that copies customer/items/VAT mode/note/due_date/totals from an `APPROVED` source into a new Draft of the target type, self-logging `CONVERT_DOCUMENT`. |

**Conversion vs revision — same table, independent lineage columns**: a
converted document is an ordinary `documents` row like a revision is,
reusing the identical Draft-editing and approve/paid/cancel machinery
with zero new code. The two lineage columns never interact:
`parent_document_id` is always null on a conversion, `source_document_id`
is always null on a revision. See `docs/rls-policy-notes.md` for why
`source_document_id`, unlike `parent_document_id`, isn't blocked by the
ordinary insert policy (it's informational lineage, not something
immutability logic ever reads).

**Mock Mode audit logging is no longer a no-op.** Every phase through
4C treated Mock Mode's `logAuditEvent()` as a pure no-op — nothing ever
read the entries back, so there was no reason to persist them. Phase
6A's document detail page adds a real activity timeline
(`create_document_revision`/`approve_document`/`mark_document_paid`/
`cancel_document`/`create_document_conversion` events, plus
`CREATE_DOCUMENT_DRAFT`/`UPDATE_DOCUMENT_DRAFT`/`EXPORT_DOCUMENT_PDF`
logged directly by the relevant pages), which needs something to read in
Mock Mode too — this project's browser verification has only ever run
against Mock Mode, with no real Supabase project available. `logAuditEvent()`
now persists to `localStorage` (`finvizer_mock_audit_logs`, see
`src/lib/mock/mockAuditLogs.ts`) when `isMockMode` is true, and the mock
document-mutation functions that mirror a self-logging real RPC
(`approveMockDraftDocument`, `markMockDocumentPaid`, `cancelMockDocument`,
`createMockDocumentRevision`, `createMockDocumentConversion`) now call it
directly, exactly mirroring what their real RPC counterparts do
server-side. Settings > Audit Log (Phase 1D) is unaffected — it still
shows its own separate static Thai demo data, since only the document
timeline was asked to read real entries this phase.

After applying, verify with:

```sql
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and rowsecurity = false;
```

This should return **zero rows** — if any Phase 1B table appears, RLS isn't
enabled on it and that migration didn't apply cleanly.

See [docs/rls-policy-notes.md](rls-policy-notes.md) for what each policy
allows/blocks and how to test it manually (this can't be covered by
`npm run test` — it needs a real Postgres connection).

Once migrations are applied, regenerate accurate TypeScript types (this repo
currently ships a hand-written equivalent at `src/types/database.ts` that
matches the migrations exactly):

```bash
supabase gen types typescript --linked > src/types/database.ts
```

## 5. Deploy Edge Functions

Privileged operations (document number generation from Phase 2C onward,
account deletion now) run as Edge Functions under `supabase/functions/`,
since they need the `service_role` key, which must never reach the
frontend.

### `delete-account` (Phase 1E)

Settings > Privacy & Data's "ลบบัญชีของฉัน" calls this via
`supabase.functions.invoke('delete-account')`
(`src/lib/supabase/account.ts`). It verifies the caller's JWT itself (never
trusts a client-supplied user id), then:

- **Owner**: soft-deletes their company (`deleted_at`/`deleted_by`, already
  filtered out by `getCurrentCompanyForUser`'s `.is('deleted_at', null)`),
  hard-deletes every `company_members` and `invitations` row for it — this
  is what revokes every invited user's access — then hard-deletes the
  owner's own `auth.users` row.
- **Non-owner**: hard-deletes only their own `company_members` row, then
  their own `auth.users` row. The company and every other member are
  untouched.

Deploy it with:

```bash
supabase functions deploy delete-account
```

No manual secrets setup is needed — `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
and `SUPABASE_SERVICE_ROLE_KEY` are automatically available to every
deployed Edge Function as default secrets. The function reads all three via
`Deno.env.get(...)`; only `SUPABASE_SERVICE_ROLE_KEY` ever leaves this
server-side runtime, and it's never present in any frontend build or
`.env.local`.

Apply the Phase 1E migration (`20260705120000_account_deletion_support.sql`,
see section 4 above) **before** deploying this function — without it, the
final `auth.users` deletion step fails with a foreign key violation.

## 6. Auth URL configuration (required for password reset & email confirmation links)

In **Authentication > URL Configuration**:

- **Site URL**: the deployed app URL (e.g. `https://your-user.github.io/finvizer/`
  for GitHub Pages, or `http://localhost:5173/` for local dev).
- **Redirect URLs**: add both the login and reset-password paths for every
  environment you use, e.g.:
  - `http://localhost:5173/login`
  - `http://localhost:5173/reset-password`
  - `https://your-user.github.io/finvizer/login`
  - `https://your-user.github.io/finvizer/reset-password`

  The app builds these redirect URLs itself (`src/lib/supabase/auth.ts`)
  from `window.location.origin` + the Vite `base` path, so they only need to
  be *allow-listed* here, not hardcoded elsewhere.

## 7. Email verification

- **Development**: leave email confirmation off in Authentication > Providers
  > Email so you can test signup/login quickly. The app already handles the
  "confirmations required" case if you turn it on — sign-up will show a
  "check your email" screen with a resend button instead of logging the
  user in immediately.
- **Production**: turn email confirmation on before going live.
- Password reset emails (Forgot Password) work the same regardless of this
  setting — Supabase always emails a recovery link.

## Mock Mode auth (no Supabase project needed)

Without `.env.local`, Register/Login/Logout/Forgot/Reset Password all work
against a small local user store instead of Supabase:

- Accounts are saved in `localStorage` (`finvizer_mock_auth_users`), with
  passwords salted and SHA-256 hashed — never stored as plaintext, same
  discipline as the real backend.
- Accounts are auto-confirmed (Mock Mode can't send real email), so sign-up
  logs you in immediately instead of showing a "check your email" screen.
- Forgot Password doesn't send an email; it hands the target address to the
  Reset Password page via `sessionStorage` so the flow is still testable
  end-to-end in one browser tab.
- Clearing site data / localStorage resets all mock accounts.

This is local-only simulation for development and demos — it is not a
substitute for real Supabase Auth and must never be used in production.

## Security notes

- Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are ever read by the
  frontend (see `src/lib/supabase/client.ts`).
- Row Level Security is enabled on every table; the anon key alone cannot
  read or write data outside policy rules.
- All traffic between the browser, GitHub Pages, and Supabase runs over
  HTTPS/TLS. Data at rest is encrypted per Supabase/AWS infrastructure.
