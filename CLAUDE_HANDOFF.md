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

**Known deployment quirk (not a code issue)**: GitHub's own internal "pages build and deployment" step (separate from our `.github/workflows/deploy.yml`) has intermittently failed silently, leaving the live site stale for up to 2 deploys behind even though `main` and `gh-pages` were both correct. If the live site ever looks behind what's in `gh-pages`, check `https://github.com/atiwathp-debug/finvizer/actions` for a failed "pages build and deployment" run (not the "Deploy to GitHub Pages" one) and re-push to `gh-pages` (even an empty commit) to force a retry — no code fix needed, see commit `3e59a3b` on `gh-pages` for precedent.

## 3. Latest commit hashes

- **`main`**: `706631c12d3e7363856c26a10056fc191199ad1a` — "Finalize HTML print document templates"
- **`gh-pages`**: `3e59a3b6c370081f991297a7658b832827546c62` — "deploy: 706631c... (retry - force GitHub Pages republish)" (content is identical to the `706631c` build; the retry commit was empty, just needed to re-trigger GitHub's publisher)

## 4. Recent migrations (in `supabase/migrations/`, newest last)

All of the below have been confirmed working against the live Supabase project via manual QA:

| File | What it does |
| --- | --- |
| `20260715120000_signature_slots.sql` | `signature_slots` table — company-wide ordered signature labels. |
| `20260716120000_document_template_minimal_print.sql` | Adds `MINIMAL_PRINT` to the `document_template` enum. |
| `20260717120000_document_installments.sql` | `documents.installment_number` + `document_installments` table. |
| `20260718120000_company_logo_storage.sql` | Public `company-logos` storage bucket + owner-write RLS policies. |
| `20260719120000_company_logo_layout.sql` | `companies.logo_size` (24–160 originally) + `companies.logo_position` (5 positions originally). |
| `20260720120000_logo_layout_qa_fixes.sql` | Widens `logo_size` to 24–200 and adds the `centered_logo_above_company` position — repair-only, safe to re-run. |

`supabase/combined_migrations.sql` is kept in sync as a single apply-all file — see `docs/supabase-setup.md` for the full apply checklist and order.

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

## 6. Known next tasks (not started)

1. **Template text customization** — `src/lib/templates/documentTemplateText.ts` already centralizes today's default labels (ลูกค้า, รายการ, ยอดรวมทั้งสิ้น, etc.) as a single source of truth, but there's no Settings UI or DB column yet to let a company override them. Signature labels are the one exception — already fully configurable via `signature_slots`.
2. **Controlled document deletion** — note: DRAFT-only deletion already exists (`documents_delete_draft_only` RLS policy + a delete button/confirm dialog on `DocumentDetailPage`, from "production readiness pass 2"). Clarify with the user what "controlled" should add beyond that (e.g. role restriction beyond current permissions, soft-delete/audit trail, or something else) before implementing.
3. **Hide PDF export for draft documents** — currently "ส่งออก PDF" is visible for every status (Draft/Approved/Paid/Cancelled) on `DocumentDetailPage.tsx`; this task presumably wants it hidden/disabled while `status === 'DRAFT'`.
4. **Dashboard: pending-approval document list** — a list of DRAFT documents awaiting approval.
5. **Dashboard: unpaid invoice list** — a list of INVOICE-type documents that are APPROVED but not yet PAID.
6. **Dashboard: due-soon collection list** — unpaid invoices with `dueDate` within 2 days.

## 7. Domain model reference

**Member roles** (`src/types/member.ts`): `OWNER` | `ADMIN` | `ACCOUNTANT` | `EDITOR` | `VIEWER`

**Document statuses** (`src/types/document.ts`): `DRAFT` | `APPROVED` | `PAID` | `CANCELLED`

**Document types**: `RFQ` (ใบขอราคา) → `QUOTATION` (ใบเสนอราคา) → `INVOICE` (ใบแจ้งหนี้) → `RECEIPT` (ใบเสร็จรับเงิน) / `TAX_INVOICE` (ใบกำกับภาษี) → `RECEIPT_TAX_INVOICE` / `CREDIT_NOTE` (ใบลดหนี้) / `CREDIT_NOTE_TAX` (ใบลดหนี้ + ภาษี). See `documentConversionMap` in `src/types/document.ts` for the exact allowed conversion graph.

**Document templates** (`DocumentTemplateEnum`): `EXECUTIVE_CLASSIC` | `MODERN_ACCENT` | `MINIMAL_PRINT`

## 8. Recommended implementation order

1. **Hide PDF export for draft documents** — smallest, fully isolated, no schema change, low risk. Good warm-up task.
2. **Controlled document deletion** — get clarification on scope first, since a baseline already exists; avoid duplicating it.
3. **Template text customization** — medium complexity; the data-model shape already exists (mirror the `signature_slots` pattern: a company-scoped table/JSON column + Settings UI + wiring into `DocumentPreview.tsx`).
4. **Dashboard: pending-approval list**, **5. unpaid invoice list**, **6. due-soon (≤2 days) list** — do these three together as one pass since they all touch the same dashboard/report area; each is an additive, read-only query layered on top of existing report functions. Reuse `src/lib/reports/documentReports.ts`'s existing INVOICE-scoped helpers rather than writing new calculation logic from scratch.

## 9. Verify before committing anything

```
npm run lint
npm run test
npm run build
```

All three must pass clean. Do not commit/push until the user explicitly confirms QA — this has been the standing workflow for every round on this project so far.
