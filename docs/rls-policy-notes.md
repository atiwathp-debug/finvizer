# RLS Policy Notes (Phase 1B)

Row Level Security is enabled on every table introduced so far: `profiles`,
`companies`, `company_members`, `invitations`, `audit_logs`. This doc
explains what each policy allows/blocks and why, plus how to verify it
manually against a real Supabase project — RLS can't be exercised by
`npm run test` since it needs a live Postgres connection with real
`auth.uid()` context, which this repo's Vitest suite doesn't have.

This doc also covers any `security definer` RPC that touches these tables,
since those functions run with elevated privilege and *are* the trust
boundary for whatever they do — `create_company_with_owner` (Phase 1C) isn't
listed since it's `security invoker` and only wraps two inserts that already
pass the policies below unchanged; `accept_invitation` (Phase 1D, see
[below](#rpcs-that-bypass-rls-security-definer)) is listed because it
deliberately bypasses them for the invited (non-owner) user.

## Helper functions

All three live in `20260702120300_rls_helper_functions.sql`, `security
definer` with `set search_path = public`:

- **`is_company_member(company_id)`** — true if the current user
  (`auth.uid()`) has an `ACTIVE` row in `company_members` for that company.
- **`has_company_role(company_id, allowed_roles[])`** — same, plus the
  member's `role` must be in `allowed_roles`. Not consumed by any Phase 1B
  policy yet — later phases (documents, numbering) use it for role-gated
  actions like Approve/Cancel.
- **`is_company_owner(company_id)`** — true if `companies.owner_id` for
  that company is the current user. Checked against `companies`, not
  `company_members`, so it's correct even before the bootstrap OWNER
  membership row exists.

`security definer` is what prevents infinite recursion: a normal (non
security-definer) subquery inside a `company_members` policy that queries
`company_members` would itself be subject to that same policy, forever.
`security definer` makes the function body run as its owner (which bypasses
RLS for its *internal* query), while the *caller's* access to
`company_members` is still fully governed by whichever policy invoked it.

## Table-by-table

### `profiles`

| Operation | Who | Notes |
| --- | --- | --- |
| SELECT | Self, or anyone sharing an active company with that profile | Lets the Members list show teammates' names/emails |
| INSERT | Nobody (client) | Only the `handle_new_user` trigger inserts, via `security definer` |
| UPDATE | Self only | `email` is set by the trigger from `auth.users`, not meant to drift independently — no app UI edits it yet |
| DELETE | Nobody (client) | Hard delete is an Edge Function (Phase 1E) using `service_role` |

### `companies`

| Operation | Who | Notes |
| --- | --- | --- |
| SELECT | Owner or any active member | |
| INSERT | Any authenticated user, **only if** they have zero existing `company_members` rows | DB-level backstop for "1 user = 1 company", on top of the app-level check in Phase 1C |
| UPDATE | Owner only | `with check (owner_id = auth.uid())` specifically blocks reassigning `owner_id` to someone else via a plain UPDATE — see the comment in the migration for why `is_company_owner()` alone wouldn't catch that |
| DELETE | Nobody (client), ever | Owner account deletion (Phase 1E) soft-deletes instead — see [RPCs that bypass RLS](#rpcs-that-bypass-rls-security-definer) |

### `company_members`

| Operation | Who | Notes |
| --- | --- | --- |
| SELECT | Any active member of that company | |
| INSERT | Only: inserting **your own** row, with `role = 'OWNER'`, into a company **you own**, when you have **no existing membership anywhere** | This is exactly the Phase 1C onboarding bootstrap. Inviting *other* users (Phase 1D) is a `security definer` RPC that validates the invite token — never a direct client insert — so there's deliberately no policy for that case yet |
| UPDATE | Owner only | Role/status changes for any member of their company |
| DELETE | Owner only | Removing a member |

`unique(user_id)` on this table is the hard enforcement of "1 email = 1
company" — the `companies` INSERT policy is a friendlier, earlier check,
but this constraint is what actually can't be bypassed.

### `invitations`

| Operation | Who | Notes |
| --- | --- | --- |
| SELECT | Owner only | An invited user never queries this table directly — Phase 1D's accept flow is a `security definer` RPC keyed by `token_hash` (see [RPCs that bypass RLS](#rpcs-that-bypass-rls-security-definer)), so `token_hash` is never exposed via a general SELECT |
| INSERT | Owner only, **and** `(active non-owner members) + (pending invites) < 2` | DB-level backstop for "max 2 invited emails"; the app checks this too before inserting |
| UPDATE | Owner only | Used to cancel (`status = 'CANCELLED'`) — there's no DELETE policy, so history stays intact |
| DELETE | Nobody | Cancel via UPDATE instead |

A partial unique index (`invitations_unique_pending_per_email`) also blocks
two simultaneous `PENDING` invites to the same email within one company.

### `audit_logs`

| Operation | Who | Notes |
| --- | --- | --- |
| SELECT | Any active member of that company | |
| INSERT | Any active member, **only as themselves** (`actor_id = auth.uid()`) into their own company | Lets the client log routine UI actions directly; privileged actions (document number generation, account deletion) are logged from inside their own `security definer` RPC / `service_role` Edge Function instead |
| UPDATE / DELETE | Nobody | No policy exists for either — the log is append-only by construction |

### `numbering_settings` — Phase 2B

| Operation | Who | Notes |
| --- | --- | --- |
| SELECT | Any active member of that company | Non-owners can see the current numbering configuration (read-only in the UI) |
| INSERT / UPDATE / DELETE | Owner only | Same shape as `companies`/company-level config — numbering is company policy, not a per-member preference |

No `security definer` function is needed for this table: every write here
is a straightforward owner-authenticated insert/update/delete that already
fits the standard policies above. This table stores *configuration* only
(pattern + reset policy) — Phase 2B never assigns a `document_number` to
anything, in either Mock Mode or real Supabase. The actual atomic,
collision-safe number-generation logic (needed once documents exist,
Phase 2C) will read this table as input, and is exactly the kind of
concurrent-write problem that *will* need a `security definer` RPC
(to serialize the running-counter increment) — see that phase's docs once
it lands.

Two partial unique indexes back the "one default + one override per type"
invariant: `numbering_settings_unique_default` (`where document_type is
null`) and `numbering_settings_unique_override` (`where document_type is
not null`). The frontend (`src/lib/supabase/numbering.ts`) upserts via a
select-then-insert-or-update instead of `.upsert()`, since postgrest-js's
`onConflict` option can't target a partial index directly.

### `documents` — Phase 2C, extended Phase 4A, Phase 4B, Phase 4C, and Phase 6A

| Operation | Who | Notes |
| --- | --- | --- |
| SELECT | Any active member of that company | |
| INSERT | `OWNER`/`ADMIN`/`ACCOUNTANT`/`EDITOR`, **only** as a brand-new Draft (`status = 'DRAFT'`, `document_number is null`, `parent_document_id is null`, `created_by = auth.uid()`) | `VIEWER` cannot create documents. Phase 4C added the `parent_document_id is null` condition — a direct client insert can never produce a revision-shaped row; only `create_document_revision()` can (see below). Phase 6A's `source_document_id` deliberately has **no** equivalent `is null` condition in this policy — see the note below the table |
| UPDATE | `OWNER`/`ADMIN`/`ACCOUNTANT`/`EDITOR`, **only** while `status = 'DRAFT'` on both sides of the update, and `document_number is null` in the `with check` | Phase 2C shipped this table with *no* UPDATE grant/policy at all (every column "immutable outside `approve_document()`"). Phase 4A added exactly this one narrowly-scoped path so Drafts can be edited — it can never itself move a document out of Draft or assign a number. Phase 4B's `APPROVED -> PAID`/`APPROVED -> CANCELLED` transitions, Phase 4C's revision-number assignment, and Phase 6A's conversion drafts still go through neither this policy nor any other client UPDATE path — `approve_document()`, `mark_document_paid()`, `cancel_document()`, and `create_document_conversion()` remain the *only* ways `status`/`document_number`/`revision_no`/`source_document_id` ever change (see [RPCs that bypass RLS](#rpcs-that-bypass-rls-security-definer)). This same policy is what makes a revision Draft *and* a conversion Draft editable via the ordinary Phase 4A `saveDraftDocument()`/`DocumentForm` flow with zero new code — it only ever checks `status = 'DRAFT'`, never `parent_document_id` or `source_document_id` |
| DELETE | `OWNER`/`ADMIN`/`ACCOUNTANT`/`EDITOR`, **only** while `status = 'DRAFT'` | Deleting a Draft is safe for numbering: Drafts never had a `document_number`, so nothing in `numbering_sequences` needs adjusting and no gap is possible. Cancelling an `APPROVED` document is a separate action (`cancel_document()`, Phase 4B) — once a document has an official number it is voided, never deleted, so the number itself is never reused. This applies to revisions and conversions too — an approved one is never deletable, only cancellable |

Phase 4C added two columns: `parent_document_id` (nullable FK back to
`documents`, set only on a revision, always pointing at the ORIGINAL —
never at another revision) and `revision_no` (nullable integer, assigned
only by `approve_document()`, mirroring `document_number`'s own
null-while-Draft convention). A defensive `unique (parent_document_id,
revision_no)` constraint backs this up the same way
`documents_number_unique` backs up `document_number` — see
`create_document_revision(p_document_id)` and the extended
`approve_document(p_document_id)` below.

Phase 6A added `source_document_id` (nullable FK back to `documents`,
set only on a document created via conversion — e.g. an `INVOICE`
converted to a `RECEIPT` — always pointing at the `APPROVED` source,
which has a *different* `document_type`). Unlike `parent_document_id`,
the ordinary `documents_insert_editors` policy does **not** forbid a
direct client insert from setting `source_document_id` — there's no
practical harm in a client-set `source_document_id` the way there would
be for `parent_document_id`/`document_number`/`status` (it's purely
informational lineage, never read by any numbering or immutability
logic), so `create_document_conversion()` exists for correctness and
convenience (atomically copying customer/items/totals and validating the
conversion graph server-side), not because a raw insert would otherwise
be unsafe. `is_valid_document_conversion(from, to)` is the SQL mirror of
`src/types/document.ts`'s `documentConversionMap` — kept in sync by hand.

Phase 2C's `documents` was intentionally minimal — no line items, VAT, or
a real customer relationship (just a plain `customer_code` text field for
the `{CUSTOMER_CODE}` numbering token). Phase 4A extended it with
`customer_id` (a real FK to `customers`), `vat_mode`, `issue_date`,
`due_date`, `note`, the document-level discount, and the computed
`subtotal`/`discount_total`/`vat_amount`/`grand_total` — `customer_code`
itself is untouched, still set alongside `customer_id` as a denormalized
snapshot the numbering system already reads directly, so
`approve_document()` needed no changes.

### `document_items` — Phase 4A

| Operation | Who | Notes |
| --- | --- | --- |
| SELECT | Any active member of the parent document's company | No `company_id` column here — every policy joins through `documents` (`exists (select 1 from documents d where d.id = document_items.document_id and ...)`), since that's the row that actually carries `company_id` and `status` |
| INSERT / UPDATE / DELETE | `OWNER`/`ADMIN`/`ACCOUNTANT`/`EDITOR`, **only** while the parent document's `status = 'DRAFT'` | This is what actually enforces "Approved/Paid/Cancelled documents are read-only" for line items, on top of the equivalent `documents_update_draft_only` policy on the parent row itself — once a document leaves Draft, every one of its items becomes uneditable too, with no separate mechanism needed |

Saving a Draft (`src/lib/supabase/documents.ts`'s `saveDraftDocument()`)
deletes all of a document's existing items and re-inserts the new set on
every save, rather than diffing — simpler, and safe specifically because
`document_items` has no independent identity anything else references
(unlike, say, `numbering_sequences`, which must never be recreated).

### `numbering_sequences` — Phase 2C

| Operation | Who | Notes |
| --- | --- | --- |
| SELECT | Any active member of that company | Lets anyone curious see the current running number per type/bucket |
| INSERT / UPDATE / DELETE | **Nobody** — no grant, no policy | Every write happens inside `approve_document()`'s security definer privileges; there is no legitimate direct-client write path at all |

### `customers` — Phase 3A

| Operation | Who | Notes |
| --- | --- | --- |
| SELECT | Any active member of that company | RLS doesn't filter `deleted_at` itself — same pattern as `companies` (Phase 1E) — the frontend's `listCustomers()` explicitly adds `.is('deleted_at', null)` for the normal active list |
| INSERT | `OWNER`/`ADMIN`/`ACCOUNTANT`/`EDITOR`, as themselves (`created_by = auth.uid()`) | Same role list as `documents` (Phase 2C) — `VIEWER` is read-only |
| UPDATE | `OWNER`/`ADMIN`/`ACCOUNTANT`/`EDITOR` | Covers both ordinary field edits **and** soft delete — setting `deleted_at`/`deleted_by` is just another UPDATE, not a separate action requiring its own policy or RPC |
| DELETE | **Nobody** — no grant, no policy | Hard delete is never possible for any role; soft delete via UPDATE is the only removal path, so historical documents (Phase 3B/4A onward) can still reference a customer that's since been removed from active use |

Unlike `documents`, no `security definer` RPC is needed here: there's no
atomic counter, no collision risk, and no "must become immutable after an
event" requirement — soft delete is just a normal role-checked UPDATE. A
partial unique index (`customers_unique_code_among_active`, `where
deleted_at is null`) keeps `customer_code` unique only among *active*
customers per company, so a deleted customer's code frees up for reuse —
same partial-index technique as `numbering_settings`' default/override
split (Phase 2B), applied here to a delete-state split instead of a
null-vs-not-null one.

## RPCs that bypass RLS (security definer)

This section also covers the one Edge Function that writes to these
tables (`delete-account`, Phase 1E) — it bypasses RLS the same way a
`security definer` function does (elevated privilege plus its own
imperative validation instead of a row-level policy), just via the
`service_role` key inside a Deno runtime instead of a Postgres function.

### `accept_invitation(p_token_hash)` — Phase 1D

Defined in `20260704120000_accept_invitation.sql`. `security definer` with
`set search_path = public`, granted to `authenticated` only.

**Why it has to bypass RLS**: the `company_members` INSERT policy (above)
only allows inserting your *own* OWNER row into a company *you own* — that's
the Phase 1C bootstrap case. An invited user is neither the owner nor
already a member, so no INSERT policy could authorize their row without
either (a) letting *any* authenticated user insert into *any* company's
members, which is unacceptable, or (b) encoding "this specific token was
issued for this specific email" into a row-level policy, which RLS isn't
well-suited to expressing. A `security definer` function that does its own
imperative validation is the standard escape hatch for exactly this shape
of problem.

**What it validates, in order, before touching any table** (each failure
raises a Thai-language exception the frontend surfaces via `mapAuthErrorMessage`-style handling in `InviteAcceptPage.tsx`):

1. A `PENDING` row exists in `invitations` with this exact `token_hash`.
   The function only ever receives the hash, never the raw token — see
   `src/lib/utils/inviteToken.ts` and the note in `docs/supabase-setup.md`
   section 4 — so even a full read of `invitations` (which owner-only SELECT
   already prevents) wouldn't let anyone reconstruct a usable token.
2. `expires_at` hasn't passed. If it has, the row is flipped to `EXPIRED`
   before raising, so a second lookup doesn't need to redo this check.
3. `auth.users.email` for the caller (`auth.uid()`), case-insensitively,
   matches `invited_email`. This is the "must accept with the invited
   email" requirement — enforced server-side, not just in the frontend
   form, since the frontend check alone would be trivially bypassable.
4. The caller has zero existing `company_members` rows anywhere (any
   status). This is the same "1 user = 1 company" invariant the
   `company_members.unique(user_id)` constraint and the `companies` INSERT
   policy enforce elsewhere — re-checked here because this function's own
   INSERT below doesn't go through the normal INSERT policy to catch it.

Only after all four pass does it insert the `ACTIVE` `company_members` row
and update the invitation to `ACCEPTED` with `accepted_at = now()`, in the
same transaction — so a crash between the two is impossible, unlike doing
this as two separate client-side calls.

**What it deliberately does NOT do**: it doesn't write to `audit_logs`.
That insert happens from `src/features/members/InviteAcceptPage.tsx` after
the RPC returns successfully, using the normal `audit_logs` INSERT policy
(`actor_id = auth.uid()` into their own company) — no elevated privilege
needed for that part, so it stays outside the `security definer` boundary.

### `delete-account` Edge Function — Phase 1E

Defined in `supabase/functions/delete-account/index.ts`. Runs with the
`service_role` key, which is only ever read from `Deno.env.get(...)`
inside this server-side runtime — never present in any frontend code or
build output (see `docs/supabase-setup.md` "Security notes").

**Why it has to bypass RLS**: no RLS policy could authorize what this
function does even in principle, because its whole job is deleting the
`auth.users` row itself — RLS only ever governs rows in `public.*` tables,
and only `service_role` (via the Auth Admin API) can delete from
`auth.users` at all. Every `public.*` write it makes (soft-deleting
`companies`, deleting `company_members`/`invitations` rows, writing
`audit_logs`) is a consequence of that core operation, not something a
normal authenticated policy was ever going to cover.

**What it validates before doing anything**: it re-derives the caller's
identity from their JWT via `auth.getUser()` on an anon-key client — it
never trusts a client-supplied user id, so a request can only ever delete
the account of whoever's access token is actually presented.

**Why `companies` is soft-deleted, not hard-deleted, for the OWNER path**:
hard-deleting the row would cascade-delete `company_members`,
`invitations`, and `audit_logs` for it (all three have `on delete cascade`
to `companies`) — including the `DELETE_ACCOUNT_COMPLETED` audit row this
same function just wrote, destroying the very record of the deletion
having happened. Soft-deleting (`deleted_at`/`deleted_by`) keeps the
company row (and its audit trail) around while still making it
unreachable: `getCurrentCompanyForUser` already filters
`.is('deleted_at', null)` (added in Phase 1B, before this had a caller),
and the `company_members` rows that would let anyone reach it via
`is_company_member`/`is_company_owner` are deleted explicitly in the same
request.

**Why `20260705120000_account_deletion_support.sql` had to relax three
foreign keys**: `companies.owner_id`, `companies.deleted_by`, and
`audit_logs.actor_id` all reference `auth.users(id)` with the default "no
action" behavior. Since this function hard-deletes `auth.users` as its
last step, any surviving row still referencing that id (the soft-deleted
company itself, or any audit log the user ever authored) would make that
final delete fail with a foreign key violation. `on delete set null`
anonymizes those references instead — the company and its audit history
outlive the deleted account, just no longer attributable to a live user.

### `approve_document(p_document_id)` — Phase 2C

Defined in `20260707120000_document_numbering_generation.sql`. `security
definer` with `set search_path = public`, granted to `authenticated` only.

**Why it has to bypass RLS**: two independent reasons, not one.
`numbering_sequences` has no INSERT/UPDATE grant for `authenticated` at
all — a client can never touch the running counter directly, by design,
so incrementing it can only happen from inside a function running with
elevated privilege. Separately, `documents` has no UPDATE policy (or
grant) whatsoever — `status`/`document_number` are meant to be
unconditionally immutable to ordinary clients, so the *only* way they can
ever change, even legitimately, is through code that bypasses RLS the
same way this RPC does.

**What it validates before touching any table**: the caller has
`OWNER`/`ADMIN`/`ACCOUNTANT` role in the document's company
(`has_company_role` — `EDITOR` can create/delete Drafts per the table
policies above, but approving is treated as a higher-authority action,
mirroring how `has_company_role`'s original Phase 1B comment already
flagged "Approve/Cancel" as its intended future use), and that the
document is still `DRAFT` (blocks re-approval).

**Why it self-logs to `audit_logs`, unlike `accept_invitation`**:
`accept_invitation` deliberately leaves audit logging to the caller (see
above) because that action stays low-stakes if the log call is skipped —
the frontend just calls `logAuditEvent` after the RPC returns, using the
ordinary `actor_id = auth.uid()` INSERT policy. `approve_document` logs
*inside* the transaction instead, because the master spec frames the
whole numbering flow as "backend-safe": the audit record should be
guaranteed to exist if and only if the approval succeeded, not depend on
a second client-side call completing after the fact. It writes two rows —
`DOCUMENT_NUMBER_GENERATED` (metadata: the number, sequence key, running
number) and `APPROVE_DOCUMENT` (metadata: the number, document type) — so
"a number was minted" and "a document was approved" stay distinguishable
facts in the trail even though they happen atomically together here.

**Collision retry**: the `documents_number_unique` constraint
(`unique(company_id, document_number)`) is a defensive backstop, not the
primary correctness mechanism — the sequence-key + running-number design
should make collisions essentially impossible under normal operation
(every pattern must include `{DOC_TYPE}`, and short codes are distinct
per type). If a `unique_violation` ever fires anyway, the function retries
up to 3 times; each retry's `insert ... on conflict do update` on
`numbering_sequences` advances `running_number` past the colliding value
before re-rendering the pattern, so a retry always produces a different
candidate number, never the same one twice.

### `mark_document_paid(p_document_id)` and `cancel_document(p_document_id)` — Phase 4B

Defined in `20260710120000_document_status_actions.sql`. Same shape as
`approve_document`: `security definer` with `set search_path = public`,
granted to `authenticated` only, each self-logging its own audit event
(`MARK_DOCUMENT_PAID` / `CANCEL_DOCUMENT`, metadata: the document's
`document_number`) inside the same transaction as the status change, for
the identical "backend-safe, no reliance on a second client-side call"
reason `approve_document` does.

**Why they don't need the retry/counter logic `approve_document` has**:
neither transition touches `numbering_sequences` or renders a new pattern
— the document already has its permanent `document_number` from
`APPROVED`, and this RPC only flips `status`. That also means the "why it
has to bypass RLS" reasoning is narrower here than for `approve_document`:
these two exist purely because `documents` has no UPDATE grant for
non-Draft rows at all, not because of any counter serialization need.

**What each validates**: caller has `OWNER`/`ADMIN`/`ACCOUNTANT` role
(same list as `approve_document` — `EDITOR` can author/edit Drafts but not
change a document's finalized status), and the document is currently
`APPROVED`. `mark_document_paid` requires `APPROVED` because a document
must have its official number before it can be marked paid.
`cancel_document` is deliberately restricted to `APPROVED` only — a
`DRAFT` is discarded via the existing delete policy instead (it never had
a number to void), and a `PAID` document is treated as final; correcting
one is a future-phase credit-note concern, not a status flip.

### `create_document_revision(p_document_id)` — Phase 4C

Defined in `20260711120000_document_revisions.sql`. `security definer`,
granted to `authenticated` only, self-logs `CREATE_DOCUMENT_REVISION`.

**What it validates**: caller has `OWNER`/`ADMIN`/`ACCOUNTANT`/`EDITOR`
role (same list as the ordinary Draft-creation INSERT policy — creating a
revision Draft is exactly as privileged as creating any other Draft, only
*approving* one is restricted further), the source document is
`APPROVED`, and the source's own `parent_document_id` is null. That last
check is what makes "revising a revision" impossible — only an original
can be revised, so `parent_document_id` on every revision always points
at a true root and `"PARENT_NUMBER-R{n}"` never needs to walk a chain.

**Why `PAID` documents can't be revised (a deliberate, documented
decision, not an oversight)**: a `PAID` document represents money that
has already changed hands. Revising it without a proper correction/credit
workflow — which doesn't exist yet — would let past line items and totals
silently drift out of sync with what was actually collected. Phase 4C
therefore only allows revising `APPROVED` documents; a `PAID` one is
read-only with no revision action available, same as `CANCELLED`.

**What it copies**: `customer_id`/`customer_code`, all `document_items`
rows, `vat_mode`, `note`, `due_date` (the closest existing field to
"payment term" — there's no separate payment-terms column in this
schema), `document_type`, and the four computed totals
(`subtotal`/`discount_total`/`vat_amount`/`grand_total`). It does **not**
copy `issue_date` — a revision is freshly issued "now", so the new Draft
gets `current_date` instead. "Template" isn't a per-document column at
all (it's `companies.document_template`), so the revision inherits it
automatically just by staying in the same company — nothing to copy.

### `approve_document(p_document_id)` — extended Phase 4C

The same function documented above now branches on
`v_document.parent_document_id` before doing anything else. If it's set
(a revision Draft), the original Phase 2C numbering-pattern/sequence path
is skipped entirely — a revision never gets its own independent running
number — and instead:

1. Locks the **parent** row (`select ... for update`), not just the
   revision being approved. This is the concurrency-safety mechanism: two
   revisions of the *same* parent being approved at the same moment will
   serialize on this lock, so `revision_no` computation below can never
   race.
2. Computes `revision_no` as one past the highest `revision_no` already
   approved for that `parent_document_id`.
3. Sets `document_number = parent.document_number || '-R' || revision_no`.
4. Logs a single `APPROVE_REVISION` event (metadata: the number,
   `revisionNo`, `parentDocumentId`) — not `DOCUMENT_NUMBER_GENERATED` +
   `APPROVE_DOCUMENT`, since no sequence counter was touched.

The role check (`OWNER`/`ADMIN`/`ACCOUNTANT`) and the `status = 'DRAFT'`
guard run identically for both branches, before the branch is even
decided — approving a revision is exactly as permission-gated as
approving any other Draft.

**Known limitation**: a revision Draft's parent could theoretically
change status (e.g. get cancelled) between when the revision Draft was
created and when it's approved. This isn't specially guarded against in
this phase — the parent's `document_number` stays valid regardless of its
current status, so approval still succeeds, but the resulting
`"CANCELLED_PARENT_NUMBER-R1"` may be confusing. Worth revisiting if this
turns out to matter in practice.

### `create_document_conversion(p_document_id, p_target_type)` — Phase 6A

Defined in `20260712120000_document_conversion.sql`. `security definer`,
granted to `authenticated` only, self-logs `CONVERT_DOCUMENT`.

**What it validates**: caller has `OWNER`/`ADMIN`/`ACCOUNTANT`/`EDITOR`
role (the Draft-creation list — converting is exactly as privileged as
creating any other Draft), the source is `APPROVED`, and
`is_valid_document_conversion(source.document_type, p_target_type)`
returns true. That last check is what makes "unsafe conversion loops"
impossible — `documentConversionMap`/`is_valid_document_conversion` is a
directed acyclic graph (every edge moves further along
RFQ -> QUOTATION -> INVOICE -> {RECEIPT, TAX_INVOICE} ->
{RECEIPT_TAX_INVOICE, CREDIT_NOTE, CREDIT_NOTE_TAX}, never backwards), so
no sequence of conversions can ever cycle back to a type already visited.

**Why only `APPROVED` sources, not `PAID`**: a `PAID` document represents
settled money — the same reasoning `create_document_revision()` uses to
exclude `PAID`. Converting a paid invoice into a new, uncommitted Draft
receipt with no linkage back to what was actually collected risks
misrepresenting the transaction; that needs a proper reconciliation
workflow this phase doesn't build. `DRAFT` and `CANCELLED` sources are
rejected the same way `APPROVED`-only revision creation rejects them.

**What it copies** (identical list to `create_document_revision()`):
`customer_id`/`customer_code`, all `document_items` rows, `vat_mode`,
`note`, `due_date` (payment term), and the four computed totals. It does
**not** copy `issue_date` (freshly issued "now") or `document_type`
(that's the whole point — the new Draft gets `p_target_type` instead).
"Template" again isn't a per-document column, so it's inherited
automatically via `company_id`.

**Revision and conversion never interact**: a converted Draft always has
`parent_document_id = null` (it's not a revision), and a revision Draft
always has `source_document_id = null` (it's not a conversion). The two
lineage columns are independent by construction — nothing in either RPC
reads the other's column.

## Manual verification (needs a real Supabase project)

1. Apply all 5 Phase 1B migrations (see `docs/supabase-setup.md` section 4).
2. In the SQL Editor, create two test users via `auth.users` (or sign up
   through the app twice) — call them **A** and **B**.
3. As **A**, insert a company (`owner_id = A`), then insert A's own
   `company_members` OWNER row. Confirm:
   - **B** cannot `select` A's company (`companies_select_members`).
   - **B** cannot `insert` into A's `company_members`.
   - **A** cannot insert a *second* company (`companies_insert_if_no_existing_membership`).
4. To run a query "as" a specific user in the SQL Editor, wrap it:
   ```sql
   select set_config('request.jwt.claims', json_build_object('sub', '<user-uuid>')::text, true);
   set local role authenticated;
   -- your query here
   ```
5. Confirm `audit_logs` has no UPDATE/DELETE policy:
   ```sql
   select cmd, qual, with_check from pg_policies where tablename = 'audit_logs';
   -- should only ever show rows for 'select' and 'insert'
   ```
6. After applying `20260705120000_account_deletion_support.sql`, invoke
   `delete-account` as a non-owner member, then confirm:
   - Their `company_members` row is gone but the company row (and the
     owner's row) are untouched.
   - `select id from auth.users where id = '<deleted-user-uuid>'` returns
     no rows.
   - Any `audit_logs` row that user authored still exists, with
     `actor_id` now `null`.
   Repeat as the owner and confirm the company row still exists with
   `deleted_at`/`deleted_by` set, but every `company_members` and
   `invitations` row for it is gone.
7. As a non-owner member **B**, confirm `insert`/`update`/`delete` on
   `numbering_settings` for **A**'s company all fail, but `select` still
   returns the owner's saved rows. As **A**, confirm inserting a second
   row with `document_type = null` (or a second row with the same
   non-null `document_type`) fails on the partial unique index, not just
   the RLS policy.
8. Apply `20260707120000_document_numbering_generation.sql`, then as
   **A** (owner): insert a `documents` row directly and confirm a raw
   `update ... set document_number = 'X'` fails (no grant, not just no
   policy). Insert a Draft via the app/`documents_insert_editors` policy,
   then call `select public.approve_document('<draft-id>')` — confirm the
   returned row has `status = 'APPROVED'` and a non-null
   `document_number`, that `numbering_sequences` now has a matching row
   with `running_number = 1`, and that calling `approve_document` again
   on the same id raises the "ไม่สามารถอนุมัติซ้ำได้" exception. As a
   `VIEWER` member, confirm `approve_document` raises
   "คุณไม่มีสิทธิ์อนุมัติเอกสาร".
9. Apply `20260708120000_customers.sql`, then as **B** (non-owner in a
   different company than **A**), confirm `select`/`insert`/`update` on
   **A**'s `customers` all return zero rows / fail. As a `VIEWER` in
   **A**'s own company, confirm `select` works but `insert`/`update` both
   fail. As `EDITOR`, confirm soft-deleting (an `update` setting
   `deleted_at`) succeeds, and that a raw `delete from customers` always
   fails regardless of role (no grant). Confirm inserting a second active
   customer with a `customer_code` already used by a non-deleted customer
   in the same company fails on `customers_unique_code_among_active`, but
   succeeds once the original is soft-deleted first.
10. Apply `20260709120000_document_drafts.sql`, then as `EDITOR` in
    **A**'s company: create a Draft, `update` its `vat_mode`/`note`, and
    insert/update/delete a few `document_items` rows for it — all should
    succeed. Approve it (`select public.approve_document(...)`), then
    confirm the same `update` on `documents` now affects zero rows (RLS
    filters it out since `status <> 'DRAFT'`), and that inserting a new
    `document_items` row for it also affects zero rows. Confirm a direct
    `update documents set document_number = 'FAKE'` fails the `with
    check` even while still `DRAFT` (document_number must stay null).
11. Apply `20260710120000_document_status_actions.sql`. As `EDITOR` in
    **A**'s company, approve a Draft, then confirm
    `select public.mark_document_paid('<id>')` raises
    "คุณไม่มีสิทธิ์บันทึกการชำระเงิน" and
    `select public.cancel_document('<id>')` raises
    "คุณไม่มีสิทธิ์ยกเลิกเอกสาร". As **A** (owner), call
    `mark_document_paid` on the same document — confirm `status = 'PAID'`
    and `document_number` is unchanged, then confirm calling it again
    raises "บันทึกชำระเงินได้เฉพาะเอกสารที่อนุมัติแล้วเท่านั้น" and that
    `cancel_document` on the now-`PAID` document raises
    "ยกเลิกได้เฉพาะเอกสารที่อนุมัติแล้วเท่านั้น". Separately, approve a
    second Draft and confirm `cancel_document` succeeds
    (`status = 'CANCELLED'`, `document_number` unchanged), and that a raw
    `update documents set status = 'PAID' where id = '<cancelled-id>'`
    fails (no UPDATE grant reaches a non-`DRAFT` row through any policy).
    Confirm both RPCs each produced exactly one new `audit_logs` row
    (`MARK_DOCUMENT_PAID` / `CANCEL_DOCUMENT`).
12. Apply `20260711120000_document_revisions.sql`. As **A** (owner),
    approve a Draft, then confirm a raw
    `insert into documents (company_id, document_type, created_by,
    parent_document_id) values (..., '<approved-id>')` fails (the
    `documents_insert_editors` policy now requires `parent_document_id is
    null`). Call `select public.create_document_revision('<approved-id>')`
    instead — confirm the returned row has `status = 'DRAFT'`,
    `document_number is null`, `revision_no is null`, and
    `parent_document_id = '<approved-id>'`, and that its `document_items`
    match the original's. As `EDITOR`, confirm the same call succeeds
    (revision creation uses the Draft-creation role list, not the approval
    one). Approve the revision Draft
    (`select public.approve_document('<revision-id>')`) — confirm
    `document_number` is `'<original-number>-R1'` and `revision_no = 1`.
    Create and approve a second revision from the same original — confirm
    it gets `'<original-number>-R2'`. Confirm
    `select public.create_document_revision('<revision-id>')` (i.e.
    revising a revision) raises
    "ไม่สามารถสร้าง Revision จากเอกสารที่เป็น Revision ได้", and that
    calling it on a still-`DRAFT` or `CANCELLED` document raises
    "สร้าง Revision ได้เฉพาะเอกสารที่อนุมัติแล้วเท่านั้น". As `VIEWER`,
    confirm `create_document_revision` raises
    "คุณไม่มีสิทธิ์สร้าง Revision", and that approving any revision Draft
    still requires the `OWNER`/`ADMIN`/`ACCOUNTANT` role exactly like an
    ordinary document.
13. Apply `20260712120000_document_conversion.sql`. As **A** (owner),
    approve a `QUOTATION` Draft, then call
    `select public.create_document_conversion('<approved-id>', 'INVOICE')`
    — confirm the returned row has `status = 'DRAFT'`,
    `document_number is null`, `document_type = 'INVOICE'`, and
    `source_document_id = '<approved-id>'`, and that its `document_items`
    match the source's. Confirm
    `select public.create_document_conversion('<approved-id>', 'RECEIPT')`
    raises "ไม่สามารถแปลงเอกสารประเภทนี้เป็นประเภทที่เลือกได้" (`QUOTATION`
    can only convert to `INVOICE`), and that calling it on a still-`DRAFT`
    or `CANCELLED` document raises
    "แปลงเอกสารได้เฉพาะเอกสารที่อนุมัติแล้วเท่านั้น". As `EDITOR`, confirm
    conversion creation still succeeds (Draft-creation role list); as
    `VIEWER`, confirm it raises "คุณไม่มีสิทธิ์แปลงเอกสาร". Confirm the new
    `INVOICE` Draft can be approved normally through
    `approve_document()` and receives its own independent
    `document_number` (not derived from the source's number the way a
    revision's is). Confirm `select cmd, qual, with_check from
    pg_policies where tablename = 'documents' and policyname =
    'documents_insert_editors'` shows no `source_document_id` condition —
    unlike `parent_document_id`, a direct client insert setting
    `source_document_id` is not blocked (see the note in the `documents`
    table section above for why that's an intentional, safe difference).
