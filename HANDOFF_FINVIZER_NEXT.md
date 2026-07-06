# FinVizer — Handoff for Next Session

Read this before starting work in a new chat. It's a snapshot of where the project stands, not a spec — verify anything load-bearing against the actual code/DB before relying on it. This supersedes `CLAUDE_HANDOFF.md` for the current state (Passes 1–4 below); that file's sections 5, 6, and 8 (protected logic, stable areas, domain model) are still accurate background reading.

## 1. Project context

FinVizer is a Thai-language business-document system (quotations → invoices → receipts/tax invoices → credit notes) with a company Dashboard. Work since the last full handoff has proceeded as a series of small, single-purpose "Passes," each: proposed as a plan and approved before editing, implemented, verified with `npm run lint && npm run test && npm run build`, manually QA'd by the user, committed only after explicit QA confirmation, and pushed only after a separate explicit instruction. This pass-by-pass, confirm-before-each-step workflow is the standing process for this project — continue it unless the user explicitly says otherwise.

## 2. Repo / local / live URLs

- **Repo path (local)**: `C:\Users\thirada\finvizer`
- **Remote**: https://github.com/atiwathp-debug/finvizer (branch `main`; deploys via `gh-pages` branch)
- **Live site**: https://atiwathp-debug.github.io/finvizer/
- **Supabase project URL**: `https://ofwfovxivjsxwgowsmtg.supabase.co` (double-check against `.env.local`/Supabase dashboard if it matters)

## 3. Completed passes (this round)

| Pass | Commit | What it did |
| --- | --- | --- |
| 1 | `204ec9c` | Hide "ส่งออก PDF" export for DRAFT documents; block direct `/documents/:id/print` access for drafts with a Thai message. New `canExportDocumentPdf(status)` in `documentPermissions.ts`. |
| 2 | `13ed551` | Dashboard: "เอกสารที่รอการอนุมัติ" — newest 5 pending-approval (DRAFT) documents, scoped to the dashboard's date-range filter. New `pendingApprovalDocuments()` in `documentReports.ts`. |
| 3 | `e72d754` | Dashboard: "ใบแจ้งหนี้ค้างชำระ" — newest 5 unpaid issued invoices (INVOICE + APPROVED), scoped to the date-range filter. New `unpaidInvoices()` in `documentReports.ts`. |
| 4 | `2e99d19` | Dashboard: "รายการใกล้ครบกำหนดเรียกเก็บเงินใน 2 วัน" — up to 5 unpaid invoices due today through today+2 days, sorted soonest-first. **Deliberately NOT scoped to the date-range filter** (operational, today-relative reminder, not a historical metric). New `dueSoonInvoices()` in `documentReports.ts`. Excludes overdue and null-dueDate invoices by design (see Pass 5 candidate below).

All four passes are purely additive (no existing line removed in any of them, confirmed via `git diff` at commit time), read-only, and each pass verified it left the prior passes' code byte-for-byte untouched before committing.

## 4. Current branch / deploy status

- `main` HEAD: `2e99d19931fcf9581e6ca7d25f8531928a8773ec` — pushed, working tree clean.
- `gh-pages` tip: `81239c5d440bf1891fb664c12557b9f3f0d2eab8` — an empty retrigger commit (identical tree to `073d143`, the real `deploy: 2e99d19` build) needed because GitHub's internal Pages publish step failed silently on the first attempt (see §6).
- **Confirmed live** (verified via direct bundle-hash fetch, not just "workflow succeeded"): live bundle is `assets/index-ZHUhO4GI.js`, matching the Pass 4 build. Deployment status for the retrigger came back `"state": "success"`. All 4 passes should be visible on the live Dashboard as of this handoff.

## 5. Important safety rules (standing process for this project)

- Work **one pass at a time only** — never bundle multiple passes into one turn.
- Before editing anything: inspect relevant files, propose a plan (what will change, which files, open design questions), and **wait for explicit approval** before touching code.
- After implementing a pass: run `npm run lint && npm run test && npm run build`, all must pass clean; report changed files, exact behavior changed, and a manual QA checklist.
- **Do not commit** until the user explicitly says manual QA passed.
- **Do not push** until the user gives a separate, explicit instruction to push (confirming a local commit exists is not authorization to push).
- **Do not deploy** beyond what pushing to `main` triggers automatically — never touch the GitHub Pages/Actions config itself without being asked.
- Avoid broad refactors, renaming, formatting-only changes, or moving files — every diff should be scoped tightly to the requested pass.
- Stage and commit only the exact files belonging to the current pass (verify with `git status --porcelain` before `git add`).

## 6. Known deploy issue: GitHub Pages internal publish can fail silently

GitHub's own internal "pages build and deployment" step (separate from our `.github/workflows/deploy.yml`) has now failed **three times** across this project's history, each time leaving the live site one deploy behind even though our own Actions workflow reported success and `gh-pages` had the correct build:
- 1st occurrence: retrigger commit `3e59a3b`
- 2nd occurrence: retrigger commit `e025f67`
- 3rd occurrence (this round, Pass 4): retrigger commit `81239c5`

**How to detect it:** don't trust "the Actions workflow succeeded" alone — that only confirms the push to `gh-pages`, not GitHub's separate internal publish. Always verify by comparing bundle hashes:
```
curl -s https://atiwathp-debug.github.io/finvizer/ | grep -oE 'assets/index-[A-Za-z0-9_-]+\.js'
```
against the `gh-pages` tip's actual `index.html` (`git show origin/gh-pages:index.html | grep -oE '...'`). You can also check the deployment status directly:
```
curl -s "https://api.github.com/repos/atiwathp-debug/finvizer/deployments?per_page=1"
```
then fetch that deployment id's `/statuses` sub-resource and look for `"state"` — `"failure"` confirms the quirk; `"success"` means it published correctly.

**The Dashboard page is a separate lazy-loaded chunk** (`assets/DashboardPage-*.js`, not the main `index-*.js` bundle) — if you need to verify Dashboard-specific feature code is actually live (not just the app shell), find that chunk's filename in the `gh-pages` tree (`git ls-tree -r --name-only origin/gh-pages | grep DashboardPage`) and fetch/grep it directly.

**Safe fix — empty commit directly on `gh-pages`, no source changes, `main` untouched:**
```
git fetch origin gh-pages
TREE=$(git rev-parse origin/gh-pages^{tree})
PARENT=$(git rev-parse origin/gh-pages)
NEW=$(git commit-tree "$TREE" -p "$PARENT" -m "Trigger GitHub Pages publish")
git push origin "$NEW":gh-pages
```
This has been used 3 times now and reliably resolves the issue within about a minute. Always get explicit user approval before pushing anything, including this retrigger — even though it changes no application content.

Separately: even after the CDN bundle hash is confirmed updated, a user's specific browser may still show a stale version due to this app's **PWA service worker** (`vite-plugin-pwa`, `generateSW` mode with asset precaching) caching old assets client-side. If live QA still looks wrong after the bundle hash matches, try a hard refresh or unregistering the service worker (DevTools → Application → Service Workers) before assuming there's a real problem.

## 7. Next planned pass: Pass 5A — soft delete, INSPECT/DESIGN ONLY

From the original `CLAUDE_HANDOFF.md`'s task list: "Controlled document deletion" is next. Current state: DRAFT-only **hard** deletion already exists (`documents_delete_draft_only` RLS policy + `deleteDraftDocument()` + a delete button/confirm dialog on `DocumentDetailPage.tsx`). It was never clarified what "controlled" deletion should add beyond that.

**Pass 5A is design/inspection only — do not implement, do not write a migration, do not touch schema.** Scope for Pass 5A:
1. Inspect current deletion logic end-to-end: `deleteDraftDocument`/`deleteMockDraftDocument`, the `documents_delete_draft_only` RLS policy (find the migration file), and the delete button + `ConfirmDialog` in `DocumentDetailPage.tsx`.
2. Propose a soft-delete design: does it need a new column (e.g. `deleted_at timestamptz` or `is_deleted boolean`)? Does it need a new RPC (mirroring the `approve_document`/`mark_document_paid` pattern) or can it stay a plain UPDATE given RLS? What happens to a soft-deleted document in existing queries (`listDocuments`, dashboard reports, revision/conversion lookups) — do they all need an implicit `WHERE deleted_at IS NULL`, and if so is that a bigger-than-"minimal" change touching many read paths?
3. Propose whether "controlled" also means a role restriction narrower than the current EDITOR-and-above delete permission, an audit trail entry, or something else — this needs explicit clarification from the user, same as the original handoff noted.
4. This is a **bigger, more invasive** change than Passes 1–4 (which were pure read-only additive aggregations) — it touches write paths and possibly every document read path, so it deserves its own careful scoping and explicit design approval before any code, more so than usual.

## 8. Commands to run at the start of the next session

```
cd /c/Users/thirada/finvizer      # or equivalent on the platform in use
git status --porcelain
git log --oneline -8
git rev-parse HEAD
git rev-parse origin/main          # after `git fetch origin`, should match HEAD
npm run lint && npm run test && npm run build   # sanity check tree is still green before any new work
```
If deploy freshness matters for the new task, also re-verify the live bundle hash against `gh-pages` tip per §6.

## 9. Do-not-touch logic list

From the original handoff (still applies):
- `mark_document_paid` (RPC + mock mirror `markMockDocumentPaid`)
- `create_document_conversion` (RPC + mock mirror `createMockDocumentConversion`)
- `approve_document`
- `cancel_document`
- Dashboard/report calculation files' *existing* logic (`src/lib/reports/documentReports.ts`, `src/features/dashboard/DashboardPage.tsx`) — extending them additively (as Passes 2–4 did) is fine; modifying existing functions/lines is not, without being explicitly asked.
- Numbering files (`numbering_settings`, sequence-generation logic)
- RLS/payment migrations

Additionally, from this round:
- Pass 1's PDF export gating (`canExportDocumentPdf`, `DocumentDetailPage.tsx`, `DocumentPrintPage.tsx`)
- Pass 2's pending-approval list/logic (`pendingApprovalDocuments`, its Dashboard section)
- Pass 3's unpaid-invoices list/logic (`unpaidInvoices`, its Dashboard section)
- Pass 4's due-soon list/logic (`dueSoonInvoices`, its Dashboard section, and its deliberate date-range-filter exemption)

None of the above should be modified except for genuine shared-layout-consistency needs, and even then only if the user explicitly asks for it in that pass's instructions.

## 10. Recommended next prompt

```
Read HANDOFF_FINVIZER_NEXT.md first.

After reading it:
1. Run git status --porcelain, git log --oneline -8, and confirm branch/latest commit.
2. Confirm current production/deploy state (bundle hash check if relevant).
3. Do not edit files yet.

PASS 5A ONLY — soft delete, INSPECT/DESIGN ONLY:
1. Inspect the current draft-deletion logic: deleteDraftDocument /
   deleteMockDraftDocument, the documents_delete_draft_only RLS policy
   (find its migration file), and the delete button + confirm dialog on
   DocumentDetailPage.tsx.
2. Propose a soft-delete design (schema change needed? new column? new
   RPC vs. plain UPDATE under RLS? impact on every existing document
   read path — listDocuments, dashboard reports, revision/conversion
   lookups?).
3. Ask me to clarify what "controlled" deletion should mean beyond the
   existing DRAFT-only hard delete (role restriction? audit trail?
   something else?) before proposing a final design.
4. Do NOT implement, migrate, or touch schema/code in this turn — design
   only. Stop after the plan and wait for my approval.

Do not commit. Do not push. Do not deploy. Do not start Pass 5B/implementation.
```
