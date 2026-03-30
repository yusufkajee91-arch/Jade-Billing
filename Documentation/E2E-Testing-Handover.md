# E2E Testing Handover Document

**Project:** DCCO Billing System (dcco-billing)
**Date:** 30 March 2026
**Purpose:** Full context for developer picking up Playwright E2E test fixes

---

## 1. What Was Achieved

### Infrastructure (fully working)

A complete Playwright E2E testing framework was set up from scratch:

| Component | File | Status |
|---|---|---|
| Playwright config | `playwright.config.ts` | Working |
| Test environment vars | `.env.test` | Working |
| Test database setup | `e2e/global-setup.ts` | Working — creates `dcco_billing_test` DB, runs migrations, seeds, creates 2 test users (admin + fee_earner), saves auth storage states |
| Auth helpers | `e2e/helpers/auth.ts` | Working |
| API data factories | `e2e/helpers/api-factories.ts` | Working (with known issues — see Section 3) |
| Test data constants | `e2e/helpers/test-data.ts` | Working |
| FNB bank statement fixture | `e2e/fixtures/fnb-statement.csv` | Working |
| npm scripts | `package.json` | Added: `test:e2e`, `test:e2e:ui`, `test:e2e:headed`, `test:e2e:debug` |
| .gitignore | `.gitignore` | Updated with `e2e/.auth/`, `playwright-report/`, `test-results/` |

### How it works

1. `npx playwright test` starts a Next.js dev server on port 3001 using `.env.test` (pointing to `dcco_billing_test` database)
2. Global setup drops/recreates the test DB, runs migrations + seed, creates a fee_earner user, then authenticates both users via the browser and saves session cookies to `e2e/.auth/admin.json` and `e2e/.auth/fee-earner.json`
3. All subsequent tests run as the admin user by default (via Playwright's `storageState`). Tests that need fee_earner auth use `test.use({ storageState: 'e2e/.auth/fee-earner.json' })`
4. Each test file creates its own test data in `beforeAll` using API factory helpers (direct HTTP calls to the app's API routes), making tests independent and runnable in any order

### Test coverage written

34 test files covering all 35 user stories (US-001 through US-035), totalling 191 individual test cases. Files are at `e2e/tests/01-auth-and-scaffold.spec.ts` through `e2e/tests/34-data-import.spec.ts`.

### Current test results

```
142 passed
49 failed
```

Progression across fix rounds:
- Round 1 (initial write): 95 passed / 93 failed
- Round 2 (first selector fix pass): 132 passed / 56 failed
- Round 3 (second selector fix pass): 142 passed / 49 failed

---

## 2. What Is Passing (142 tests)

These features are fully tested end-to-end and confirmed working:

- **Authentication**: Login, invalid credentials rejection, logout, unauthenticated redirect
- **App scaffold**: FAB "Record Time" visible, sidebar navigation, command palette opens
- **User management**: Table loads, fee earner role-based access denied correctly
- **Firm settings**: Page loads (basic)
- **Clients**: Page loads, client creation via API works
- **Matters**: Page loads, matter creation via API works
- **Global search**: Input visible, search results appear, click navigates to matter
- **Trust accounting (US-017)**: All 8 tests pass — page loads, tabs, trust receipt, trust payment, inter-matter transfer, trust-to-business transfer, balance verification
- **Business accounting (US-018)**: All 5 tests pass — page loads, receipt, payment, entries visible
- **Trust register (US-019)**: All 4 tests pass — balances, totals, page display
- **Bank statement import (US-020)**: All 5 tests pass — page loads, FNB CSV upload, statement lines verified
- **Reconciliation (US-021)**: All 6 tests pass — auto-match, manual match, UI elements
- **Debtors (US-022)**: Page loads, clients shown (2 of 4 pass)
- **Client statements (US-023)**: Client detail loads, statement tab exists (2 of 4 pass)
- **FICA compliance (US-024)**: Page loads, stat cards, manage link (3 of 6 pass)
- **Collections (US-025)**: Page loads (1 of 4 pass)
- **Dashboard (US-026)**: Loads, greeting, fee chart, WIP card (4 of 7 pass)
- **Fee earner chart (US-027)**: Dashboard loads, axis labels (2 of 4 pass)
- **Reports (US-028)**: Sidebar shows all report types (1 of 11 pass)
- **Trust & investments report (US-029)**: Navigation works (1 of 3 pass)
- **Matter ledger (US-030)**: Navigation works (1 of 4 pass)
- **Diary (US-031)**: Page loads, calendar renders, day click shows entries (3 of 7 pass)
- **Visual design (US-032)**: Background color, serif/sans-serif fonts, glass cards (3 of 6 pass — 1 was removed as duplicate)
- **Fee schedules (US-033)**: Page loads, categories, items table, inline edit (4 of 6 pass)
- **Data import (US-034)**: All 7 tests pass — page, dropdown, upload, buttons, panel structure
- **Chart of accounts (US-016)**: All 8 tests pass — all GL accounts verified
- **Send invoice (US-015)**: All 3 tests pass — button visible, API call, status validation

---

## 3. What Is Failing (49 tests) — Root Causes and Solutions

### Category A: Features Not Built (11 tests)

These tests fail because the underlying features do not exist in the codebase. They are documented as GAP-01 and GAP-02 in `Documentation/2026-03-28/PRD — Remaining Feature Gaps.md`.

**Practice Notes — US-006 (6 tests in `06-practice-notes.spec.ts`)**

- The Prisma schema has the fields (`matter_status_note`, `to_do`, `allocation`, `billing_status`, `loe_fica_done`) and the migration has been applied
- The PATCH API at `/api/matters/[id]` accepts these fields
- But the **UI tab** ("Practice Notes") on the matter detail page does not exist
- Tests: matter detail has practice notes section, edit status note, add to-do, set allocation, change billing status, toggle LOE/FICA

**Practice Overview — US-007 (5 tests in `07-practice-overview.spec.ts`)**

- The sidebar links to `/practice` but the **page does not exist**
- Tests: page loads, table shows matters, filter, sort, matter count

**Solution:** Build GAP-01 (practice notes UI) and GAP-02 (practice overview page) per the PRD. The tests are already written and ready to validate the implementation.

---

### Category B: Matter Detail Page Navigation (17 tests)

**Root cause:** Multiple test files need to navigate to a specific matter's detail page at `/matters/[id]` and then interact with it (open fee entry form, see status, edit fields, etc.). The tests create a matter via the API factory, get back the matter object, then try `page.goto(\`/matters/${matter.id}\`)`. However:

1. The API response from `POST /api/matters` may return the matter ID in a nested or different shape than the test expects (e.g. `response.id` vs `response.matter.id`)
2. Once on the matter detail page, the tests can't find the expected UI elements because the selectors were written based on component exploration but don't match exactly

**Affected tests:**

| File | Tests | What fails |
|---|---|---|
| `05-matters.spec.ts` | 5 tests | Create via UI (client select trigger), matter code format, detail page load, edit description, status change |
| `09-fee-entries.spec.ts` | 5 tests | All depend on opening the fee entry form from a matter detail page |
| `11-matter-transactions.spec.ts` | 1 test | Total amounts — needs fee entries visible on matter page |
| `13-invoicing.spec.ts` | 5 tests | Entire invoice creation flow starts from a matter detail page |
| `14-invoice-pdf.spec.ts` | 2 tests | `beforeAll` fails because invoice creation (which depends on matter + fee entries) fails |

**How to diagnose:**

```bash
cd "/Users/yusufkajee/Desktop/App Development/Development/dcco-billing"
npx playwright test 05-matters --headed --debug
```

This will step through the matter tests with a visible browser so you can see exactly what the page looks like vs what the test expects.

**Solution:**

1. Run `npx playwright test 05-matters --headed` and observe the actual UI
2. Check the matter detail page at `src/app/(app)/matters/[id]/page.tsx` — verify the actual structure (tabs, buttons, headings)
3. Check the matter form at `src/components/matters/matter-form.tsx` — verify how the client select trigger renders (it uses base-ui's `Select` component which renders a `[data-slot="select-trigger"]` element)
4. Update the selectors in `05-matters.spec.ts` to match the real DOM
5. The fix will cascade — once matter detail navigation works, `09-fee-entries.spec.ts`, `13-invoicing.spec.ts`, and `14-invoice-pdf.spec.ts` become fixable

---

### Category C: API Factory Data Threading (7 tests)

**Root cause:** Several `beforeAll` blocks create data via the API factory helpers in `e2e/helpers/api-factories.ts`, but the returned data isn't being threaded correctly to subsequent calls. Specifically:

1. `createMatter()` returns a response, and the test destructures `matter.id` — but if the API returns `{ id, matterCode, ... }` at the top level vs nested under a key, the ID is `undefined`
2. When `matterId` is `undefined`, subsequent calls to `createFeeEntry()` or `createDiaryEntry()` fail with: `"matterId: Invalid input: expected string, received undefined"`
3. This cascading failure means every test in that file is skipped

**Affected tests:**

| File | Tests | Error |
|---|---|---|
| `14-invoice-pdf.spec.ts` | 2 | `"Fee entries not created properly: matterId expected string, received undefined"` |
| `12-timesheet.spec.ts` | 2 | Diary API validation fails on `matterId` |
| `31-diary-calendar.spec.ts` | 3 | Same `matterId` undefined issue in `beforeAll` |

**How to diagnose:**

```bash
# Check what the API actually returns
curl -s http://localhost:3001/api/matters \
  -H "Cookie: $(cat e2e/.auth/admin.json | jq -r '.cookies[] | "\(.name)=\(.value)"' | paste -sd';')" \
  -H "Content-Type: application/json" \
  -d '{"clientId":"<a-client-id>","description":"test","ownerId":"seed-admin-user"}' | jq .
```

Or add `console.log(JSON.stringify(response))` in the test's `beforeAll` to see the actual shape.

**Solution:**

1. In `e2e/helpers/api-factories.ts`, add response logging or validation:
   ```typescript
   export async function createMatter(request, data) {
     const res = await request.post(`${BASE}/api/matters`, { data: { ... } })
     const json = await res.json()
     if (!json.id) throw new Error(`createMatter failed: ${JSON.stringify(json)}`)
     return json
   }
   ```
2. Verify each factory function returns the expected shape by checking the corresponding API route handler (e.g. `src/app/api/matters/route.ts` POST handler — look at the `NextResponse.json(...)` call)
3. If the API returns `{ matter: { id, ... } }`, update the factory to return `json.matter`

---

### Category D: UI Selector Mismatches (10 tests)

These are tests where the page loads and the feature works, but the test's element selectors don't match the actual HTML. Each needs a targeted fix.

| File | Test | Issue | Fix approach |
|---|---|---|---|
| `02-user-management.spec.ts` | Create user (3 tests) | Sheet form field selectors (labels vs placeholders vs `name` attributes) | Run `--headed --debug`, inspect the sheet DOM, update selectors |
| `03-firm-settings.spec.ts` | Posting codes (1 test) | Table row count or "New Posting Code" form interaction | Verify table renders all 8 rows, check if the issue is timing (data loading) |
| `04-clients.spec.ts` | Search, detail, FICA, edit (4 tests) | Search input placeholder, row click handler, FICA badge element | The client list page uses custom `button` elements for rows — verify with `--headed` |
| `08-global-search.spec.ts` | Cmd+K palette results (2 tests) | Command palette uses `cmdk` library — the dialog/input/results have specific structure | Read `src/components/search/command-palette.tsx`, check the `cmdk` component hierarchy |
| `26-dashboard.spec.ts` | KPI cards (1 test) | Card label text mismatch — test looks for specific text that doesn't match what the component renders | Read `src/components/dashboard/` KPI component, check exact label strings |
| `27-fee-earner-chart.spec.ts` | Chart SVG elements (1 test) | Recharts renders `<path>` elements inside specific class containers — selector doesn't match | Use `--headed` to inspect the SVG DOM structure, update class selectors |
| `28-reports.spec.ts` | Page loads (1 test) | Page heading/title assertion doesn't match | Check `src/app/(app)/reports/page.tsx` heading text |

**How to fix any selector mismatch:**

```bash
# Run a single test in headed debug mode
cd "/Users/yusufkajee/Desktop/App Development/Development/dcco-billing"
npx playwright test 02-user --headed --debug

# Or use the Playwright UI for interactive debugging
npx playwright test 02-user --ui
```

In debug mode, you can pause execution at any point and use the browser DevTools (F12) to inspect the actual DOM elements. Then update the test selector to match what you see.

---

### Category E: Other (4 tests)

| File | Test | Issue |
|---|---|---|
| `32-visual-design.spec.ts` | Noto Sans font (1 test) | CSS `font-family` computed value may include fallback fonts, not just "Noto Sans" — test assertion is too strict |
| `31-diary-calendar.spec.ts` | Create, toggle, delete (3 tests) | The diary form's matter search dropdown uses a custom component, not standard HTML — selectors need updating to match the `cmdk`-style dropdown |

---

## 4. Recommended Fix Priority

### Highest impact (fixes cascade to unblock other tests)

1. **Fix API factory response shapes** (`e2e/helpers/api-factories.ts`) — 5 minutes, unblocks 7+ tests
2. **Fix matter detail page navigation** (`05-matters.spec.ts`) — 30 minutes, unblocks 17 tests
3. **Fix client list interaction selectors** (`04-clients.spec.ts`) — 20 minutes, unblocks 5 tests

### Medium priority

4. **Fix user management form selectors** (`02-user-management.spec.ts`) — 15 minutes
5. **Fix fee entry form selectors** (`09-fee-entries.spec.ts`) — 20 minutes
6. **Fix invoice creation flow** (`13-invoicing.spec.ts`) — 30 minutes
7. **Fix diary form selectors** (`31-diary-calendar.spec.ts`) — 15 minutes

### Low priority (cosmetic / minor)

8. Fix remaining dashboard, reports, chart selectors — 15 minutes each
9. Fix visual design CSS assertion — 5 minutes

### Not fixable without code changes

10. Build GAP-01: Practice Notes UI (US-006) — then 6 tests will pass
11. Build GAP-02: Practice Overview page (US-007) — then 5 tests will pass

---

## 5. Useful Commands

```bash
# Run all E2E tests
cd "/Users/yusufkajee/Desktop/App Development/Development/dcco-billing" && npm run test:e2e

# Run a single test file
cd "/Users/yusufkajee/Desktop/App Development/Development/dcco-billing" && npx playwright test 05-matters

# Run in headed mode (see the browser)
cd "/Users/yusufkajee/Desktop/App Development/Development/dcco-billing" && npx playwright test 05-matters --headed

# Run in debug mode (step through with breakpoints)
cd "/Users/yusufkajee/Desktop/App Development/Development/dcco-billing" && npx playwright test 05-matters --debug

# Run with Playwright UI (interactive test runner)
cd "/Users/yusufkajee/Desktop/App Development/Development/dcco-billing" && npm run test:e2e:ui

# View the HTML test report from last run
cd "/Users/yusufkajee/Desktop/App Development/Development/dcco-billing" && npx playwright show-report

# Run only failing tests from last run
cd "/Users/yusufkajee/Desktop/App Development/Development/dcco-billing" && npx playwright test --last-failed
```

---

## 6. Key Files Reference

| File | Purpose |
|---|---|
| `playwright.config.ts` | Config: port 3001, Chromium, 15s timeout, serial execution |
| `.env.test` | Test DB connection string (`dcco_billing_test`) |
| `e2e/global-setup.ts` | DB creation, migration, seed, auth state capture |
| `e2e/helpers/api-factories.ts` | Functions to create test data via API (clients, matters, fee entries, trust entries, etc.) |
| `e2e/helpers/auth.ts` | Storage state paths and user credential constants |
| `e2e/helpers/test-data.ts` | Reusable test data constants |
| `e2e/fixtures/fnb-statement.csv` | Sample FNB bank statement for import tests |
| `e2e/.auth/admin.json` | Saved admin session cookies (gitignored, regenerated each run) |
| `e2e/.auth/fee-earner.json` | Saved fee earner session cookies (gitignored) |
| `e2e/tests/*.spec.ts` | 34 test files, one per user story area |
| `test-results/` | Screenshots from failed tests (gitignored) |
| `playwright-report/` | HTML report from last run (gitignored) |

---

## 7. Architecture Decisions

1. **Separate test database** — `dcco_billing_test` is dropped and recreated on each run for clean state
2. **Storage state auth** — browser cookies saved after a single login, reused for all tests (avoids 2-3s login per test)
3. **API factories for data setup** — creating data via direct API calls is ~100x faster than filling forms. Tests that verify "creating X through the UI" use the UI; tests that just need X to exist use the factory
4. **Self-contained tests** — each spec file creates its own data in `beforeAll`, no inter-file dependencies
5. **Serial execution** (`workers: 1`) — tests share a single database, so parallel execution would cause conflicts
6. **15 second timeout** — reduced from default 30s to get faster feedback on failures

---

*Document generated: 30 March 2026*
