# Trello Audit Report
**Generated:** 2026-04-23
**Board:** Casey — ID `69ccca063fec31d86ac34a38` ([open](https://trello.com/b/oOolK0V3/casey))
**Organization ID:** `5fa2701b1d9bed56a0aa8cfc`
**Codebase root:** `/Users/yusufkajee/Desktop/App Development/Development/dcco-billing` (cwd matches git root)
**Cache dir:** `.trello-audit-cache/69ccca063fec31d86ac34a38/`
**Report path:** `Documentation/trello-audit-2026-04-23.md`

## Summary
| Metric | Count |
|---|---|
| Total cards reviewed | 13 |
| Cards with image attachments | 5 |
| Cards with non-image attachments | 1 (Permission-Audit markdown) |
| Open | 9 |
| Partial | 2 |
| Unclear | 2 |
| Resolved | 0 (no card closed on-board yet) |
| Gaps found in code but not on board | 1 (low-severity) |

## Lists on this board
| List | List ID | Cards | Open | Partial | Unclear | Resolved |
|---|---|---|---|---|---|---|
| Triage | `69ccca10312e55a8159be989` | 13 | 9 | 2 | 2 | 0 |
| Backlog | `69ccca16a4216cfcf6035923` | 0 | 0 | 0 | 0 | 0 |
| Development | `69ccca1b7ae9e7938c1fbfdf` | 0 | 0 | 0 | 0 | 0 |
| Test | `69ccca29f4cbd64f636fa726` | 0 | 0 | 0 | 0 | 0 |
| Done | `69ccca34b90b2ffc09bbdf78` | 0 | 0 | 0 | 0 | 0 |
| Test failed | `69ccca32d442601f363113cd` | 0 | 0 | 0 | 0 | 0 |

## Labels referenced
Board has 6 default colour labels defined but **none are named and none are in use** on any card. No cards carry labels.

| Label | Label ID | Colour |
|---|---|---|
| (unnamed) | `69ccca073fec31d86ac34a63` | green |
| (unnamed) | `69ccca073fec31d86ac34a64` | yellow |
| (unnamed) | `69ccca073fec31d86ac34a65` | orange |
| (unnamed) | `69ccca073fec31d86ac34a66` | red |
| (unnamed) | `69ccca073fec31d86ac34a67` | purple |
| (unnamed) | `69ccca073fec31d86ac34a68` | blue |

## Board members
| Full name | Member ID | Username |
|---|---|---|
| Jessica-Jayde Dolata | `68aed1b54d41b4b161dc20b2` | @jessicajaydedolata2 |
| Laken Hrabar | `68aecfa94075b08f50d9b988` | @associate16 |
| Yusuf Kajee | `5fa26f8919236d4f3a46c807` | @yusufkajee2 |

No card currently has a member assigned.

---

## Open, Partial, and Unclear items (grouped by list)

### Triage — List ID `69ccca10312e55a8159be989`

---

#### Casey Color scheme to change (TBD)
**Card ID:** `69ccca4d25587fc3a17ab6be` (short: `pOpH18E4`)
**URL:** https://trello.com/c/pOpH18E4
**List:** Triage (`69ccca10312e55a8159be989`)
**Labels:** —
**Members:** —
**Status:** Open
**Due:** —

##### Issue
Change the app's colour scheme and allow each user to choose their own. Card calls out a prerequisite: "Require Pallet for Color scheme" — i.e. a design-system palette is needed before this can land.

Checklist items: none defined on the card.

##### Attachments
None.

##### Analysis
Verified `next-themes` is wired up: `ThemeProvider` at `src/app/layout.tsx:38` with `attribute="class" defaultTheme="light" enableSystem`; `useTheme` is consumed in `src/app/(auth)/login/page.tsx:10` and `src/components/layout/sidebar.tsx:7`. That gives **light / dark / system** toggling only — there is no palette concept, no per-user colour preference persisted in the database (grepped `prisma/schema.prisma` for `theme|colour|palette` → 0 hits), and no UI for choosing a palette. The card's "TBD" is accurate: the palette prerequisite has not been defined and no schema/UI exists to satisfy the "users pick their own" part. **Open.**

##### User Story
As a firm user (admin or fee earner), I want to choose my own Casey colour scheme from a defined palette, so that the UI reflects my preference and improves readability for my eyes without affecting anyone else's view.

##### Acceptance Criteria
- [ ] A documented colour palette (token names → hex/HSL) is added to `docs/` with approved primary, secondary, accent, destructive, success, warning colours for both light and dark modes.
- [ ] `prisma/schema.prisma` has a new `users.color_scheme` column (enum or FK to a `color_schemes` table), default `"default"`; migration applied and `PRISMA_SCHEMA_VERSION` in `src/lib/prisma.ts` bumped.
- [ ] Settings → profile page exposes a picker rendering the palette options as swatches; on save, PATCH `/api/users/me` (or equivalent) persists the choice.
- [ ] On app load, `ThemeProvider` (or a sibling provider) reads the user's `color_scheme` from the session/user record and applies it as CSS custom properties on the `<body>` — tokens from `src/app/globals.css` consume the variables rather than literal hex.
- [ ] Switching colour scheme in Settings updates all UI within the same session without a page reload.
- [ ] Admin-only "reset to default" button restores the firm default.

##### Proposed Solution
1. Author `docs/color-palette.md` documenting the approved palettes (call out tokens in `src/app/globals.css` at `hsl(var(--primary))` etc. that need mapping).
2. Add Prisma model: `model User { … colorScheme String @default("default") @map("color_scheme") }` and migrate. Bump `PRISMA_SCHEMA_VERSION` per `CLAUDE.md`.
3. Extend NextAuth JWT callbacks in `src/lib/auth.ts` to carry `colorScheme` on the token; update `src/types/next-auth.d.ts` to match.
4. Build a thin client-side palette applier component rendered inside `src/app/(app)/layout.tsx` after session hydrates, setting CSS vars on `<html>` or `<body>`.
5. Add the picker UI under a new Profile settings page. Reuse existing shadcn `Select` / `RadioGroup` primitives.

---

#### Review Permissions - Permission Audit
**Card ID:** `69cccc7b1fa365c3a48d4a11` (short: `C9idroZH`)
**URL:** https://trello.com/c/C9idroZH
**List:** Triage (`69ccca10312e55a8159be989`)
**Labels:** —
**Members:** —
**Status:** Partial
**Due:** —

##### Issue
An authored permission audit (30 March 2026) enumerated 11 issues (PA-001 … PA-011) with file:line references. This audit re-verifies every one of them against current code.

##### Attachments
- `69ccccaa107bc1e2f087f9ae` — `Permission-Audit_(1).md` — **Non-image reference** (text/markdown, 4.85 KB). Read in full; cited throughout this entry. Document identifies 3 critical, 4 functional, 1 missing-feature, and 3 ambiguity items. All 11 items re-verified below.

##### Re-verification table (as of today)

| ID | Original finding | Current state | Now |
|---|---|---|---|
| PA-001 | `posting-codes/route.ts:18` GET blocks non-admin | `src/app/api/posting-codes/route.ts:26` — `if (session.user.role !== 'admin') return 403` | **Still Open** |
| PA-002 | `fee-levels/route.ts:17` GET blocks non-admin | `src/app/api/fee-levels/route.ts:25` — same admin-only check | **Still Open** |
| PA-003 | `firm-settings/route.ts:68` GET blocks non-admin | `src/app/api/firm-settings/route.ts:53-69` — GET now only requires a session, no role gate | **Resolved** |
| PA-004 | `invoices/route.ts:65` blocks fee_earner POST | `src/app/api/invoices/route.ts:86-89` — only `assistant` blocked; fee_earner + admin allowed | **Resolved** |
| PA-005 | Matter notes POST admin-only | `src/app/api/matters/[id]/notes/route.ts:11-17` — `checkAccess()` allows admin OR owner/assigned fee_earner | **Resolved** |
| PA-006 | Matter attachments POST admin-only | `src/app/api/matters/[id]/attachments/route.ts:11-17` — same `checkAccess()` pattern | **Resolved** |
| PA-007 | `fee-schedules/route.ts:24` all endpoints admin-only | `src/app/api/fee-schedules/route.ts:43` — still `if (!session \|\| session.user.role !== 'admin')` | **Still Open** |
| PA-008 | No collections page for fee earners | `src/app/(app)/collections/page.tsx` exists; has no explicit role redirect and uses `CollectionsPage` client component fetching from an endpoint | **Resolved** (route exists; role gating appears permissive — see AC below) |
| PA-009 | `assistant` role not defined in user stories | Schema still includes `assistant`; fee-entries POST and invoices POST both explicitly block it (`route.ts:109-111`, `invoices/route.ts:86-89`) | **Unclear** (code is consistent — assistant = near-readonly — but there is still no documented spec) |
| PA-010 | Bank-matches POST allows fee_earner | `src/app/api/bank-matches/route.ts:34` — still allows admin OR fee_earner | **Unclear** (matches audit finding exactly; no product decision recorded) |
| PA-011 | Trust/business entry POST allows fee_earner | `src/app/api/trust-entries/route.ts:77` and `business-entries/route.ts:70` — still allow admin OR fee_earner | **Unclear** (same as above) |

Of the 11 original items: **5 Resolved** (PA-003/004/005/006/008), **3 Still Open** (PA-001/002/007), **3 Unclear/pending product decision** (PA-009/010/011). That's why this card is Partial: significant progress but 3 critical/functional issues (PA-001, PA-002, PA-007) still break the fee earner experience — each is what drives Card #11 (see below).

##### Analysis
Per-item greps with file:line:
- `rg -n "session.user.role !== 'admin'" src/app/api/posting-codes/route.ts` → hit at `:26` — PA-001 still Open.
- `rg -n "session.user.role !== 'admin'" src/app/api/fee-levels/route.ts` → hit at `:25` — PA-002 still Open.
- Read `src/app/api/firm-settings/route.ts:53-69` — GET returns settings for any authenticated session, no role check. PA-003 Resolved.
- Read `src/app/api/invoices/route.ts:80-89` — only assistant blocked on POST. PA-004 Resolved.
- Read `src/app/api/matters/[id]/notes/route.ts` + `attachments/route.ts` — both use shared `checkAccess(matterId, userId, role)` (notes `:11`, attachments `:11`) that allows admin OR owner/assigned user. PA-005 + PA-006 Resolved.
- `rg -n "session.user.role !== 'admin'" src/app/api/fee-schedules/route.ts` → hit at `:43`. PA-007 still Open — this is the upstream cause of Card #11 ("Forbidden when making something a disbursement") because the fee-entry form fetches `/api/fee-schedules` on mount (`src/components/time-recording/fee-entry-form.tsx:216`).
- `ls "src/app/(app)/collections/page.tsx"` — present. PA-008 Resolved (scope of role gating is a separate AC).

##### User Story (for the remaining Open items under this umbrella)
As a fee earner recording time, I want every data dropdown (posting codes, fee levels, fee schedules) to load from the API without a 403, so that the time-entry form is usable for non-admin roles.

##### Acceptance Criteria
- [ ] `src/app/api/posting-codes/route.ts:26` GET allows any authenticated session; POST/PATCH/DELETE remain admin-only.
- [ ] `src/app/api/fee-levels/route.ts:25` GET allows any authenticated session; POST/PATCH/DELETE remain admin-only.
- [ ] `src/app/api/fee-schedules/route.ts:43` GET (and `fee-schedules/[id]/items`) allows any authenticated session; POST/PATCH/DELETE remain admin-only.
- [ ] A fee_earner Playwright fixture can open the fee-entry form without any network request returning 403 (verifiable by a new e2e assertion that no `response.status === 403` occurs during form mount).
- [ ] After the three GETs open up, Card #11 is expected to disappear; link this card's closing note to that card's resolution.
- [ ] `Documentation/` has a short `permissions-decisions.md` capturing decisions for PA-009/010/011 (what `assistant` is allowed; whether fee_earner should retain bank-match + trust/business create).
- [ ] Collections page (PA-008) — confirm via `rg -n "session.user.role" "src/app/(app)/collections/page.tsx"` the page does not leak admin-only data to fee_earners; add a role-appropriate fetch scope if missing.

##### Proposed Solution
1. Change three one-line role guards in `posting-codes/route.ts:26`, `fee-levels/route.ts:25`, `fee-schedules/route.ts:43` from `!== 'admin'` to a simple session check. Each file already has mutation handlers that separately gate on admin, so GET-only opening is safe.
2. Add a unit test in `src/__tests__/` per route asserting GET returns 200 for `fee_earner` and `assistant` sessions.
3. Add an e2e test under `e2e/tests/` that logs in as the fee_earner fixture (`e2e/.auth/fee_earner.json`) and opens the fee-entry slide-over — assert no 403 responses during mount.
4. Write `Documentation/permissions-decisions.md` capturing the three pending product decisions; link back from the three Unclear items.

---

#### Connect Caisey to other apps
**Card ID:** `69ccd59228ee67d8a35cf0e1` (short: `P9I9l8GL`)
**URL:** https://trello.com/c/P9I9l8GL
**List:** Triage (`69ccca10312e55a8159be989`)
**Labels:** —
**Members:** —
**Status:** Open
**Due:** —

##### Issue
Integrate Casey with Word, Outlook, and Adobe so time spent / pages read / emails can be pulled into billing automatically. Exploratory request — no AC on card.

##### Attachments
None.

##### Analysis
`rg -rn "outlook|Outlook|adobe|Adobe" src/` → 0 hits. No integration scaffolding exists (no OAuth flow, no Microsoft Graph wiring, no Adobe CDP). This is a greenfield feature with significant scope. **Open.** Overlaps with Card `69de19a4fa17c9409d5ecebf` ("Add Agent to connect to outlook…") — recommend splitting: this card stays as an umbrella "integration strategy" discovery; the Outlook-specific piece is concretely tracked on the other card.

##### User Story
As a fee earner, I want my Outlook, Word, and Adobe activity on a matter (emails sent, time spent editing documents, pages read) pulled into Casey as suggested fee entries, so that I don't manually capture every unit of work.

##### Acceptance Criteria
- [ ] A discovery document at `Documentation/integrations-strategy.md` surveys Microsoft Graph (Outlook, Word) and Adobe Document Cloud APIs, listing data types available, auth flow, permission scopes, and privacy/POPIA implications.
- [ ] Decision recorded: which integration ships first, which is deferred.
- [ ] Split follow-up cards authored for each chosen integration with concrete scope (Outlook email ingestion is already on card `69de19a4fa17c9409d5ecebf`).
- [ ] No code shipped on this card — it is a discovery/decision card; closing requires a named decision doc and at least one concrete follow-up card in the `Backlog` list.

##### Proposed Solution
Write the discovery doc. Book a product/legal review (POPIA on email body ingestion is not trivial). Do not write any production code on this card.

---

#### Fix bug when inputting fees
**Card ID:** `69ce3b5859018d32900410ee` (short: `kD5wROeu`)
**URL:** https://trello.com/c/kD5wROeu
**List:** Triage (`69ccca10312e55a8159be989`)
**Labels:** —
**Members:** —
**Status:** Partial
**Due:** —

##### Issue
Card title is terse ("Fix bug when inputting fees") but the description is six **open product questions** for the business owners covering: who can record time, whether assistants act on behalf of fee earners, whether Collections/Reconciliation/Settings are admin-only, whether sidebar adapts by role, and cross-role workflows. Comments confirm Yusuf applied a patch on 2026-04-03 opening "Record Time" to all users pending the product answer.

##### Attachments
None.

##### Comments
- `69cfbb3ad0fbf6dcef53cbaf` — Yusuf Kajee (2026-04-03): "@jessicajaydedolata2 Post running test i found some issues with the roles can you review and provide info"
- `69cfbbdb8b849dd7c4a5cbe6` — Yusuf Kajee (2026-04-03): "@jessicajaydedolata2 For now i made any user able to record time, therefore at this point in time it works but as per question 1 have a think and let me know if i need to change it"

##### Analysis
Code state confirms the interim patch: `src/app/api/fee-entries/route.ts:109-111` blocks **only** `assistant`; fee_earner and admin can POST. GET at `:53` requires matching `earnerId` to `session.user.id` unless admin. So "record time" works end-to-end for fee_earner and admin; assistants cannot.

However, the product questions in the description are **not** answered by the patch:
1. Roles allowed to record time → interim: fee_earner only. Question 1 still open.
2. Collections visibility for non-admins → page exists at `src/app/(app)/collections/page.tsx` (client-side, no explicit role redirect). Question unanswered.
3. Reconciliation access → `src/app/(app)/reconciliation/page.tsx` exists. Question unanswered.
4. Settings hidden from non-admins → `settings/*/page.tsx` use `if (status === 'authenticated' && session.user.role !== 'admin') router.push('/dashboard')` pattern. Flashes briefly then redirects. Question unanswered (should links be hidden, not just redirect?).
5. Sidebar adapts by role → `src/components/layout/sidebar.tsx` does not branch on role (grep returned no `role` reference in sidebar). Links to pages the user can't use are visible. **Open.**
6. Assistants acting on behalf of fee earners → interim code bans assistants from POSTing fee entries and invoices. Not matched to a stated product direction.

Classification: **Partial** — a bug that was blocking time recording is resolved, but the six product questions are still open and one UX issue (sidebar not adapting) is a direct consequence.

##### User Story
As a non-admin user, I want the Casey sidebar and page access to reflect my role, so that I am not shown links or pages that fail or are empty for me.

##### Acceptance Criteria
- [ ] Product answers for each of the six questions are captured at `Documentation/permissions-decisions.md`. Where a role is excluded, that's documented; where a role is included, any existing code restriction is reversed.
- [ ] `src/components/layout/sidebar.tsx` filters navigation items by `session.user.role`, matching the permissions-decisions table exactly.
- [ ] Non-admin users no longer see a flash of any admin-only settings page before redirect — links are hidden at the source, and the per-page guard (`redirect('/dashboard')`) remains as a defence-in-depth check.
- [ ] The "Record Time" interim patch (line 109 blocking only `assistant`) is revisited against the product answer: if assistants must record on behalf of fee earners, a `feeEarnerId` override is accepted for role=assistant; otherwise the block stands with a note referencing the decision doc.
- [ ] New e2e test under `e2e/tests/` logs in as fee_earner and asserts the sidebar does not include `/settings/*`, `/reconciliation`, `/debtors` unless the product decision explicitly allows them.

##### Proposed Solution
1. Schedule a 30-minute product call; answer the six questions; write `Documentation/permissions-decisions.md`.
2. Refactor `src/components/layout/sidebar.tsx` to consume the session's role and filter the nav array accordingly. Keep the filter configuration co-located with the admin-only page list to avoid drift.
3. Update this card's description or split into six tracked follow-ups — the umbrella is currently too broad to move to Development.

---

#### Fix Fee Allocation / Graph
**Card ID:** `69dce6ee52e5ae07d8b97cfc` (short: `alDSFwxA`)
**URL:** https://trello.com/c/alDSFwxA
**List:** Triage (`69ccca10312e55a8159be989`)
**Labels:** —
**Members:** —
**Status:** Unclear
**Due:** —

##### Issue
Card title "Fix Fee Allocation / Graph". Empty description. No comments, no attachments, no checklist. Cannot determine scope from card alone.

##### Attachments
None.

##### Analysis
Grepped `rg -n "Allocation" src/` → several hits in `src/components/reports/` — but nothing obviously broken. The title could refer to:
- The "Fees Recorded" cumulative chart (but that has its own card `69de194aa7f074715b308dda` — "Add toggle on Fee graph").
- Fee entry allocation to matters (i.e. `matterId` selection in fee entry form).
- Report allocation (`src/components/reports/fee-performance-report.tsx`).

Without more detail from the card author, this is genuinely ambiguous. **Unclear.**

##### User Story
Blocked — the card author must specify which allocation/graph is broken and how.

##### Acceptance Criteria
- [ ] Card author (last edit 2026-04-13 per `dateLastActivity`) adds a description, screenshot, or linked card identifying the specific fee-allocation or graph view that is broken.
- [ ] Only after the above, a concrete card with testable AC is authored (either updating this card or splitting into follow-ups).

##### Proposed Solution
Ping the card's last editor (Yusuf Kajee) in a Trello comment asking which graph. Do not guess-implement.

---

#### Add toggle on Fee graph to show Fees inputted & Fees Billed
**Card ID:** `69de194aa7f074715b308dda` (short: `3rVH53Mv`)
**URL:** https://trello.com/c/3rVH53Mv
**List:** Triage (`69ccca10312e55a8159be989`)
**Labels:** —
**Members:** —
**Status:** Open
**Due:** —

##### Issue
The dashboard "fees graph" currently shows only Fees Recorded (i.e. captured/inputted). The card wants a toggle between **Fees Recorded** and **Fees Billed** so users can see how much of inputted work has actually been invoiced vs how much remains as WIP.

##### Attachments
- `69de1951965882bf3915580e` — `image.png` (404.8 KB, `image/png`) — **Type:** product screenshot with annotation. **Shows:** a cumulative line chart card titled "April — Cumulative". A small header pill at top-left reads "FEES RECORDED" with a red arrow drawn in pointing at it. Legend has three series: April, March, Target (dashed). Y-axis: R0 → R160k in R40k steps. X-axis: 1 → 31 (days of month). April line is flat at R0 for days 1–14 then drops slightly; March line rises from ~R10k to ~R155k; Target line is not visible in this month's data. Three-dots menu at top-right. Off-white rounded card, serif "April — Cumulative" heading. **Implies:** directly reinforces the card — the red arrow marks "FEES RECORDED" as the label that needs a toggle added next to it. Also confirms this is the `fees-chart` widget, not the `all-earners-chart` widget. **Greppable:** `"FEES RECORDED"` / `"Fees Recorded"`, `"April — Cumulative"`, `"Target"`, `"R160k"`.

##### Comments
- `69de19728c4bd420cd2848fd` — Jessica-Jayde Dolata (2026-04-14): "Want to add a toggle so we can see what fees we have inputted for the month vs. what fees have actually been billed so we can see accurate graphs on billed work"

##### Analysis
Ran `rg -n "Fees Recorded" src/components/dashboard/` → `fees-chart.tsx:175`. Read the component: the header pill at line 175 renders a **static** "Fees Recorded" string, and the series data is fetched from a single endpoint producing cumulative **recorded** cents. There is no toggle UI and no billed variant of the dataset. `rg -n "fees.*billed|Fees Billed" src/` → 0 hits anywhere in the codebase. So the billed cumulative series does not exist, either on the client or the API.

The confirmation is two-fold: (a) the literal text matches the screenshot's annotated label; (b) the `all-earners-chart.tsx:130` uses a very similar "Cumulative by Earner" pattern but also has no billed toggle — so this is a shared gap in both chart widgets, not a one-off. Classification: **Open.**

##### User Story
As a firm user viewing the dashboard, I want to toggle the cumulative fees chart between **Fees Recorded** and **Fees Billed**, so that I can see at a glance how much of the month's work has actually been invoiced versus captured but still WIP.

##### Acceptance Criteria
- [ ] `fees-chart.tsx:175` replaces the static "Fees Recorded" pill with a toggle control (two options: Recorded, Billed). Default is Recorded for backwards-compatible behaviour.
- [ ] A new API path or query param returns cumulative billed cents per day, derived from `invoices.issued_at` + `invoice_line_items.amount_cents`. Existing recorded dataset is unchanged.
- [ ] Switching the toggle re-plots the chart without a full page reload — the data is either re-fetched or pre-fetched for both series and swapped client-side.
- [ ] The chart header above the legend updates to read "Fees Recorded" or "Fees Billed" accordingly, matching the styling shown in `69de1951965882bf3915580e-image.png` (small-caps pill, serif "April — Cumulative" heading unchanged).
- [ ] The same toggle (or equivalent control) is added to `all-earners-chart.tsx:130`, or a follow-up card is authored explicitly excluding that widget from scope.
- [ ] Saved dashboard customisation persists the user's last-chosen toggle state per chart widget (nice-to-have; note this in AC but allow omission with a comment).

##### Proposed Solution
1. In `fees-chart.tsx` replace the static heading with a two-state toggle. Reuse the `Tabs` or `ToggleGroup` primitive from `src/components/ui/`.
2. Add a GET query param (e.g. `?series=recorded|billed`) to the existing dashboard-fees endpoint. Implement the billed aggregation server-side using the existing `invoices` + `invoice_line_items` tables; reuse the daily-cumulative shape.
3. When the toggle flips, `fetch()` the other series; cache the last fetched value per series in component state so flipping back is instant.
4. Decide on scope for `all-earners-chart.tsx` — either extend here (test-data permitting) or split.

---

#### Add Agent to connect to outlook to add all emails to matters by way of surname / ref nr etc
**Card ID:** `69de19a4fa17c9409d5ecebf` (short: `Pp3lZ8B9`)
**URL:** https://trello.com/c/Pp3lZ8B9
**List:** Triage (`69ccca10312e55a8159be989`)
**Labels:** —
**Members:** —
**Status:** Open
**Due:** —

##### Issue
Concrete slice of the broader integrations card (`69ccd59228ee67d8a35cf0e1`): a background agent pulls emails from Outlook and matches them to matters by surname / matter ref number / client code, auto-attaching them.

##### Attachments
None.

##### Analysis
`rg -rn "outlook|Outlook|msgraph|microsoft/graph" src/` → 0 hits. No OAuth setup, no agent infrastructure, no job runner. This is pure greenfield. **Open.**

There is an existing matter-attachments table (`src/app/api/matters/[id]/attachments/route.ts`) which the agent could write to, so the sink exists; the source and matching logic do not.

##### User Story
As a fee earner, I want Casey to periodically read my Outlook inbox and attach each matter-relevant email to the correct matter (matched by client surname, matter ref number, or matter code), so that the matter record is a complete evidence trail without me forwarding or uploading anything by hand.

##### Acceptance Criteria
- [ ] Fee earner can grant Casey OAuth access to their Outlook via a Settings page; token is stored encrypted (not in plaintext) in `user_integrations` or similar new table.
- [ ] A scheduled job (e.g. Next.js cron / external scheduler) polls Microsoft Graph `/me/messages` since last watermark, per connected user.
- [ ] Matching rule: email is attached to a matter when any of (a) the `matter_ref_number` appears in the subject, or (b) the client's surname + first-name initial appears in the from/to, or (c) the `matter_code` appears in the subject — exact rule set to be defined in a follow-up design doc.
- [ ] The resulting attachment on `matters.attachments` links back to the Outlook message via a stable `external_message_id`; re-running the job does not create duplicates.
- [ ] Fee earners can see a per-user sync status and last-run timestamp under Settings → Integrations.
- [ ] POPIA-compatible: only emails where the fee earner is a participant are read; email body storage is documented with retention policy.

##### Proposed Solution
1. Author `Documentation/integrations/outlook-agent.md` with the matching rules, consent UX, and POPIA considerations.
2. Add Prisma tables: `user_integrations` (userId, provider, accessToken, refreshToken, expiresAt, status), `email_sync_state` (userId, watermark), `matter_email_attachments` (matterId, attachmentId, externalMessageId).
3. OAuth flow under `src/app/api/integrations/outlook/*` (start + callback).
4. Worker script under `scripts/` invoked on a cron; not an in-process job.
5. New Settings → Integrations page.

---

#### image.png
**Card ID:** `69df571ac99651d2fd561a45` (short: `D9eZSljA`)
**URL:** https://trello.com/c/D9eZSljA
**List:** Triage (`69ccca10312e55a8159be989`)
**Labels:** —
**Members:** —
**Status:** Unclear
**Due:** —

##### Issue
This card's title is literally `image.png`. It has no description, no comments, no checklist. It was created on 2026-04-15 at 09:15:06, two seconds before the adjacent card `d0vVGoP7` ("Add quick button for Add client & Add matter at the bottom"). It carries a single image attachment — almost certainly a drag-and-drop that created its own card by accident instead of attaching to the adjacent one.

##### Attachments
- `69df571ac99651d2fd561af1` — `image.png` (226.4 KB, `image/png`) — **Type:** product screenshot. **Shows:** the right-hand side of the dashboard, centred on the "Today" widget. The widget card has a serif "Today" heading, uppercase "WEDNESDAY, 15 APRIL 2026" sub-heading, a check-circle icon and italic "You're all clear today." copy, and a rounded pill-shaped primary CTA labelled "RECORD TIME" with a clock icon. To the left, a sliver of a second card is visible showing "Full report →" and two currency values "39 719,25" and "34 760,…" (cut off). Off-white / warm-beige background, serif and sans typography mixed. **Implies:** the image's subject is the same dashboard region as the adjacent card 9 ("Add quick button for Add client & Add matter at the bottom") — there is currently only a RECORD TIME quick action, and the missing Add-client / Add-matter buttons are the visual gap. **Greppable:** `"You're all clear today."`, `"RECORD TIME"`, `"Full report"`, `"WEDNESDAY, 15 APRIL 2026"`.

##### Analysis
The screenshot's exact strings map straight to code: `rg -n "You.re all clear" src/` → `src/components/dashboard/widgets/tasks-widget.tsx:122`. That file also renders "Today" (`:112`) and the "RECORD TIME" button logic ties back to `src/components/layout/fab.tsx` which contains a single `RECORD TIME` pill CTA. So the image **documents the current state** of the dashboard: only RECORD TIME is present — no Add-client / Add-matter quick actions.

Given the identical subject and the one-second-apart creation timestamp, this card is almost certainly a drag-and-drop accident. It carries no independent scope of its own. **Unclear** → recommend archiving or merging into card `69df571c07a29f781c9812a1`.

##### User Story
(None — this card should be merged or archived; its scope is covered by `d0vVGoP7`.)

##### Acceptance Criteria
- [ ] Re-parent the attachment: move `69df571ac99651d2fd561af1` onto card `69df571c07a29f781c9812a1` ("Add quick button for Add client & Add matter at the bottom") so the image context is preserved.
- [ ] Archive this card (do not delete — keep the Trello ID for audit traceability).

##### Proposed Solution
In Trello: open card `D9eZSljA` → "Share" → "Copy the card's attachments to …" → card `d0vVGoP7`. Then archive `D9eZSljA`. (Low-risk board hygiene; no code change.)

---

#### Add quick button for Add client & Add matter at the bottom
**Card ID:** `69df571c07a29f781c9812a1` (short: `d0vVGoP7`)
**URL:** https://trello.com/c/d0vVGoP7
**List:** Triage (`69ccca10312e55a8159be989`)
**Labels:** —
**Members:** —
**Status:** Open
**Due:** —

##### Issue
Add quick-action buttons for **Add client** and **Add matter** at the bottom of the app, alongside the existing Record Time FAB.

##### Attachments
None directly — but the orphan card `69df571ac99651d2fd561a45` carries the visual evidence (see that card's entry); recommend re-parenting its attachment here.

##### Analysis
Read `src/components/layout/fab.tsx` in full (25 lines). Component is single-purpose: renders one fixed pill-shaped button at `bottom-8 right-8` that opens the time-recording slide-over via `useTimeRecording().open()`. No add-client or add-matter actions are plumbed. The two target pages exist: `src/app/(app)/clients/new/page.tsx` and `src/app/(app)/matters/new/page.tsx` (confirmed via `ls src/app/(app)/clients` and `src/app/(app)/matters`). So the actions are available elsewhere — they just aren't surfaced as quick actions. Classification: **Open.**

##### User Story
As a fee earner mid-workflow, I want quick-action buttons to Add Client and Add Matter fixed at the bottom of the screen, so that I can onboard a walk-in client or open a new matter without navigating away from whatever I'm doing.

##### Acceptance Criteria
- [ ] `src/components/layout/fab.tsx` is extended (or split into a small `FabGroup`) to render three actions: Record Time (existing), Add Client, Add Matter.
- [ ] Add Client navigates to `/clients/new`; Add Matter navigates to `/matters/new`.
- [ ] Buttons collapse on small viewports into a single "+" with a pop-over menu showing the three actions (matching the existing responsive behaviour of the current FAB at `md:` breakpoint).
- [ ] `assistant` role is respected: if product decides assistants cannot create clients or matters, those buttons are hidden based on `session.user.role` (see card `69ce3b5859018d32900410ee`).
- [ ] Visual match to the dashboard style shown in `69df571ac99651d2fd561af1-image.png` — rounded, same off-white/beige palette, icon-left-label-right layout.

##### Proposed Solution
1. Rename the existing `FAB` component to `FabGroup` (or keep `FAB` as a plural).
2. Render three `<button>` elements in a vertical stack at `bottom-8 right-8`, each a pill; bottom-most is Record Time (current), above it Add Matter, above that Add Client.
3. `useRouter().push('/clients/new')` / `/matters/new` on click. No state needed.
4. Add the role-gate hook once the permissions-decisions doc is written.

---

#### Reconcile all the Trust and Business transfers so clients can have statements
**Card ID:** `69df590a3c73644db61036f2` (short: `ShXkgfbm`)
**URL:** https://trello.com/c/ShXkgfbm
**List:** Triage (`69ccca10312e55a8159be989`)
**Labels:** —
**Members:** —
**Status:** Open
**Due:** —

##### Issue
Reconcile all historical trust and business transfers so that clients can receive accurate statements. Title implies this is an operational task (process outstanding reconciliation) rather than a feature build, but the card has no description and could also mean "fix the code that blocks reconciliation".

##### Attachments
None.

##### Analysis
Reconciliation infra exists: `src/app/api/reconciliation/report/`, `src/app/(app)/reconciliation/page.tsx`, `src/lib/fnb-csv-parser.ts`, and there are e2e tests at `e2e/tests/21-reconciliation.spec.ts`. One test inside that file is conditionally skipped (`:121`) but only when prior auto-matching has already consumed all unmatched lines — that is a self-healing guard, not a broken case.

The LP-parity import scripts (`scripts/phase*.mjs`) were run recently (per `docs/dataflow.md`: "LP-parity tables added 2026-04-20"). The current state: trust/business historical entries are imported, but **inter-account transfers** (the `linked_entry_id` pairs per `docs/dataflow.md`) may or may not be fully reconciled for every client — this card likely stems from a specific client where the statement PDF is missing or wrong. Without a description I cannot confirm which client(s).

Classification: **Open**. This is probably a data/operational task rather than a pure code change, but an AC-sharp card needs the client context first.

##### User Story
As a firm admin, I want every historical trust-to-business transfer reconciled and paired via `linked_entry_id`, so that I can generate an accurate statement PDF for any client on demand.

##### Acceptance Criteria
- [ ] Card description is updated with the list of client IDs (or matter IDs) whose statements are currently wrong or missing.
- [ ] A diagnostic script under `scripts/` produces a list of trust/business entries where an inter-account transfer is expected but `linked_entry_id` is null.
- [ ] Each unreconciled pair is either auto-matched (when amount + date + narration make it unambiguous) or manually reviewed and linked via a one-shot migration.
- [ ] `src/lib/statement-pdf.tsx` produces a statement PDF for each previously-affected client that matches the firm's expected balance — verified against a manually-generated Excel reconciliation for at least two sample clients.
- [ ] `e2e/tests/21-reconciliation.spec.ts` is extended with a test that takes a fixture client, generates a statement, and asserts opening + closing balance match known-good values.

##### Proposed Solution
1. Extend the card description: ask the card author for the specific clients / statements that were wrong.
2. Write the diagnostic script; run it against prod (read-only).
3. Manually review the top offenders; link via a migration.
4. Extend the e2e test.

---

#### Forbidden when making something a disbursement
**Card ID:** `69e5f375ad7ecfec721f5c69` (short: `BQXnfIe0`)
**URL:** https://trello.com/c/BQXnfIe0
**List:** Triage (`69ccca10312e55a8159be989`)
**Labels:** —
**Members:** —
**Status:** Open
**Due:** —

##### Issue
User sees a red "Forbidden" banner at the top of the fee-entry slide-over when capturing a disbursement.

##### Attachments
- `69e5f375ad7ecfec721f5c8e` — `image.png` (299.3 KB, `image/png`) — **Type:** bug screenshot. **Shows:** the fee-entry slide-over. Top of the form has a light-pink error banner with a red bullet icon and the text "Forbidden" (close × at top-right). Below: form fields — "NARRATION *" filled with "Pritning Affidavit and Annexures (20 pages)", "FROM FEE SCHEDULE" empty with placeholder "Search schedule items…", "QUANTITY" = 20, "FINANCIAL" header then "RATE PER UNIT (R)" = 12.00 and "DISCOUNT %" = 0 in paired spin-number inputs, an amount strip showing "Amount R 240,00" and "Total R 240,00", "POSTING CODE" dropdown displaying "seed-pc-disburse", and a "Billable / Include in client invoicing" toggle turned ON. **Implies:** the form successfully loaded posting codes (the posting-code dropdown shows `seed-pc-disburse`) **but** something upstream returned 403. The "Forbidden" banner sits above any submission action, so this most likely fires during the form-mount network fan-out rather than on submit. **Greppable:** `"Forbidden"`, `"Pritning Affidavit and Annexures"`, `"seed-pc-disburse"`, `"NARRATION"`, `"FROM FEE SCHEDULE"`, `"RATE PER UNIT"`, `"Include in client invoicing"`.

##### Analysis
Multiple greps traced this:
- `rg -n "Forbidden" src/app/api/fee-entries/` → `src/app/api/fee-entries/route.ts:55` (GET cross-earner block) and `:111` (assistant block on POST). Neither would produce a 403 for a fee_earner POSTing their own disbursement.
- Read `src/components/time-recording/fee-entry-form.tsx:193-220`: form mount issues five parallel `fetch()` calls — matters, users (lookup), fee_levels (lookup), posting_codes (lookup), firm-settings — then a separate `fetch('/api/fee-schedules')` on line 216 and per-category item fetches on line 221.
- `rg -n "session.user.role !== 'admin'" src/app/api/fee-schedules/route.ts` → hit at `:43`. Fee-schedules is still locked to admin (PA-007).
- `posting-codes/route.ts:26` and `fee-levels/route.ts:25` are also still admin-only (PA-001, PA-002).

So a fee_earner opening the disbursement form triggers at least three 403s during mount: `/api/posting-codes`, `/api/fee-levels`, and `/api/fee-schedules`. One of those responses is bubbling into the banner. The screenshot shows `seed-pc-disburse` selected, which means some posting-codes responded — likely the user was an admin when the posting-code list was cached from a prior open, or the lookup endpoint uses a different auth path — worth verifying. Either way, the root cause is **PA-001 / PA-002 / PA-007** (all Open under the Permission Audit card). Fixing those three GETs will almost certainly eliminate this banner.

Classification: **Open** — not a code bug in the disbursement path itself, but a downstream symptom of three unfixed permission gates.

##### User Story
As a fee earner capturing a disbursement, I want the form to open and submit without any "Forbidden" banner, so that I can record disbursements without a confusing error that doesn't explain itself.

##### Acceptance Criteria
- [ ] While logged in as the fee_earner Playwright fixture, opening the fee-entry slide-over and choosing "Disbursement" as the type produces **zero** network responses with `status === 403`. Asserted with a Playwright request listener in a new test in `e2e/tests/`.
- [ ] On submit of a disbursement fee entry by the fee_earner fixture, the response is `201 Created` and the row appears in the matter's All Unbilled tab with the narration and amount intact.
- [ ] The three GET endpoints from PA-001/002/007 are opened to authenticated sessions (see Permission Audit card acceptance criteria).
- [ ] If a residual "Forbidden" banner persists after those fixes, capture the exact failing request with Playwright and author a follow-up card with its URL and payload.

##### Proposed Solution
Land the Permission Audit fixes (three one-line changes in `posting-codes/route.ts:26`, `fee-levels/route.ts:25`, `fee-schedules/route.ts:43`). Re-run this scenario manually; add the Playwright test as a regression guard.

---

#### Dont like or need these here - stands for "time" / "unitary"
**Card ID:** `69e5f4154cfc552492e8137e` (short: `IdZL8Dwn`)
**URL:** https://trello.com/c/IdZL8Dwn
**List:** Triage (`69ccca10312e55a8159be989`)
**Labels:** —
**Members:** —
**Status:** Open
**Due:** —

##### Issue
The small "T" (time) and "U" (unitary) letters displayed under each DATE cell in the matter's "All Unbilled" table are unwanted and should be removed.

##### Attachments
- `69e5f4164cfc552492e813a2` — `image.png` (636.6 KB, `image/png`) — **Type:** product screenshot with annotations. **Shows:** the matter's All Unbilled table. Tabs along the top: "ALL UNBILLED" (active), "FEES", "DISBURSEMENTS"; a "RECORD TIME" button at top-right. Table columns: DATE, FEE EARNER, DESCRIPTION, DURATION, AMOUNT, ACTIONS. Rows visible: eight fee entries dated 08 Apr – 13 Apr 2026, all by "Laken Ash", descriptions including "Email received from client", "Email to client attaching signed Affidavit", "Travel Costs Incurred", "Pritning Affidavit and Annexures (20 pages)", "Email from client attaching affidavit", "Telephone call received from client", "Instruction received from client", "Opening File". Duration column shows "6 min" for time entries and "×18.000", "×20.000", "×1.000" for unitary entries. Six red arrows are drawn in, each pointing at a small tinted "T" or "U" character printed directly beneath the date. **Implies:** the visual clutter the user dislikes is the per-row letter indicator of entry type. The "T"/"U" are rendered redundantly because the Duration column already differentiates ("6 min" vs "×N.NNN"). Rows with "Travel Costs Incurred" and "Pritning Affidavit and Annexures" show "×18.000" and "×20.000" in Duration (both unitary) and have "U" badges. **Greppable:** `"ALL UNBILLED"`, `"FEES"`, `"DISBURSEMENTS"`, `"DATE"`, `"FEE EARNER"`, `"DESCRIPTION"`, `"DURATION"`, `"AMOUNT"`, `"ACTIONS"`, `"Pritning Affidavit and Annexures"`, `"Travel Costs Incurred"`, `"Opening File"`, `"Laken Ash"`.

##### Analysis
Read `src/components/matters/matter-detail.tsx:167-171`:

```ts
function entryTypeLabel(type: string) {
  if (type === 'time') return 'T'
  if (type === 'unitary') return 'U'
  return 'D'
}
```

Rendered in the All Unbilled row block at `:429-436`:

```tsx
<span className={`… ${entryTypeColor(entry.entryType)}`} title={entry.entryType}>
  {entryTypeLabel(entry.entryType)}
</span>
```

That's exactly what the red arrows point to. Also `entryTypeColor` at `:173-177` assigns colours per type. The feature appears to be cosmetic — nothing else in the file depends on the rendered letter. Removing the `<span>` block at `:430-436` and optionally the helper functions at `:167-177` cleanly deletes it. Classification: **Open.**

One caution: the `DateCell` also uses the type letter for colouring (`entryTypeColor`) — if we want to preserve type-based colouring on the date, keep `entryTypeColor` and only remove the letter render. The card says "stands for time/unitary" and wants these letters gone; it does not ask for a colour change.

##### User Story
As a user viewing the All Unbilled table, I want each row to show only the entry's date, fee earner, description, duration, and amount, so that the table isn't cluttered by a redundant one-letter type indicator I already infer from the Duration column.

##### Acceptance Criteria
- [ ] `src/components/matters/matter-detail.tsx:430-436` (the `<span>` rendering `entryTypeLabel(entry.entryType)`) is removed.
- [ ] The rest of the row layout is unchanged — Date, Fee Earner, Description (with optional posting code), Duration, Amount, Actions continue to render as in `69e5f4164cfc552492e813a2-image.png`.
- [ ] Duration column still displays `"6 min"` for time entries and `"×N.NNN"` (three-decimal-place thousandths) for unitary entries, unchanged from the current behaviour.
- [ ] If `entryTypeColor()` becomes unused after removal, delete it as well (confirmed via `rg -n "entryTypeColor"`).
- [ ] `entryTypeLabel()` is removed if unused after this change. If it's reused elsewhere (e.g. invoice preview), leave the helper in place and only drop the render.
- [ ] Manual verification: open a matter with at least one time + one unitary + one disbursement entry in the All Unbilled tab; confirm no "T"/"U"/"D" letters render under the Date cell.

##### Proposed Solution
1. `rg -n "entryTypeLabel" src/` — confirm current call sites.
2. Delete lines 430-436 in `src/components/matters/matter-detail.tsx` (the inner `<div className="flex items-center gap-1 mt-0.5">` block that wraps the type letter).
3. If the grep from step 1 returned only this file's internal use, delete `entryTypeLabel` and `entryTypeColor` from lines 167-177.
4. No schema or API change needed.

---

#### Cant read what these posting codes say
**Card ID:** `69e5f474f32b90533f9d56f9` (short: `TW7bWpnD`)
**URL:** https://trello.com/c/TW7bWpnD
**List:** Triage (`69ccca10312e55a8159be989`)
**Labels:** —
**Members:** —
**Status:** Open
**Due:** —

##### Issue
The POSTING CODE dropdown in the fee-entry form is too narrow: each option's description is cut off mid-word on the right edge.

##### Attachments
- `69e5f474f32b90533f9d571d` — `image.png` (196.9 KB, `image/png`) — **Type:** bug screenshot. **Shows:** a popover/dropdown opened below a "POSTING CODE" label, next to the "FINANCIAL" header. Options visible, each rendered as `<CODE>  <description>` with the description being truncated on the right edge of the popover: "None ✓", "EMAIL Email to clie", "CONSULT Consulta", "DRAFT Drafting", "RESEARCH Legal re", "ATTEND Court atte", "PHONE Telephone", "REVIEW Review an", "DISBURSE Disburs", "Z010 Attendance / C", "Z020 Drafting / Pre", "Z030 Perusal / Revi", "Z040 …" (last row cut off). A partial "CANCEL" button is visible at the bottom-right. **Implies:** the dropdown container width is bounded by the form column, but the option rows don't wrap or ellipsise gracefully — the text simply overflows and is clipped by the container's `overflow: hidden`. Posting codes have a two-part format: a short code (uppercase / Z-prefixed) and a multi-word description. The code is fully visible; the description is the casualty. **Greppable:** `"POSTING CODE"`, `"EMAIL"`, `"CONSULT"`, `"DRAFT"`, `"RESEARCH"`, `"ATTEND"`, `"PHONE"`, `"REVIEW"`, `"DISBURSE"`, `"Z010"`, `"Z020"`, `"Z030"`, `"Z040"`, `"Email to clie"`, `"Legal re"`, `"Court atte"`.

##### Analysis
Read `src/components/time-recording/fee-entry-form.tsx:693-713`:

```tsx
<Select value={watch('postingCodeId') ?? ''} onValueChange={…}>
  <SelectTrigger>
    <SelectValue placeholder="None" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="">None</SelectItem>
    {postingCodes.map((pc) => (
      <SelectItem key={pc.id} value={pc.id}>
        <span className="font-sans mr-2">{pc.code}</span>
        {pc.description}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

The `SelectContent` does not set an explicit width, so it inherits the trigger's width via Radix's default (via shadcn). In a narrow side-panel the trigger is only a few hundred pixels wide — hence the clipping. There is no `whitespace-nowrap` + scroll, no explicit `min-w`, no text truncation with tooltip. Options: (a) let each item wrap onto a second line by removing any `truncate`/`line-clamp` and adding `whitespace-normal`; (b) set `SelectContent` to `w-[--radix-select-trigger-width] min-w-[28rem]` or use a custom `width: var(--radix-select-trigger-width)`-plus pattern; (c) display only the code and use a separate typeahead search for the description. (a) is the minimal fix.

Classification: **Open** — simple CSS change, no logic impact.

##### User Story
As a user choosing a posting code in the fee-entry form, I want every option's full description to be readable, so that I can tell "Telephone call" from "Teleconference preparation" without having to select and re-read.

##### Acceptance Criteria
- [ ] Each `SelectItem` in `src/components/time-recording/fee-entry-form.tsx:704-710` renders its description without truncation — either by wrapping to the next line or by widening the `SelectContent` popover.
- [ ] The popover remains usable at 320 px viewport width (no horizontal scroll bar in the popover itself).
- [ ] All posting codes visible in `69e5f474f32b90533f9d571d-image.png` render with their full description: `EMAIL Email to client`, `CONSULT Consultation`, `DRAFT Drafting`, `RESEARCH Legal research`, `ATTEND Court attendance`, `PHONE Telephone call`, `REVIEW Review and annotation`, `DISBURSE Disbursement`, `Z010 Attendance / Consultation`, `Z020 Drafting / Preparation`, `Z030 Perusal / Review`, `Z040 Research` (exact strings from the seed data — confirm against `prisma/seed.ts`).
- [ ] The code portion (EMAIL / CONSULT / Z010 …) is still visually distinguished from the description (existing `<span className="font-sans mr-2">` treatment preserved or equivalent).
- [ ] Manual verification: open the fee-entry form, click POSTING CODE, scroll through all options, screenshot and compare against this card's attachment — no truncation mid-word.

##### Proposed Solution
1. In `src/components/time-recording/fee-entry-form.tsx:706-709`, change `<SelectItem>` children to either:
   - Add `className="whitespace-normal"` and let rows wrap, OR
   - Wrap in a flex container with `min-w-[24rem]` on the `SelectContent` if product wants single-line.
2. Prefer wrapping (option A) — keeps popover compact and honours responsive behaviour.
3. If `SelectContent` doesn't accept className for width in the current shadcn version, add a small wrapper CSS rule in `globals.css`.

---

## Gaps (in code, not on board)

Exhaustive sweep:
- `rg -rn --include='*.ts' --include='*.tsx' 'TODO|FIXME|HACK|XXX' src/ prisma/` → 3 hits, **all** in `src/generated/prisma/runtime/client.d.ts` (vendor-generated Prisma runtime). None in first-party code.
- Skipped tests sweep (`it.skip|test.skip|describe.skip|xit(|xtest(|@Disabled|@Ignore|XCTSkip`): only `e2e/tests/21-reconciliation.spec.ts:121` — a conditional `test.skip()` inside an if-branch when prior auto-matching has consumed all lines. This is self-healing branch skipping, not a permanently-disabled test — **not a gap**.
- Working tree status at audit time: `.gitignore` modified (this audit added `.mcp.json` + `.trello-audit-cache/`), `e2e/tests/13-invoicing.spec.ts` modified, `prisma/seed.ts` modified. All uncommitted but tracked — out of scope for a Trello audit.

### Gap #1 — Sidebar doesn't filter by role
**Evidence:** `rg -n "role" src/components/layout/sidebar.tsx` → 0 hits. The sidebar renders the same nav to admin, fee_earner, and assistant sessions. Non-admin users see links to `/settings/*`, `/reconciliation`, `/debtors` (admin-only pages) that either flash-then-redirect or render an empty state.
**Suggested card:**
- Title: "Sidebar: filter navigation by role"
- Target list: Triage (`69ccca10312e55a8159be989`)
- Suggested label IDs: — (no labels are named on this board — label names are empty; consider applying a colour or leave unlabeled)

**User Story**
As a non-admin user, I want the sidebar to hide navigation links to pages I cannot use, so that I'm not distracted by dead-end options.

**Acceptance Criteria**
- [ ] `src/components/layout/sidebar.tsx` accepts the session role and filters the nav list accordingly.
- [ ] fee_earner does not see: `/settings/*`, `/reconciliation`, `/debtors` (unless permissions-decisions says otherwise).
- [ ] assistant sees only pages their role has POST/GET access to.
- [ ] An e2e test for the fee_earner fixture asserts the forbidden links are absent from the sidebar DOM.

Note: This gap is effectively the same work already scoped inside card `69ce3b5859018d32900410ee` ("Fix bug when inputting fees") sub-question 5. If that card is resolved, this gap closes automatically — do not double-track; consider this note a signal to keep that card's AC on-scope.

---

## Resolved items (abbreviated)
None on-board. The closest-to-resolved area is the **Permission Audit card (`69cccc7b1fa365c3a48d4a11`)** which has shipped 5 of its 11 sub-items (PA-003, PA-004, PA-005, PA-006, PA-008). The remaining 3 Open sub-items (PA-001/002/007) are driving Card #11 and must ship before the card itself moves to Done. See the Partial entry for that card for the full Resolved sub-list.

---

## Methodology notes
- **Tool path:** MCP (`mcp__trello__*`) for board/lists/labels/members + one card-detail pull, then `curl` against `api.trello.com/1` for remaining attachment listings and comments — the MCP card-detail payload is very wide (includes full board metadata per call), so curl was cheaper for bulk.
- **Cards fetched:** 13 cards, all in Triage. 0 cards in Backlog/Development/Test/Done/Test failed.
- **Attachments downloaded:** 5 images (`image/png`, 226 KB–637 KB each) + 1 non-image reference (`text/markdown`, 4.85 KB). All 6 successfully downloaded via OAuth header.
- **HEIC conversions:** 0 (no HEIC attachments on this board).
- **Cache directory:** `.trello-audit-cache/69ccca063fec31d86ac34a38/` — gitignored via `.gitignore` line entry `.trello-audit-cache/`.
- **Throttling:** not needed — well below Trello's ~100 req / 10s soft limit.
- **Auth:** `TRELLO_API_KEY` + `TRELLO_TOKEN` from `.mcp.json` env (gitignored). No credentials written to this report.
- **Label IDs referenced:** the board's six colour labels exist but are all unnamed and unused — listed in the Labels table above for ID-traceability; not applied to any current card.
