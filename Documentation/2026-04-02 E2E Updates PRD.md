# PRD: Comprehensive E2E Test Suite Overhaul

**Date:** 2 April 2026
**Project:** DCCO Billing — Dolata & Co Attorneys Legal Billing System
**Author:** Development Team
**Status:** Draft

---

## 1. Problem Statement

The current E2E test suite (34 Playwright spec files) passes successfully but fails to catch real production issues. The time recording feature broke on the Jade deployment, yet all E2E tests passed. Root cause analysis reveals:

1. **Tests create data via API factories** rather than testing actual UI creation flows — so UI rendering bugs are never caught
2. **No data persistence verification** — tests don't reload pages to confirm saved data actually appears
3. **No financial calculation verification** — invoice totals, trust balances, and aging buckets are not validated against known values
4. **No console/debug log monitoring** — the app now has comprehensive debug logging (`src/lib/debug.ts`) but tests don't capture or check these logs
5. **No validation/error handling tests** — empty required fields, duplicate entries, and permission violations are untested
6. **Incomplete user workflows** — no test covers a full lifecycle (e.g., client → matter → time entry → invoice → send → pay)
7. **Tests run against a separate test database** with clean seed data that doesn't reflect production state

## 2. Objective

Overhaul all 34 E2E test files to be **comprehensive and realistic** — simulating actual user behaviour, verifying data accuracy, capturing debug logs, and testing error scenarios. When these tests pass, we should have high confidence that the app works correctly in production.

## 3. Success Criteria

- All E2E tests pass consistently (`npm run test:e2e`)
- Console error capture catches any 500 errors or unexpected browser console errors automatically
- Financial calculations verified with exact ZAR amounts (not regex approximations)
- Data persistence verified after page reloads for all create/edit operations
- Validation errors properly tested for required fields and invalid inputs
- Access control tested for all three roles (admin, fee_earner, assistant)
- Complete user workflow tested end-to-end: client → matter → fee entry → invoice → send → mark paid

## 4. Scope

### 4.1 In Scope

- All 34 existing E2E test files
- New test helper infrastructure
- Global setup updates (assistant user)
- Debug log verification integration
- API factory additions

### 4.2 Out of Scope

- Unit tests (already exist in `src/lib/__tests__/` and `src/__tests__/`)
- Visual regression testing (screenshot comparison)
- Performance/load testing
- Real SMTP email delivery testing
- Mobile responsive testing

## 5. Technical Design

### 5.1 New Helper Infrastructure

#### 5.1.1 Console Log Capture (`e2e/helpers/console-capture.ts`)

A utility class that attaches to Playwright's `page.on('console')` and `page.on('response')` events to capture all browser console output and network responses during each test.

**Key Methods:**

| Method | Purpose |
|--------|---------|
| `setup(page)` | Attach listeners to capture console messages and API responses |
| `assertNoErrors(ignorePatterns?)` | Fail test if any `console.error` messages exist (excluding Next.js HMR, favicon 404s, source map warnings) |
| `assertNoServerErrors()` | Fail test if any API response returned status >= 500 |
| `assertApiCalled(method, urlPattern, expectedStatus)` | Assert a specific API call was made with expected status |
| `getDebugLogs(namespace?)` | Retrieve captured debug log messages filtered by namespace (e.g., `[API:fee-entries]`, `[COMPONENT:FeeEntryForm]`) |
| `getApiCalls(urlPattern?)` | Return all captured API calls, optionally filtered |
| `reset()` | Clear captured data between tests |

**Integration Pattern:**
```typescript
test.describe('Feature', () => {
  let capture: ConsoleCapture

  test.beforeEach(async ({ page }) => {
    capture = new ConsoleCapture()
    await capture.setup(page)
  })

  test.afterEach(async () => {
    capture.assertNoErrors()
    capture.assertNoServerErrors()
  })
})
```

This ensures every single test automatically fails if any console errors or 500 responses occur — catching the exact class of issues that broke time recording on Jade.

#### 5.1.2 UI Interaction Helpers (`e2e/helpers/ui-actions.ts`)

Reusable functions that perform common UI workflows exactly as a real user would:

| Function | Description |
|----------|-------------|
| `createClientViaUI(page, data)` | Navigate to /clients, open sheet, fill form, submit, wait for API response |
| `createMatterViaUI(page, clientName, desc)` | Navigate to /matters, open sheet, search client, fill description, submit |
| `recordTimeViaUI(page, opts)` | Open FAB or navigate to matter, fill fee entry form (matter search, narration, duration, rate), submit |
| `createInvoiceFromMatterUI(page, matterId, narrations)` | Navigate to matter, select entries by narration text, click Invoice, create |
| `verifyAfterReload(page, expectedTexts[])` | Reload page and assert all expected text strings are visible |
| `fillAndBlur(page, locator, value)` | Fill input and trigger blur for debounced saves |

#### 5.1.3 Extended API Factories (`e2e/helpers/api-factories.ts`)

Add missing factory functions for test data setup:

| Factory | Purpose |
|---------|---------|
| `createInvoice(request, data)` | Create invoice from fee entries in one call |
| `transitionInvoice(request, id, action)` | Send invoice, mark paid |
| `createUser(request, data)` | Create user with role/credentials |
| `uploadBankStatement(request, csvContent)` | Upload bank CSV for reconciliation tests |

#### 5.1.4 Global Setup Updates

- Create `assistant` role user (email: `assistant@dcco.law`, password: `Assist1234!`, role: `assistant`)
- Save auth state to `e2e/.auth/assistant.json`
- Add `ASSISTANT_USER` constant and `ASSISTANT_STORAGE` path to `e2e/helpers/auth.ts`

### 5.2 Test File Updates — Detailed Specifications

#### HIGH PRIORITY — Core User Workflows

---

**01-auth-and-scaffold.spec.ts — Authentication & Navigation**

| # | New Test Case | What It Verifies |
|---|--------------|-----------------|
| 1 | Empty email field shows validation error | HTML5 required / custom validation fires |
| 2 | Empty password field shows validation error | Password field validation |
| 3 | Login with deactivated user fails | Inactive users blocked at auth layer |
| 4 | Session persists across page navigation | Navigate /clients → /matters → /dashboard without redirect |
| 5 | Sidebar active state highlights current page | CSS active class on current nav item |
| 6 | Browser console has no errors on initial load | ConsoleCapture.assertNoErrors() |

Debug log check: No `[API:*] -> 500` patterns in network responses after login.

---

**04-clients.spec.ts — Client Management**

| # | New Test Case | What It Verifies |
|---|--------------|-----------------|
| 1 | Create client with duplicate code shows 409 error | Backend uniqueness constraint surfaced in UI |
| 2 | Create client with empty required fields shows validation | clientName, clientCode are required |
| 3 | Create client with invalid email format | Email validation |
| 4 | Verify created client persists after reload | Data actually saved to database |
| 5 | Navigate back from client detail to list | Navigation works |

Debug log check: `[API:clients] POST` returns 201 on success, 409 on duplicate.

---

**05-matters.spec.ts — Matter Management**

| # | New Test Case | What It Verifies |
|---|--------------|-----------------|
| 1 | Create matter with empty description shows validation | Required field enforcement |
| 2 | Create matter without selecting client shows validation | Client selection required |
| 3 | Matter detail page shows all tabs | All UI sections render (Fees, Notes, Trust, etc.) |
| 4 | Matter owner is correctly assigned and displayed | Owner name visible on detail page |
| 5 | Verify created matter persists after reload | Data persistence |

Debug log check: `[API:matters] POST` returns 201.

---

**09-fee-entries.spec.ts — Time Recording (Critical Path)**

| # | New Test Case | What It Verifies |
|---|--------------|-----------------|
| 1 | Time entry amount calc: 1h30 @ R2000/hr = R3,000.00 | Financial calculation accuracy |
| 2 | Create entry with empty narration shows validation | Required field |
| 3 | Create time entry with zero duration shows validation | Duration required for time entries |
| 4 | Billing block rounding: 7 min → 12 min (6-min blocks) | Billing block logic |
| 5 | Discount 10% applied correctly | Discount calculation |
| 6 | Posting code selection works | Posting code saved with entry |
| 7 | Non-billable entry excluded from invoice selection | Billable flag enforced |
| 8 | Edit existing fee entry narration | Edit flow works |
| 9 | Delete fee entry | Deletion works |

Debug log check: `[API:fee-entries] POST` returns 201. On validation failure, returns 400.

---

**10-record-time-global.spec.ts — Global Time Recording**

| # | New Test Case | What It Verifies |
|---|--------------|-----------------|
| 1 | Submit without selecting matter shows validation | Matter required |
| 2 | Recorded time appears on timesheet page | Entry visible at /timesheet |
| 3 | Recorded time appears on matter detail | Entry visible at /matters/[id] |
| 4 | Different duration formats: 90, 1.5h, 1:30 | Parser handles all formats |
| 5 | Record time from non-dashboard page | FAB works everywhere |

Debug log check: POST to `/api/fee-entries` returns 201.

---

**12-timesheet.spec.ts — Timesheet View**

| # | New Test Case | What It Verifies |
|---|--------------|-----------------|
| 1 | Exact daily totals: Mon R4,000, Tue R6,000, Wed R2,000 | Financial accuracy |
| 2 | Weekly sum = R12,000.00 | Aggregation correct |
| 3 | Empty week shows "No entries" message | Empty state renders |
| 4 | Today button returns to current week | Navigation reset |
| 5 | Timesheet only shows current user's entries (fee_earner) | Access control |

Debug log check: `[API:fee-entries] GET` returns 200.

---

**13-invoicing.spec.ts — Invoice Creation**

| # | New Test Case | What It Verifies |
|---|--------------|-----------------|
| 1 | Full lifecycle: create → verify totals → send → paid | Complete billing workflow |
| 2 | Exact subtotal = sum of line item totalCents | Math correct |
| 3 | VAT calculated at 15% (if VAT registered) | Tax logic |
| 4 | Grand total = subtotal + VAT | Final amount correct |
| 5 | Re-invoicing same entries blocked (400) | Business rule enforced |
| 6 | Invoiced entries move from Unbilled to Invoiced tab | Status transition |
| 7 | Invoice with 0 entries cannot be created (400) | Validation |

Debug log check: `[API:invoices] POST` returns 201 with correct totalCents.

---

**15-send-invoice.spec.ts — Invoice Sending & Lifecycle**

| # | New Test Case | What It Verifies |
|---|--------------|-----------------|
| 1 | Send dialog pre-fills client email | Email pre-population |
| 2 | After sending, status badge changes to "Sent" | UI reflects state change |
| 3 | Full lifecycle: draft → sent → paid (via UI) | Complete invoice flow |
| 4 | Paid invoice shows payment date | paidAt displayed |
| 5 | Paid invoice has no edit/send buttons | Read-only after payment |

Debug log check: `[API:invoices/[id]/send] POST` called. `[API:invoices/[id]] PATCH` returns 200.

---

**17-trust-transactions.spec.ts — Trust Account**

| # | New Test Case | What It Verifies |
|---|--------------|-----------------|
| 1 | Create trust receipt via UI | Full form flow |
| 2 | Create trust payment via UI | Full form flow |
| 3 | Payment exceeding balance rejected (422) | Insufficient funds check |
| 4 | Inter-matter transfer via UI | Transfer form works |
| 5 | Exact balance: R50,000 receipt - R10,000 payment = R40,000 | Balance accuracy |
| 6 | Trust-to-business restricted to admin (403 for fee_earner) | Access control |

Debug log check: `[API:trust-entries] POST` returns 201. Insufficient funds returns 422.

---

#### MEDIUM PRIORITY — Data Accuracy & Access Control

**02-user-management.spec.ts**
- Duplicate email rejection (409)
- Reactivate deactivated user
- Assistant user cannot access /settings/users
- Fee earner cannot create users via API (403)

**03-firm-settings.spec.ts**
- Required field validation (empty firm name)
- Duplicate posting code rejection
- Edit/delete existing fee levels and posting codes
- Fee earner cannot access /settings (redirect)

**11-matter-transactions.spec.ts**
- Exact fee total calculation with known amounts
- Exact disbursement total: R500.00
- Tab switching between Unbilled and Invoiced

**14-invoice-pdf.spec.ts**
- PDF content contains firm name
- Non-existent invoice returns 404
- PDF for multi-line-item invoice generates correctly

**18-business-transactions.spec.ts**
- Create receipt/payment via UI
- Exact amounts display on page
- Payment without matter (office expense)

**19-trust-register.spec.ts**
- Exact balance amounts displayed on UI
- Total matches API response
- Register updates after new transaction

**20-bank-statement-import.spec.ts**
- Full upload via UI (file input, account type, submit)
- Invalid CSV format rejected
- Verify all line amounts match fixture

**21-reconciliation.spec.ts**
- Auto-match via UI button
- Reconciliation report counts displayed
- Manual match via UI

**22-debtors-age-analysis.spec.ts**
- Exact age bucket amounts based on known entries
- Paid invoice excluded from debtors
- Grand total on UI matches API

**24-fica-compliance.spec.ts**
- Upload FICA document via client detail page
- Change FICA status via UI
- Status persists after reload

**26-dashboard.spec.ts**
- KPI accuracy: "Held in Trust" matches trust register total
- "Unsent Invoices" count matches actual count
- WIP amount matches unbilled entries
- No console errors on load

**28-reports.spec.ts**
- Trial Balance: debits = credits
- Invoice Register: known invoice with exact amount
- WIP Report: unbilled entry amounts
- Fee Earner Performance: correct hours
- Report date range filter changes results

---

#### LOWER PRIORITY — Polish & Edge Cases

**06-practice-notes** — Multiple to-do items, special characters in notes
**07-practice-overview** — Zero results search, closed matter exclusion
**08-global-search** — No results state, Escape closes palette
**16-chart-of-accounts** — Balance updates after entries
**23-client-statements** — Exact running balance, PDF download
**25-collections** — KPI amounts, paid invoice updates
**27-fee-earner-chart** — Current month axis label
**29-trust-investments** — Balance accuracy
**30-matter-ledger** — Opening + transactions = closing balance
**31-diary-calendar** — Entry editing, assignment
**32-visual-design** — No changes needed
**33-fee-schedules** — Category management, fee schedule versioning
**34-data-import** — Actual import execution with real fixture files

---

## 6. Debug Log Integration Strategy

### 6.1 Automatic Error Detection

Every test file will use `ConsoleCapture` in `beforeEach`/`afterEach` hooks. This means:
- **Any console.error** during any test → test fails with the error message
- **Any API 500 response** during any test → test fails with the URL and error body
- This catches the exact class of issues that broke time recording on Jade

### 6.2 Specific Debug Log Assertions

For critical operations, tests will also assert that specific debug log messages appeared:
- After creating a fee entry: verify `[API:fee-entries] POST ... -> 201` in network responses
- After loading the timesheet: verify `[API:fee-entries] GET ... -> 200` in network responses
- After an expected validation failure: verify 400 response (not 500)
- After login: verify `[LIB:auth] Login successful` debug log present

### 6.3 Debug Log as Diagnostic Aid

When a test fails, the captured debug logs are included in the test failure output, providing:
- Which API calls were made and their response codes
- Which components rendered and what data they loaded
- The exact point of failure in the server-side flow

---

## 7. Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `e2e/helpers/console-capture.ts` | Console + network capture utility |
| `e2e/helpers/ui-actions.ts` | Reusable UI workflow functions |

### Modified Files
| File | Changes |
|------|---------|
| `e2e/helpers/api-factories.ts` | Add `createInvoice`, `transitionInvoice`, `createUser`, `uploadBankStatement` |
| `e2e/helpers/test-data.ts` | Add `ASSISTANT_USER`, `formatMinutes`, `daysAgo`, `futureDate` |
| `e2e/helpers/auth.ts` | Add `ASSISTANT_USER`, `ASSISTANT_STORAGE` |
| `e2e/global-setup.ts` | Create assistant user, save auth state |
| `e2e/tests/01-34` (all 34 files) | Add new tests, console capture, reload verification |

---

## 8. Acceptance Criteria

1. `npm run test:e2e` passes all tests (0 failures)
2. Every test file uses `ConsoleCapture` for automatic error detection
3. Every data mutation test (create/edit/delete) verifies persistence after reload
4. All financial values are asserted with exact ZAR amounts (not regex)
5. All three roles (admin, fee_earner, assistant) are tested for access control
6. At least one test covers the complete lifecycle: client → matter → time entry → invoice → send → mark paid
7. Validation errors tested for: empty required fields, duplicate codes/emails, insufficient funds
8. Debug logs are captured and available in test failure output for diagnostics

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Test flakiness from timing issues | Use Playwright's `waitForResponse`, `waitForSelector` with appropriate timeouts |
| Console capture noise (HMR, hydration) | Filter patterns in `assertNoErrors()` ignore list |
| Test database state leaking between tests | Tests run sequentially; each describe block creates its own data via `beforeAll` |
| Financial rounding differences | Use integer cents for all calculations, match `formatCurrency()` output exactly |
| SMTP not available in test env | Email send tests verify API call made (201/409), not email delivery |

---

## 10. Timeline Estimate

| Phase | Description |
|-------|-------------|
| Phase 1 | Create helper infrastructure (console-capture, ui-actions, factory additions) |
| Phase 2 | Update all 34 test files with new test cases |
| Phase 3 | Run full suite, fix failures, stabilise |
