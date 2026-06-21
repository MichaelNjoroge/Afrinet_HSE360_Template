# Prosel Safety Hub — Improvement Recommendations

_Last reviewed: 2026-06-17_

This document captures system-wide recommendations beyond the implemented Packs A–E. Items are grouped by impact and ordered roughly by effort-to-value.

---

## 1. Security & Compliance

### 1.1 Periodic role audit (Quarterly)
- Export `user_roles` and review each holder of `admin`, `hse_manager`, `director`, `hr_manager`.
- Confirm `hr_manager` is restricted to actual HR personnel (they can read all profile email/phone).
- Confirm only management holds level ≥ 4 (they can read all employee records).

### 1.2 Move `directory_names` to `SECURITY INVOKER`
- Today it is `SECURITY DEFINER` because it unions across employees + profiles. Long term, refactor the underlying tables or split into two invoker functions so RLS is enforced naturally and the linter warning disappears.

### 1.3 Rate-limit hardening
- `consume_endpoint_rate_limit` exists but is only wired into a subset of `/api/public/*` routes. Audit every public route and ensure each one calls it with a reasonable per-IP / per-key budget.

### 1.4 Storage bucket scoping review
- `hse-evidence`, `hse-secure-files`, `profile-photos`, `company-letterheads` are all private. Verify signed-URL TTLs are short (≤ 15 min) and that download links never reach the browser via plain props.

### 1.5 Have-I-Been-Pwned password check
- Enable HIBP on email/password sign-ups via Auth settings to block known-compromised passwords.

### 1.6 MFA for elevated roles
- Require TOTP / passkey enrolment for `admin`, `director`, `hse_manager` accounts.

---

## 2. Reliability & Operations

### 2.1 Email queue observability
- Add a Cloud-side dashboard reading from `email_send_log` (sent / failed / dlq counts last 24h, bounces from `suppressed_emails`).
- Page on any DLQ growth > 0 over a 1-hour window.

### 2.2 Scheduled-report failure visibility
- `report_subscriptions.failure_count` and `last_error` are populated but never surfaced. Add an admin panel row badge and weekly digest of failing subscriptions.

### 2.3 Backups & recovery drill
- Document PITR settings and run one restore drill into a scratch project per quarter.

### 2.4 Audit-log retention
- `user_activity_logs` and `workflow_events` grow unbounded. Add a monthly `pg_cron` task to archive > 18-month rows to cold storage and purge.

---

## 3. Data Quality & UX

### 3.1 Inline validation everywhere
- Several forms (incidents, hazards, audits) accept blank optional dates that later block closure. Add Zod schema parity between the server function and the form.

### 3.2 Bulk operations
- The notifications "select all + delete" pattern from Pack E is well-received. Apply the same pattern to: actions overdue list, hazards backlog, training due list.

### 3.3 Saved filters / "My views"
- Per-user saved filters on each register (incidents, hazards, audits). Persist in a new `user_saved_views` table.

### 3.4 Mobile field capture
- The current UI assumes desktop. A pared-down PWA shell for "Report an incident", "Log an observation", "Sign permit" would lift adoption.

---

## 4. Analytics & Insight

### 4.1 Leading-indicator dashboard
- Combine observations, near-misses, inspection findings, and training compliance into a single leading-indicator scorecard with monthly trend.

### 4.2 AI-narrated executive summary
- Extend the management-review AI drafting to produce a one-page monthly board summary auto-emailed to directors on the first working day.

### 4.3 Benchmark against ISO 45001 clauses
- Map each module's KPIs back to ISO 45001 clauses and surface clause-coverage on the management-review document.

---

## 5. Code Health

### 5.1 Shared `assertPermission` audit
- Grep every `createServerFn` and confirm a permission gate exists for every read and write. The objective-progress functions were the most recent gap (now fixed).

### 5.2 Component file size
- A few `module-packs-*.tsx` files exceed 800 LOC. Split per module into `<feature>/register.tsx`, `<feature>/dialog.tsx`, `<feature>/actions.ts`.

### 5.3 Typed Supabase responses
- Replace remaining `as never` casts (especially in `upsert` calls) with proper generated types from `src/integrations/supabase/types.ts`.

### 5.4 E2E smoke tests
- Add Playwright smoke flows for: sign in → create incident → close incident; create permit → approve → close. Run on every preview build.

---

## 6. Decisions still open

| Decision | Current state | Owner |
|---|---|---|
| Tighten `profiles` read scope (drop hr_manager full read) | Kept as intentional | HR / HSE lead |
| Tighten `employees` level ≥ 4 read scope | Kept as intentional | HSE manager |
| Enable HIBP password check | Not enabled | Admin |
| Require MFA for elevated roles | Not enforced | Admin |

---

_End of document._
