# FinVizer — Handoff Notes

Read this before starting work in a new chat. It's a snapshot of where the project stands, not a spec — verify anything load-bearing against the actual code/DB before relying on it.

## 1. Project info

- **Repo path (local)**: `C:\Users\thirada\finvizer`
- **Remote**: https://github.com/atiwathp-debug/finvizer (branch `main`; deploys via `gh-pages` branch)
- **Live site**: https://atiwathp-debug.github.io/finvizer/
- **Supabase project URL**: `https://ofwfovxivjsxwgowsmtg.supabase.co`
  (cross-checked directly against local `.env.local` and the deployed JS bundle — double-check this against `.env.local`/Supabase dashboard yourself if it matters, since it's easy to mistype)

## 2. Current production status

As of this handoff, live QA has passed for:
- HTML print-based PDF export (the "ส่งออก PDF" button opens `/documents/:id/print`, which renders the exact same `<DocumentPreview>` component as the detail page and calls `window.print()` — there is no separate PDF-rendering library anymore; `@react-pdf/renderer` was fully removed).
- Multiline notes (notes field is a `<Textarea>`, rendered with `whitespace-pre-wrap` in all 3 templates — manual line breaks and natural wrapping both work).
- Company logo layout (6 position options, size 24–200px, configurable in Settings → ข้อมูลบริษัท).
- All 3 document templates: Executive Classic, Modern Accent, Minimal Print.
- Signature labels + layout (configurable in Settings → ลายเซ็นเอกสาร; renders as line → `(________________________)` → label, centered, in all 3 templates).
- Thai amount-in-words (`src/lib/utils/thaiBahtText.ts`, e.g. "หนึ่งพันบาทถ้วน") next to every grand-total row.
- **Configurable document template text (Pass 4)** — per-company overrides for document-type titles (ใบเสนอราคา/ใบแจ้งหนี้/etc.) and the high-priority template labels (customer, table columns, subtotal/VAT/grand-total, issue/due date, note), editable in a new Settings tab → ข้อความในเอกสาร (`/settings/template-text`), applied consistently to `DocumentDetailPage`, `DocumentForm`'s live preview, and the `/print` route. A blank/whitespace override always falls back to the existing Thai default — see `src/lib/templates/documentTemplateText.ts`'s `resolveDocumentTemplateText`/`resolveDocumentTypeLabel`. Signature labels remain separately configurable via `signature_slots` (unchanged, not duplicated here).

**Known deployment quirk (not a code issue, recurred again on this pass)**: GitHub's own internal "pages build and deployment" step (separate from our `.github/workflows/deploy.yml`) has repeatedly failed silently, leaving the live site stale for one or more deploys behind even though `main` and `gh-pages` were both correct. Confirmed twice now via the Deployments API (`GET /repos/.../deployments/{id}/statuses` showing `"state": "failure"` for the internal `github-pages` deployment despite our own Actions workflow run showing `success`). If the live site ever looks behind what's in `gh-pages`:
1. Check `https://github.com/atiwathp-debug/finvizer/actions` for a failed "pages build and deployment" run (not the "Deploy to GitHub Pages" one), or query `https://api.github.com/repos/atiwathp-debug/finvizer/deployments?per_page=1` and its `/statuses` sub-resource directly.
2. Re-trigger without touching source: create an empty commit *directly on `gh-pages`* (same tree, no file changes) and push just that ref — no need to `git checkout gh-pages` locally. Plumbing recipe (run from `main`, working tree stays untouched):
   ```
   git fetch origin gh-pages
   TREE=$(git rev-parse origin/gh-pages^{tree})
   PARENT=$(git rev-parse origin/gh-pages)
   NEW=$(git commit-tree "$TREE" -p "$PARENT" -m "Trigger GitHub Pages publish")
   git push origin "$NEW":gh-pages
   ```
   Precedent: commit `3e59a3b` (first occurrence), commit `e025f67` (second occurrence, this pass).
3. Confirm live is actually updated by comparing the JS bundle filename in the live `index.html` (`curl -s https://atiwathp-debug.github.io/finvizer/ | grep -oE 'assets/index-[A-Za-z0-9_-]+\.js'`) against the filename at the current `gh-pages` tip — they must match. Don't rely on "the workflow succeeded" alone; that only confirms the push to `gh-pages`, not GitHub's separate internal publish step.

## 3. Latest commit hashes

- **`main`**: `7ea53aee9a57ccdaa7e3271aeabc72229fd69491` — "Add configurable document template text"
- **`gh-pages`**: `e025f67a7f851f6c2d1e454905d262d38013f670` — "Trigger GitHub Pages publish" (empty retry commit, identical file tree to `53726c9`/the `7ea53ae` build — needed only to force GitHub's internal publisher to retry after it silently failed on the first attempt)
- **Confirmed live** (verified via direct bundle fetch + string grep, not just "workflow succeeded"): the `7ea53ae` build — live bundle contains `ข้อความในเอกสาร`, `settings/template-text`, `template_text_overrides`.

## 4. Recent migrations (in `supabase/migrations/`, newest last)

All of the below have been confirmed working against the live Supabase project via manual QA, **except the last one — apply it yourself via the Supabase SQL editor if you haven't already** (see the exact SQL below; it's additive/idempotent):

| File | What it does |
| --- | --- |
| `20260715120000_signature_slots.sql` | `signature_slots` table — company-wide ordered signature labels. |
| `20260716120000_document_template_minimal_print.sql` | Adds `MINIMAL_PRINT` to the `document_template` enum. |
| `20260717120000_document_installments.sql` | `documents.installment_number` + `document_installments` table. |
| `20260718120000_company_logo_storage.sql` | Public `company-logos` storage bucket + owner-write RLS policies. |
| `20260719120000_company_logo_layout.sql` | `companies.logo_size` (24–160 originally) + `companies.logo_position` (5 positions originally). |
| `20260720120000_logo_layout_qa_fixes.sql` | Widens `logo_size` to 24–200 and adds the `centered_logo_above_company` position — repair-only, safe to re-run. |
| `20260721120000_document_template_text_overrides.sql` | `companies.template_text_overrides jsonb not null default '{}'` — per-company display-text overrides (Pass 4). Additive-only, idempotent (`add column if not exists`). |

```sql
alter table public.companies
  add column if not exists template_text_overrides jsonb not null default '{}'::jsonb;
```

`supabase/combined_migrations.sql` is kept in sync as a single apply-all file (already includes the above) — see `docs/supabase-setup.md` for the full apply checklist and order.

## 5. Protected logic — do not touch unless specifically requested

These are load-bearing accounting/workflow logic. Every round of work this project has done has explicitly verified (via `git diff`) that these were untouched:

- `mark_document_paid` (RPC + mock mirror `markMockDocumentPaid`)
- `create_document_conversion` (RPC + mock mirror `createMockDocumentConversion`)
- `approve_document`
- `cancel_document`
- Dashboard/report files (`src/lib/reports/documentReports.ts`, `src/features/dashboard/DashboardPage.tsx`) and their underlying queries
- Numbering files (`numbering_settings`, sequence-generation logic)
- RLS/payment migrations

If a task requires touching one of these (e.g. the dashboard tasks below), only ever *add* new read-only queries/components alongside the existing logic — never modify the existing calculation/state-transition code itself without the user explicitly asking for that specific change.

## 6. Known stable areas (verified working end-to-end, safe to build on top of without re-deriving)

- Document CRUD lifecycle (Draft → Approved → Paid/Cancelled), revisions, conversions.
- HTML print/PDF export path (`DocumentPreview.tsx` shared by detail page, form preview, and `/print` route — one renderer, no drift).
- Company logo layout, signature slots, all 3 document templates.
- **Configurable document template text** (Pass 4, this handoff) — `documentTemplateText.ts`'s resolver functions, `companies.template_text_overrides`, and the Settings → ข้อความในเอกสาร page. High-priority labels only; several lower-priority `DocumentTemplateText` fields (discount, document-number, no-items, installment section/no./detail) have working defaults but no Settings UI yet — see "Next recommended pass."
- Mock Mode (`isMockMode`) as a fully working parallel data path — every `lib/supabase/*.ts` function has a `lib/mock/*.ts` mirror; keep both in sync when adding new company/document fields.
- GitHub Pages deploy pipeline itself (the Actions workflow), modulo the known internal-publish-step flakiness documented in section 2.

## 7. Known next tasks (not started)

1. **Extend template-text customization to the deferred labels** — `discountLabel`, `documentNumberLabel`, `pendingDocumentNumberLabel`, `noItemsLabel`, `installmentSectionLabel`/`installmentNoLabel`/`installmentDetailLabel` already resolve correctly via `resolveDocumentTemplateText`, just need to be added to `TemplateTextSettingsPage.tsx`'s `EDITABLE_LABEL_FIELDS` list — no schema change required.
2. **Controlled document deletion** — note: DRAFT-only deletion already exists (`documents_delete_draft_only` RLS policy + a delete button/confirm dialog on `DocumentDetailPage`, from "production readiness pass 2"). Clarify with the user what "controlled" should add beyond that (e.g. role restriction beyond current permissions, soft-delete/audit trail, or something else) before implementing.
3. **Hide PDF export for draft documents** — currently "ส่งออก PDF" is visible for every status (Draft/Approved/Paid/Cancelled) on `DocumentDetailPage.tsx`; this task presumably wants it hidden/disabled while `status === 'DRAFT'`.
4. **Dashboard: pending-approval document list** — a list of DRAFT documents awaiting approval.
5. **Dashboard: unpaid invoice list** — a list of INVOICE-type documents that are APPROVED but not yet PAID.
6. **Dashboard: due-soon collection list** — unpaid invoices with `dueDate` within 2 days.

## 8. Domain model reference

**Member roles** (`src/types/member.ts`): `OWNER` | `ADMIN` | `ACCOUNTANT` | `EDITOR` | `VIEWER`

**Document statuses** (`src/types/document.ts`): `DRAFT` | `APPROVED` | `PAID` | `CANCELLED`

**Document types**: `RFQ` (ใบขอราคา) → `QUOTATION` (ใบเสนอราคา) → `INVOICE` (ใบแจ้งหนี้) → `RECEIPT` (ใบเสร็จรับเงิน) / `TAX_INVOICE` (ใบกำกับภาษี) → `RECEIPT_TAX_INVOICE` / `CREDIT_NOTE` (ใบลดหนี้) / `CREDIT_NOTE_TAX` (ใบลดหนี้ + ภาษี). See `documentConversionMap` in `src/types/document.ts` for the exact allowed conversion graph. Note: `documentTypeLabels` in the same file is the canonical/default title used everywhere *except* the printed document preview, which prefers a company's `template_text_overrides.documentTypeTitles` override when present (see `resolveDocumentTypeLabel`).

**Document templates** (`DocumentTemplateEnum`): `EXECUTIVE_CLASSIC` | `MODERN_ACCENT` | `MINIMAL_PRINT`

## 9. Recommended next pass

**Extend template-text customization to the deferred labels (item 1 above)** — smallest, fully isolated, no schema change, low risk, and directly continues the just-shipped Pass 4 pattern (add entries to `EDITABLE_LABEL_FIELDS`, no new resolver/DB work needed). Good warm-up task before tackling the larger, scope-clarification-needed items (controlled deletion, dashboard lists).

After that, in order: **hide PDF export for drafts** → **controlled document deletion** (get scope clarification first) → **dashboard: pending-approval / unpaid-invoice / due-soon lists** together as one pass (all read-only, all reuse `src/lib/reports/documentReports.ts`'s existing INVOICE-scoped helpers).

## 10. Verify before committing anything

```
npm run lint
npm run test
npm run build
```

All three must pass clean. Do not commit/push until the user explicitly confirms QA — this has been the standing workflow for every round on this project so far.

After pushing to `main`, don't assume the live site updated just because the Actions workflow succeeded — see section 2's deployment-quirk note. Confirm by diffing the live bundle filename against the `gh-pages` tip.
