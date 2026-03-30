# Product Requirements Document — Remaining Feature Gaps

**Product:** DCCO Billing System (dcco-billing)
**Client:** Dolata & Co. Attorneys
**Date:** 28 March 2026
**Version:** 2.0 (revised after stakeholder interview)
**Status:** Final Draft
**Author:** Claude Code (Anthropic)

---

## 1. Purpose

This PRD defines the requirements for 9 features identified as unbuilt or partially-built during a comprehensive gap analysis of the 35 user stories against the current codebase. All other user stories (US-001 through US-035) have been verified as fully implemented.

---

## 2. Background

The DCCO Billing System was built across 8 phases covering scaffold, clients, matters, time recording, invoicing, GL/trust/business accounting, bank reconciliation, collections, dashboard, reports, and diary. A systematic review on 28 March 2026 compared every acceptance criterion against the codebase and identified the gaps documented below.

---

## 3. Decisions Log

The following decisions were made during a stakeholder interview on 28 March 2026. Each decision is referenced by its GAP ID throughout the document.

| # | Area | Decision | Rationale |
|---|------|----------|-----------|
| D1 | Auto-save feedback (GAP-01/02) | Subtle inline indicator (checkmark/text, fades after 2s) | Quieter UX for rapid multi-field editing; avoids toast noise |
| D2 | To-Do field format (GAP-01) | Structured checklist — JSON array of `{text, done}` | Matches US-006 spec exactly: "numbered list with checkboxes, check = strikethrough" |
| D3 | Practice Overview data loading (GAP-02) | Client-side filter/sort, single API fetch | Firm has <500 open matters; matches existing `matters-view.tsx` pattern |
| D4 | Report file structure (GAP-06) | Extract ALL reports into individual files | Clean separation; reports-view.tsx is already ~994 lines |
| D5 | Excel export location (GAP-06) | Client-side generation in browser | No extra API calls; `xlsx` library already installed; simpler architecture |
| D6 | Audit ledger sign convention (GAP-08) | Signed single Amount column (negative = held, positive = out) | Matches US-030 spec and LawPractice ZA export format for auditor familiarity |
| D7 | Retained earnings (GAP-09) | Dynamic calculation at report time | No schema change needed; cumulative income - expenses up to as-at date |
| D8 | Allocation dropdown source (GAP-01) | Pull from active Users table + allow free-type | Always current if staff changes; still supports external names |
| D9 | Fee level/posting code deactivation (GAP-04) | Soft deactivate with confirmation dialog | Matches existing user deactivation pattern; hidden from dropdowns, existing records unaffected |
| D10 | Statement PDF size (GAP-05) | No hard limit; warn if >200 entries | User already picks date range; warning prevents surprise slow generation |
| D11 | Trust/bank discrepancy (GAP-07) | Yellow warning banner, non-blocking | Report still generates; discrepancy flagged clearly for investigation |
| D12 | Row status indicators (GAP-02) | Icon-based indicators in a dedicated column | Stackable, accessible, clearer than background colours. Red shield (FICA), amber clock (overdue), green check (paid) |
| D13 | Testing approach | Test critical paths only | Excel export utility, matter-ledger balance calcs, practice notes PATCH, trust register as-at filter. Skip straightforward CRUD |

---

## 4. Scope

### 4.1 In Scope

| ID | Feature | Originating User Story | Severity |
|----|---------|----------------------|----------|
| GAP-01 | Practice Notes on Matter — schema fields + inline-edit UI | US-006 | High |
| GAP-02 | Practice Overview Page | US-007 | High |
| GAP-03 | Associated Matters UI | US-005 | Medium |
| GAP-04 | Fee Levels & Posting Codes Settings Pages | US-003 | Medium |
| GAP-05 | Client Statement PDF Export | US-023 | Medium |
| GAP-06 | Excel Export for All Reports | US-028 | Medium |
| GAP-07 | Trust & Investments Monthly Report (3-sheet Excel) | US-029 | High |
| GAP-08 | Detailed Matter Ledger — Audit Report | US-030 | High |
| GAP-09 | Financial Reports — P&L, Balance Sheet, GL Detail | US-028 | High |

### 4.2 Out of Scope

- All PIN-001 through PIN-011 (future phase items)
- Logo upload API — already exists at `src/app/api/upload/route.ts`
- Any features already verified as complete

---

## 5. Feature Requirements

### 5.1 GAP-01: Practice Notes on Matter (US-006)

**Priority:** High (prerequisite for GAP-02)

**Problem:** The Matter model has only a generic `notes` text field. The 6 dedicated practice note fields required by US-006 do not exist in the database or UI.

**Requirements:**

| Req ID | Requirement | Acceptance Criteria |
|--------|------------|-------------------|
| G01-R1 | Add `matterStatusNote` field (text, nullable) to Matter model | Field exists in DB, accepts free-form text |
| G01-R2 | Add `toDo` field (text, nullable) to Matter model | Stores JSON array of `{text: string, done: boolean}` objects. Renders as numbered checklist with checkboxes. Checked items show strikethrough + muted text. **(Decision D2)** |
| G01-R3 | Add `allocation` field (string, nullable) to Matter model | Combobox populated from active Users table (fee earners + admins) with free-type allowed for external names. **(Decision D8)** |
| G01-R4 | Add `comment` field (text, nullable) to Matter model | Field exists in DB, accepts free-form text (court dates, notes) |
| G01-R5 | Add `billingStatus` enum field to Matter model | Enum values: `paid`, `awaiting_payment`, `not_yet_billed`. Default: `not_yet_billed` |
| G01-R6 | Add `loeFicaDone` boolean field to Matter model | Default: `false`. Rendered as a Switch toggle |
| G01-R7 | PATCH `/api/matters/[id]` accepts all 6 new fields | API validates and persists each field independently |
| G01-R8 | New "Practice Notes" tab on matter detail page | Tab displays all 6 fields in an editable layout |
| G01-R9 | All fields auto-save on blur (click-away) | No save button. Each field triggers an independent PATCH on blur. Subtle inline "Saved" indicator (checkmark) appears for 2 seconds then fades. **(Decision D1)** |

**Technical Notes:**
- This introduces the first inline-edit (onBlur auto-save) pattern in the codebase. All other editing currently uses modal/sheet forms. The pattern must be established cleanly here so GAP-02 can reuse it.
- Prisma migration required. New `BillingStatus` enum with `@default(not_yet_billed)` handles existing rows without data backfill.
- To-Do JSON structure: `[{"text": "File POA", "done": false}, {"text": "Submit TM2", "done": true}]`

**Edge Cases:**
- Concurrent edits: Last-write-wins is acceptable for a small firm. No optimistic locking needed.
- Empty to-do list: Render an "Add item" button. Store as `[]` (empty array), not `null`.

---

### 5.2 GAP-02: Practice Overview Page (US-007)

**Priority:** High
**Depends on:** GAP-01

**Problem:** No firm-wide view of all open matters with their practice notes exists. Fee earners and admins have no single page to see what needs attention across the practice.

**Requirements:**

| Req ID | Requirement | Acceptance Criteria |
|--------|------------|-------------------|
| G02-R1 | New page at `/practice` accessible from sidebar | Route exists under Practice nav group |
| G02-R2 | Table displays all open matters with practice note columns | Columns: Matter Code, Client, Description, Owner, Status Note, To-Do (count), Allocation, Comment, Billing Status, Status Icons, LOE/FICA |
| G02-R3 | Practice note columns are inline-editable | Click a cell to edit, save on blur via PATCH `/api/matters/[id]`. Subtle inline save indicator. **(Decision D1)** |
| G02-R4 | Filter by allocation, matter type, text search | Filter controls above table |
| G02-R5 | Sort by any column | Click column header to toggle sort direction |
| G02-R6 | Status icon column with stackable indicators | Dedicated "Status" column with icons: red shield (FICA incomplete), amber clock (overdue diary entry), green check (paid + no to-dos). Multiple icons can appear per row. **(Decision D12)** |
| G02-R7 | Role-based scoping | Admin sees all matters. Fee earners see only matters they are allocated to or own |
| G02-R8 | Matter count displayed at top | Shows total count of filtered results |
| G02-R9 | Resizable columns saved to localStorage | Consistent with existing matters table pattern |
| G02-R10 | Client-side filtering and sorting | All open matters fetched in a single API call. Filter/sort happens in the browser. **(Decision D3)** |

**Technical Notes:**
- Follow `matters-view.tsx` patterns for glass cards, resizable columns, sorting.
- Inline editing reuses the onBlur pattern established in GAP-01.
- To-Do column shows count (e.g., "2/5 done") rather than the full checklist. Click to expand/edit.
- Icon tooltips: hover to see label (e.g., "FICA incomplete", "Diary entry overdue").

**Edge Cases:**
- Matter with no diary entries: no amber icon shown (absence, not "no overdue").
- Matter with all to-dos complete and billing status "paid": green check only.

---

### 5.3 GAP-03: Associated Matters UI (US-005)

**Priority:** Medium

**Problem:** The `MatterAssociation` model exists in the Prisma schema with `matterId`, `associatedMatterId`, and `relationshipNote` fields, but there is no API or UI to manage associations.

**Requirements:**

| Req ID | Requirement | Acceptance Criteria |
|--------|------------|-------------------|
| G03-R1 | GET `/api/matters/[id]/associations` returns all linked matters | Returns associations in both directions (as primary or as associated) with matter details |
| G03-R2 | POST `/api/matters/[id]/associations` creates a link | Body: `{ associatedMatterId, relationshipNote? }`. Validates target exists and duplicate prevented |
| G03-R3 | DELETE `/api/matters/[id]/associations` removes a link | Body: `{ associatedMatterId }`. Removes the pair |
| G03-R4 | New "Associated" tab on matter detail page | Shows table of linked matters: matter code, description, client, status badge, relationship note, remove button |
| G03-R5 | Typeahead search to add new associations | Matter search input with dropdown results, consistent with existing search patterns |

**Edge Cases:**
- Closed/suspended associated matters: Association remains visible. Closed matters show a muted status badge. User can still see historical links. **(Decision: keep association, show status)** No auto-removal on close.
- Self-association: API rejects linking a matter to itself.
- Duplicate prevention: API returns 409 if the pair already exists (in either direction).

---

### 5.4 GAP-04: Fee Levels & Posting Codes Settings (US-003)

**Priority:** Medium

**Problem:** `settings-nav.tsx` already links to `/settings/fee-levels` and `/settings/posting-codes`, but the pages do not exist. The lookup API returns read-only data, but no CRUD endpoints exist for admin management.

**Requirements:**

| Req ID | Requirement | Acceptance Criteria |
|--------|------------|-------------------|
| G04-R1 | Fee Levels page at `/settings/fee-levels` | Admin-only. Table listing: name, hourly rate (ZAR), sort order, active status |
| G04-R2 | CRUD operations for fee levels | Create, edit (via sheet/modal), toggle active status. API endpoints: GET/POST `/api/fee-levels`, PATCH/DELETE `/api/fee-levels/[id]` |
| G04-R3 | Posting Codes page at `/settings/posting-codes` | Admin-only. Table listing: code, description, default billable toggle, sort order, active status |
| G04-R4 | CRUD operations for posting codes | Create, edit (via sheet/modal), toggle active status. API endpoints: GET/POST `/api/posting-codes`, PATCH/DELETE `/api/posting-codes/[id]` |
| G04-R5 | Soft deactivation with confirmation dialog | Deactivated items hidden from dropdowns for new entries. Existing records unaffected. Confirmation dialog: "This item will no longer appear in dropdowns but existing entries are unaffected." **(Decision D9)** |

**Technical Notes:**
- Follow `settings/users/page.tsx` pattern exactly: SettingsNav header, glass card table, Sheet-based create/edit form with react-hook-form + zod.

---

### 5.5 GAP-05: Client Statement PDF Export (US-023)

**Priority:** Medium

**Problem:** The client statement tab renders correctly as an HTML table with date filtering, but there is no PDF download option as required by the user story.

**Requirements:**

| Req ID | Requirement | Acceptance Criteria |
|--------|------------|-------------------|
| G05-R1 | PDF document template for client statements | Firm header, "CLIENT STATEMENT" heading, client info, date range, entries table (Date, Reference, Description, Debit, Credit, Balance), totals footer |
| G05-R2 | API endpoint GET `/api/clients/[id]/statement/pdf` | Query params: `from`, `to`. Returns PDF buffer with correct Content-Type and Content-Disposition headers |
| G05-R3 | "Download PDF" button on client statement tab | Button visible alongside existing "Load Statement" button. Opens PDF in new tab or triggers download |
| G05-R4 | Large statement warning | If API query returns >200 entries, show a yellow info banner: "Large statement — PDF may take a moment to generate." Non-blocking. **(Decision D10)** |

**Technical Notes:**
- Follow `src/lib/invoice-pdf.tsx` pattern: same font registration (PlayfairDisplay, NotoSans), same colour constants, same StyleSheet approach.
- Reuse statement data query logic from `src/app/api/clients/[id]/statement/route.ts`.
- No hard date range limit enforced. User already selects dates explicitly.

---

### 5.6 GAP-06: Excel Export for All Reports (US-028)

**Priority:** Medium

**Problem:** All 9 existing reports render in-browser with print support only. The user stories require "Export to Excel and/or PDF" for all reports.

**Requirements:**

| Req ID | Requirement | Acceptance Criteria |
|--------|------------|-------------------|
| G06-R1 | Shared Excel export utility | Client-side function `exportToExcel(sheets[], filename)` using the installed `xlsx` library. Supports multiple sheets, column headers, and column widths. **(Decision D5)** |
| G06-R2 | "Export Excel" button on ReportHeader | Button appears alongside existing Print button on all reports |
| G06-R3 | Each existing report wires export handler | All 9 reports pass their current data to the export utility |
| G06-R4 | Extract all reports into individual files | Each report component moves to its own file under `src/components/reports/`. Main `reports-view.tsx` becomes a shell that imports and renders selected report. **(Decision D4)** |

**Technical Notes:**
- `xlsx` v0.18.5 is already installed (used for import). Write via `XLSX.utils.json_to_sheet` + `XLSX.writeFile`.
- Export runs client-side in the browser — no new API endpoints needed.
- Report extraction file naming: `src/components/reports/trial-balance-report.tsx`, `src/components/reports/general-journal-report.tsx`, etc.

**Tests:**
- Unit test for `exportToExcel` utility: verify correct sheet count, column headers, and data mapping. **(Decision D13)**

---

### 5.7 GAP-07: Trust & Investments Monthly Report (US-029)

**Priority:** High (LPC audit requirement)
**Depends on:** GAP-06

**Problem:** The monthly Trust & Investments report required for annual LPC audit does not exist. The trust register API returns per-matter balances but does not support as-at date filtering or produce the required 3-sheet Excel format.

**Requirements:**

| Req ID | Requirement | Acceptance Criteria |
|--------|------------|-------------------|
| G07-R1 | Trust register API supports `asAt` date parameter | Only includes trust entries with `entryDate <= asAt` |
| G07-R2 | New report in Reports page: "Trust & Investments" | Filter: as-at date (defaults to last day of current month). Displays matter balances in table |
| G07-R3 | 3-sheet Excel export | Sheet 1 "Matters": Client, Matter, Matter Code, Owner, Trust Balance, Investment Balance. Sheet 2 "Trust Banks": account name, balance. Sheet 3 "Investment Banks": blank with headers (s86(4) removed) |
| G07-R4 | Discrepancy warning banner | If matter trust totals do not equal Trust Bank balance, show yellow warning banner: "Trust ledger total (R X) does not match bank balance (R Y). Difference: R Z." Report still generates. **(Decision D11)** |

**Technical Notes:**
- Trust Bank balance sourced from firm settings (trust bank account details) cross-referenced with latest reconciled bank statement closing balance.
- Investment Balance column shows R 0.00 for all matters (s86(4) removed per US-029).

**Tests:**
- Unit test for trust register `asAt` date filtering: verify entries after the date are excluded. **(Decision D13)**

---

### 5.8 GAP-08: Detailed Matter Ledger — Audit (US-030)

**Priority:** High (LPC audit requirement)
**Depends on:** GAP-06

**Problem:** No per-matter trust transaction audit report exists. Auditors need a detailed ledger showing every trust transaction per matter with opening/closing balances for any date range.

**Requirements:**

| Req ID | Requirement | Acceptance Criteria |
|--------|------------|-------------------|
| G08-R1 | API endpoint GET `/api/reports/matter-ledger` | Params: `from`, `to`, optional `matterId`. Returns per-matter data with opening balance, transactions, closing balance |
| G08-R2 | Opening balance calculated from entries before period | Sum of all trust entries for the matter with `entryDate < from` |
| G08-R3 | Transaction rows include sequential numbering | Each entry: seq #, date, type, reference, narration, amount, running balance |
| G08-R4 | Closing balance row per matter | Equals opening balance + net of in-period transactions |
| G08-R5 | New report in Reports page: "Matter Ledger (Audit)" | Date range filter, optional matter filter. Table grouped by matter with two blank rows between matters |
| G08-R6 | Signed single-column Amount in Excel export | Negative = money held in trust, positive = money paid out. Matches LawPractice ZA format. **(Decision D6)** |

**Sign Convention Detail:**
- `trust_receipt`, `trust_transfer_in`, `collection_receipt` → **negative** (money held)
- `trust_payment`, `trust_transfer_out` → **positive** (money out)
- Running balance: opening + sum of signed amounts. A negative running balance means the firm holds client funds.

**Tests:**
- Unit test for opening balance calculation: verify correct aggregation of pre-period entries. **(Decision D13)**
- Unit test for sign convention: verify inflow types produce negative values, outflow types produce positive values.

---

### 5.9 GAP-09: Financial Reports — P&L, Balance Sheet, GL Detail (US-028)

**Priority:** High
**Depends on:** GAP-06

**Problem:** Three financial reports listed in US-028 are not built: Income & Expense (P&L), Balance Sheet, and Statement of All Accounts (GL Detail). These are admin-only.

#### Income & Expense Report (P&L)

| Req ID | Requirement | Acceptance Criteria |
|--------|------------|-------------------|
| G09-R1 | API endpoint GET `/api/reports/income-expense` | Params: `from`, `to`. Aggregates journal lines by income (4xxx) and expense (5xxx) accounts |
| G09-R2 | Report displays income section, expense section, net income | Grouped by account with subtotals. Net income = total income - total expenses |
| G09-R3 | Admin-only access | Non-admin users cannot access |

#### Balance Sheet

| Req ID | Requirement | Acceptance Criteria |
|--------|------------|-------------------|
| G09-R4 | API endpoint GET `/api/reports/balance-sheet` | Param: `asAt` date. Groups accounts: Assets (1xxx), Liabilities (2xxx), Equity |
| G09-R5 | Retained earnings calculated dynamically | Cumulative net income (all income - expenses up to `asAt` date) shown as a virtual "Retained Earnings" equity line. No GL account or periodic posting required. **(Decision D7)** |
| G09-R6 | Assets = Liabilities + Equity validation | Both totals displayed. If they don't balance, show warning text |

#### GL Detail (Statement of All Accounts)

| Req ID | Requirement | Acceptance Criteria |
|--------|------------|-------------------|
| G09-R7 | API endpoint GET `/api/reports/gl-detail` | Params: `from`, `to`, optional `accountId`. Per-account journal entries with opening/running/closing balances |
| G09-R8 | Report grouped by GL account | Opening balance, individual journal entries, closing balance per account |

**All three reports:**
- Date range filterable
- Excel export via GAP-06 utility **(Decision D5)**
- Admin-only access
- Each extracted into its own component file **(Decision D4)**

---

## 6. Dependencies & Phasing

```
Phase 1 (parallel — no dependencies):
  GAP-04  Fee Levels & Posting Codes settings
  GAP-06  Excel export utility + report file extraction

Phase 2 (parallel):
  GAP-01  Practice Notes schema + UI
  GAP-03  Associated Matters UI

Phase 3 (requires GAP-01):
  GAP-02  Practice Overview page

Phase 4 (parallel — GAP-07/08/09 require GAP-06):
  GAP-05  Client Statement PDF
  GAP-07  Trust & Investments report
  GAP-08  Detailed Matter Ledger
  GAP-09  Financial Reports (x3)
```

---

## 7. Technical Considerations

### 7.1 Prisma Migration
GAP-01 requires a schema migration adding 6 fields and a new enum. The `BillingStatus` enum with `@default(not_yet_billed)` handles existing rows without data backfill. The `toDo` field stores JSON as a text column (not a Prisma `Json` type) for simplicity — parsing happens in the application layer.

### 7.2 Inline Editing Pattern
GAP-01 and GAP-02 introduce onBlur auto-save — a new pattern in this codebase. All existing editing uses modal/sheet forms. Implementation approach:
- Each editable field is a controlled React input/select/switch
- `onBlur` triggers a PATCH request with only the changed field
- A small checkmark icon appears inline for 2s on success **(Decision D1)**
- On error, a red toast appears via Sonner
- No debouncing needed (blur fires once per field interaction)

### 7.3 Report File Extraction
All 14 reports (9 existing + 5 new) will be extracted into individual files under `src/components/reports/`. The main `reports-view.tsx` becomes a shell (~200 lines) handling sidebar navigation and report selection. **(Decision D4)**

### 7.4 xlsx Library
Already installed (v0.18.5) and used for data import. Write capabilities (`XLSX.utils.json_to_sheet`, `XLSX.writeFile`) will be used for client-side export — no new dependency needed. **(Decision D5)**

### 7.5 GL Account Categorisation
Accounts follow a consistent code convention: 1xxx = assets, 2xxx = liabilities, 4xxx = income, 5xxx = expenses. The `accountType` enum on `GlAccount` provides explicit categorisation. The `equity` type exists in the enum but has no seeded accounts. Retained earnings are calculated dynamically for the Balance Sheet. **(Decision D7)**

### 7.6 Storage & Performance
- **To-Do JSON**: Stored as text in PostgreSQL. Typical size <1KB per matter. No indexing needed.
- **Practice Overview**: Single API fetch of all open matters (~200-500 rows). Estimated payload ~50-100KB. Client-side filtering is performant at this scale. **(Decision D3)**
- **Excel exports**: Generated in-browser. Largest expected export (GL Detail for a full year) estimated at ~5,000 rows, well within browser memory limits.
- **Statement PDFs**: Generated server-side via react-pdf. Warning at >200 entries. No hard limit. **(Decision D10)**

---

## 8. Testing Strategy

**(Decision D13: Test critical paths only)**

| Area | Test Type | What to Test |
|------|-----------|-------------|
| `src/lib/excel-export.ts` | Unit | Correct sheet count, column headers, data mapping, multi-sheet workbooks |
| `/api/reports/matter-ledger` | Integration | Opening balance calculation, sign convention (inflow=negative, outflow=positive), running balance accuracy |
| `/api/matters/[id]` PATCH | Integration | Practice notes fields accepted, billing status enum validation, to-do JSON parsing |
| `/api/trust-register` | Integration | `asAt` date filtering excludes future entries |
| `/api/reports/balance-sheet` | Unit | Retained earnings = cumulative income - expenses; A = L + E validation |

**Not tested (straightforward CRUD):** Fee levels CRUD, posting codes CRUD, associated matters CRUD, report UI rendering.

---

## 9. Acceptance Testing

| Phase | Verification |
|-------|-------------|
| Phase 1 | Navigate to /settings/fee-levels and /settings/posting-codes — full CRUD works. Deactivation hides from dropdowns. Run any report, click Export Excel — valid .xlsx downloads. Report files are extracted into individual components |
| Phase 2 | Open a matter, switch to Practice Notes tab. Edit each field, click away — inline "Saved" indicator appears, values persist on reload. To-do checklist: add items, check items (strikethrough appears), uncheck. Allocation dropdown shows active users. Associated tab: search and link a matter, verify it appears on both sides, remove it |
| Phase 3 | Navigate to /practice — all open matters visible. Inline-edit a field, verify persistence. Filter by allocation and text search. Sort by any column. Status icons render correctly (stacked where applicable). Admin sees all; fee earner sees own. Matter count updates with filters |
| Phase 4 | Download client statement PDF — correct firm branding, totals match HTML view. Large statement shows warning. Export Trust & Investments to 3-sheet Excel — verify sheet names and data. Discrepancy banner shows if totals differ. Run Matter Ledger — opening balances correct, sign convention matches (negative=held). Run P&L — net income matches trial balance. Run Balance Sheet — A=L+E. Run GL Detail — opening/closing balances per account |
| All | `npm run build` passes. `npm run test:run` passes. `npm run lint` passes |

---

## 10. Complexity Estimates

| GAP | Feature | Complexity | New Files | Modified Files |
|-----|---------|-----------|-----------|----------------|
| 01 | Practice Notes schema + UI | Medium | 0 | 3 (schema, API, matter-detail) |
| 02 | Practice Overview page | Large | 2 (page, component) | 1 (sidebar) |
| 03 | Associated Matters UI | Medium | 1 (API route) | 1 (matter-detail) |
| 04 | Fee Levels & Posting Codes settings | Small | 6 (4 API routes, 2 pages) | 0 |
| 05 | Client Statement PDF | Medium | 2 (pdf template, API) | 1 (client page) |
| 06 | Excel Export + report extraction | Medium | 15 (1 utility, 14 report files) | 1 (reports-view shell) |
| 07 | Trust & Investments report | Medium | 1 (report component) | 1 (trust-register API) |
| 08 | Detailed Matter Ledger | Medium | 2 (API route, report component) | 0 |
| 09 | Financial Reports (x3) | Large | 6 (3 API routes, 3 report components) | 0 |

---

*Document generated: 28 March 2026*
*Revised: 28 March 2026 (v2.0 — post stakeholder interview)*
*System: Dolata & Co. Attorneys — dcco-billing*
