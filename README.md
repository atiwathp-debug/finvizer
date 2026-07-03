# FinVizer

ระบบจัดการเอกสารธุรกิจและบัญชีสำหรับธุรกิจไทย — ใบเสนอราคา ใบแจ้งหนี้
ใบเสร็จรับเงิน ใบกำกับภาษี และใบลดหนี้ ในรูปแบบ PWA ที่ deploy บน GitHub Pages
พร้อม backend Supabase (PostgreSQL + Auth + Row Level Security + Edge
Functions)

## Tech Stack

- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS v4
- **Routing**: React Router
- **Forms/Validation**: React Hook Form + Zod
- **State**: Zustand
- **Backend**: Supabase (PostgreSQL, Auth, RLS, Edge Functions)
- **PWA**: vite-plugin-pwa
- **Hosting**: GitHub Pages

## Getting Started

```bash
npm install
npm run dev
```

The app opens at `http://localhost:5173`.

### Without Supabase (Mock Mode)

No `.env.local`? The app still runs. It falls back to **Mock Mode**
automatically — a banner reading "Mock Mode: ยังไม่ได้เชื่อมต่อ Supabase" is
shown, and all data is simulated. This is the default state for anyone
cloning the repo without Supabase credentials.

### With a real Supabase project

```bash
cp .env.example .env.local
# then fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

See [docs/supabase-setup.md](docs/supabase-setup.md) for the full setup
guide, including migrations and Edge Functions.

## Scripts

```bash
npm run dev       # start dev server
npm run build     # type-check (tsc -b) and build for production
npm run preview   # preview the production build locally
npm run test       # run unit tests (Vitest)
npm run lint      # lint with oxlint
```

## Project Structure

```
src/
  app/            # app-level composition (providers, root layout)
  components/
    ui/           # low-level design-system primitives
    layout/       # shell/layout components (AppShell, AuthLayout, ...)
    shared/       # cross-feature shared components
  features/       # one folder per domain: auth, company, members,
                  # customers, documents, templates, numbering, privacy,
                  # dashboard
  lib/
    supabase/     # Supabase client + Mock Mode detection + unified data layer
    validations/  # Zod schemas
    permissions/  # role/permission logic
    calculations/ # VAT / totals calculation (shared by UI, PDF, DB)
    numbering/    # document numbering pattern logic
    pdf/          # client-side PDF generation
    reports/      # pure dashboard/report aggregation functions
    mock/         # Mock Mode data and helpers (persisted + static demo)
    utils/        # generic helpers (cn, etc.)
  routes/         # React Router route definitions
  stores/         # Zustand stores
  types/          # shared TypeScript types (incl. generated DB types)
  styles/         # global CSS / Tailwind theme
supabase/
  migrations/     # SQL migrations (schema + RLS policies + RPCs)
  functions/      # Edge Functions (privileged server-side operations)
docs/
  supabase-setup.md          # how to connect a real Supabase project
  rls-policy-notes.md        # what each RLS policy/RPC does + how to verify it manually
  manual-test-checklist.md   # cross-phase manual QA checklist
```

## Security Notes

- Only the Supabase **anon/publishable** key is ever used in the frontend.
  The **service_role** key must never be committed or shipped to the
  browser — it belongs exclusively inside Supabase Edge Functions.
- Every table has Row Level Security enabled; see `supabase/migrations` from
  Phase 1B onward.
- Privileged operations (document number generation on Approve, account
  deletion) run through Supabase RPC/Edge Functions, never directly from the
  client.

## Deploying to GitHub Pages

### Automated (recommended)

`.github/workflows/deploy.yml` builds and deploys on every push to `main`
(lint + test + build, then publish `dist/`). One-time setup:

1. Repo **Settings > Pages > Build and deployment > Source** = **GitHub
   Actions**.
2. Optional — to deploy with a real Supabase connection instead of Mock
   Mode, add repo **Settings > Secrets and variables > Actions** secrets
   named `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Leave them
   unset to deploy in Mock Mode.
3. Push to `main` (or run the workflow manually from the Actions tab).

The workflow sets `VITE_BASE_PATH` to `/<repo-name>/` automatically, so it
works regardless of what the repository is named.

### Manual

This is a project site (`https://<user>.github.io/<repo>/`), so the Vite
`base` path must match the repo name at build time:

```bash
VITE_BASE_PATH=/finvizer/ npm run build
```

On Windows with Git Bash, prefix with `MSYS_NO_PATHCONV=1` — Git Bash's
MSYS layer otherwise rewrites a leading `/` in the value as if it were a
filesystem path (`/finvizer/` becomes `C:/Program Files/Git/finvizer/`).
PowerShell and CI runners (Linux) aren't affected.

Then publish the `dist/` folder to the `gh-pages` branch (or your chosen
Pages source) with your tool of choice, e.g. the
[`gh-pages`](https://www.npmjs.com/package/gh-pages) npm package.

### Both methods

`public/404.html` + the inline script in `index.html` implement the
standard [SPA-on-GitHub-Pages redirect](https://github.com/rafgraph/spa-github-pages)
so deep links (e.g. `/documents/123`) survive a full page refresh, since
GitHub Pages has no server-side rewrites. The PWA manifest's `start_url`/
`scope` also follow `VITE_BASE_PATH`, so an installed PWA launches at the
correct subpath.

## Current Status

**MVP-complete as of Phase 6A.** Every route is backed by a real feature in
both Mock Mode and real Supabase mode — see
[docs/manual-test-checklist.md](docs/manual-test-checklist.md) for the
full testable-now checklist, and the "Remaining MVP blockers" section
below for what's not yet verified against a live Supabase project.

### What's built

- **Auth**: Register/Login/Logout/Forgot/Reset Password, email
  confirmation handling, invite-by-email onboarding.
- **Company**: onboarding (create company + OWNER membership atomically),
  editable company profile, document template selection (Executive
  Classic / Modern Accent).
- **Members & roles**: invite/remove members, change roles
  (OWNER/ADMIN/ACCOUNTANT/EDITOR/VIEWER), role-gated actions throughout.
- **Customers**: full CRUD with soft delete, search, pagination.
- **Documents**: Draft creation/editing for all 8 document types (RFQ,
  Quotation, Invoice, Tax Invoice, Receipt, Receipt+Tax Invoice, Credit
  Note, Credit Note+Tax), decimal-safe VAT/discount/total calculations,
  configurable document-numbering patterns, backend-safe official
  numbering on approval, Paid/Cancelled status transitions, document
  revisions (`ORIGINAL-R1`, `-R2`, ...), and document **conversion**
  between related types (e.g. Quotation → Invoice → Receipt) — see
  `src/types/document.ts`'s `documentConversionMap` for the full allowed
  graph.
- **PDF export**: client-side, Thai-font-embedded PDF generation matching
  the company's chosen template — never uploaded anywhere.
- **Activity timeline**: every document's detail page shows its full
  create/approve/pay/cancel/revise/convert/export history.
- **Dashboard & reports**: real document counts by status, revenue/
  outstanding totals, monthly totals chart, top-customers-by-revenue,
  recent documents.
- **Privacy/PDPA**: export all account data (profile, company, members,
  invitations, audit log, customers, documents) as JSON; delete account
  (soft-deletes the company if you're the owner, revokes every member's
  access, hard-deletes the `auth.users` row via an Edge Function).
- **PWA**: installable, offline-capable shell, GitHub Pages-ready
  (`VITE_BASE_PATH`-aware manifest and asset base).

### Mock Mode vs real Supabase mode

Every data-layer function branches on `isMockMode` (see
`src/lib/supabase/client.ts`) and behaves identically either way — Mock
Mode persists to `localStorage` instead of Postgres, including a real
audit trail (`finvizer_mock_audit_logs`) that powers the same timeline UI.
This repo was built primarily in Mock Mode, but has since been verified
end-to-end against a live Supabase project: all 15 migrations applied,
RLS/RPC behavior exercised directly (including a real second member with
a restricted role to confirm role-gated RPCs and table policies both
reject correctly), and the full document lifecycle (Draft → Approve →
Revision → Conversion → PDF export) run against real data. See
[docs/rls-policy-notes.md](docs/rls-policy-notes.md) and
[docs/supabase-setup.md](docs/supabase-setup.md) for the underlying
policy/RPC reference.

### Remaining MVP blockers

- **Settings > Audit Log still shows static demo data**, not the real
  persisted audit trail Phase 6A added — only the document detail page's
  timeline reads real entries so far.
- **PDF export**: no company logo (logo upload itself isn't built yet —
  the upload button is intentionally disabled with a "future phase"
  notice, so there's nothing to render), and no pagination — a document
  with enough line items to overflow one A4 page gets clipped rather than
  flowing to a second page.
- **Dashboard**: "recent documents" and "top customers" are fixed top-5,
  no date-range filter or pagination.
- **Delete Account has only been verified with unauthorized requests**
  (missing/invalid auth header, both correctly rejected) — a full
  authenticated end-to-end run (real user, real cascade-delete of
  company/members/invitations) has not been performed and needs explicit
  sign-off before relying on it in production, since it's irreversible.
- No automated CI test run has happened against a real Supabase project
  (the GitHub Actions workflow lints/tests/builds against Mock Mode
  logic only — real-mode code paths are typechecked but not
  integration-tested in CI).
