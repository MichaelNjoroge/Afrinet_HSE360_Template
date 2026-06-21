# Phase 4 — Reporting Gamification + Control Centre + BI Dashboard + Per-module CSV

## Goal

Motivate every employee to compete on their **reporting index** (how many incidents, near-misses, observations, hazards, etc. they submit), and give admins a lively company-wide view in the Control Centre + Business Intelligence dashboard. Also finish the export toolbar by adding CSV.

## What you'll see when it ships

### For every employee (own account)
- A new **"My Reporting Index"** card on the Control Centre showing:
  - Cumulative count per module (Incidents, Near-Misses, Observations, Hazards, PPE Inspections, Safety Audits…)
  - **My rank** out of all active staff (e.g. "#7 of 42")
  - 12-month sparkline trend of their submissions
- A **company leaderboard** (bar chart) showing the top 10 reporters this month, with the current employee's bar highlighted. Names shown by default — set the tone that reporting is rewarded.
- Clicking any employee bar opens a drawer with that person's historical reporting stats (per module, per month, last 12 months).

### For admins / directors / HSE / HR managers
- All of the above **plus** a Control Centre + BI dashboard section:
  - Company-wide totals per module, MoM delta, % change
  - **Top 10 reporters** and **bottom 10 (encourage to report)** lists
  - Department breakdown (stacked bar)
  - Severity/closure mix donut for incidents and near-misses
  - Average closure SLA per module
- Same leaderboard, ranked across the whole company.

### Per-module CSV export
- The existing `<ReportActions>` toolbar gets a **Download CSV** button next to PDF/Print/Email, exporting the currently visible rows of that module with resolved employee names (not IDs).

## Technical breakdown

### 1. Database — one new view + one RPC
- `public.v_reporting_activity` — `UNION ALL` of `(module, actor_user_id, created_at)` rows from `incidents`, `near_misses`, `safety_observations`, `hazards`, `ppe_inspections`, `inspections`, `audits`, `safety_observations`, plus `actions`/`environmental_*` where applicable. `SECURITY INVOKER` so existing module RLS still hides what users shouldn't see. Grant `SELECT` to `authenticated`.
- `public.get_reporting_index(_window_months int default 12)` — `SECURITY DEFINER` RPC returning per-employee per-module monthly counts + rank. Returns `{ user_id, full_name, month, module, count }` rows. Grant `EXECUTE` to `authenticated` (rank visibility is intentional — it's the gamification).
- `public.get_employee_reporting_history(_employee_id uuid)` — same shape but filtered to one employee.

### 2. Server functions (`src/lib/reporting-index.functions.ts`)
- `getReportingIndex({ windowMonths })` — wraps the RPC, returns `{ leaderboard, perModuleTotals, monthlySeries, myRank, myRowsByModule }`.
- `getEmployeeHistory({ employeeId })` — wraps the per-employee RPC.

### 3. UI components
- `src/components/reporting-leaderboard.tsx` — bar chart (Recharts), highlights current user, click → opens drawer.
- `src/components/my-reporting-index-card.tsx` — KPI tiles + 12-month sparkline for the signed-in user.
- `src/components/employee-history-drawer.tsx` — drawer with per-module monthly history.
- `src/components/admin-bi-section.tsx` — admin-only roll-ups (company totals, MoM, department stacks, severity donut, SLA). Renders only when `has_role(admin|director|hse_manager|hr_manager)`.

### 4. Wire into dashboard
- In `src/routes/_authenticated/dashboard.tsx` `Overview` section: append `<MyReportingIndexCard />` + `<ReportingLeaderboard />` for everyone; append `<AdminBISection />` for admins.

### 5. CSV in `<ReportActions>`
- Add optional `rows: Array<Record<string,unknown>>` and `columns: Array<{ key, label, format? }>` props.
- New `Download CSV` button that builds a CSV in the browser (no extra dependency — small helper in `src/lib/csv-export.ts`).
- Call-sites that already render row tables pass their visible rows + a column map. Resolved names come from the existing `EmployeeNamesProvider`.

### 6. Performance
- The RPC aggregates server-side and returns ≤ ~12 months × ~10 modules × N employees rows — cheap. TanStack Query caches with `staleTime: 5 min`.

## Out of scope for this phase
- Per-module read scoping (Phase 3 leftover) — current RLS already allows view; the directory-fix already shipped resolves blank names. We can revisit if you want employees restricted to only "rows they participated in".
- Bonus mechanics / points/badges — index + rank only. Easy to add later on top of the same view.

## Order of execution
1. Migration (view + 2 RPCs).
2. `reporting-index.functions.ts`.
3. CSV helper + add CSV button to `<ReportActions>`.
4. Three reporting components.
5. Wire Overview tab + admin section.

Ship in one turn; verify with a quick non-admin login.
