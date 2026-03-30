# DCCO Billing System — User Stories & Build Instructions

**Dolata & Co. Attorneys | dcco-billing**
Compiled from full build session — March 2026

---

## Project Overview

A custom-built web-based legal billing and practice management system to replace LawPractice ZA (Nitric Software Laboratory). Built using Next.js 16, TypeScript, PostgreSQL, and Prisma ORM.

**Tech Stack:** Next.js 16 (App Router) · TypeScript · shadcn/ui · Tailwind CSS · PostgreSQL · Prisma ORM · NextAuth.js v5 · react-pdf/renderer · Papa Parse · Nodemailer · Recharts

**Hosting:** Self-hosted Docker (data sovereignty for POPIA/FICA compliance)

---

## Phase 1 — Scaffold, Auth & Firm Settings

### US-001: Application Scaffold

**As a** developer,
**I want** a Next.js 14 application scaffolded with the approved design system, authentication, and database connection,
**So that** all subsequent phases can build on a consistent foundation.

**Acceptance Criteria:**

- Next.js App Router with TypeScript
- shadcn/ui + Tailwind CSS configured
- PostgreSQL + Prisma ORM connected
- NextAuth.js v5 with credentials and role-based access
- Design system applied: Playfair Display + Noto Sans fonts
- Colour palette: `#F6F3EE` background, `#2C2C2A` text, `#B08B82` rose-taupe, `#8897C0` periwinkle-slate, `#2C2C2A` sidebar
- 240px collapsible charcoal sidebar
- Fixed "RECORD TIME" FAB bottom-right
- `Cmd+K` global search

---

### US-002: User Management & Authentication

**As an** admin,
**I want** to manage firm users with role-based access,
**So that** fee earners can only see their own data while admins see everything.

**Acceptance Criteria:**

- Users table with roles: `admin`, `fee_earner`
- Login with email and password
- Admin can create, edit, deactivate users
- Monthly target (ZAR) configurable per user
- Role-based page and data access throughout

---

### US-003: Firm Settings

**As an** admin,
**I want** to configure firm details, bank accounts, VAT settings, and SMTP email,
**So that** invoices and documents reflect correct firm information.

**Acceptance Criteria:**

- Firm name, trading name, address, phone, email, website
- Firm logo upload (PNG/JPEG, max 2MB) — displays in sidebar
- VAT registration number and rate (default 15%)
- Trust bank account details (FNB)
- Business bank account details
- SMTP email configuration (host, port, username, password, from-name, from-email)
- Fee levels configuration
- Posting codes configuration

---

## Phase 2 — Clients, Matters & Matter Codes

### US-004: Client Management

**As a** fee earner,
**I want** to create and manage client records,
**So that** all matters are linked to the correct client with FICA compliance tracking.

**Acceptance Criteria:**

- Client code (auto-generated prefix)
- Client name, trading name, entity type
- Contact details: email, accounts email, phone, address
- ID number, tax number, registration number
- FICA status: Not Compliant / Partially Compliant / Compliant
- FICA documents tab: upload, download, delete (admin only)
- Client statement tab with date range filter
- Active matters count displayed
- Search by name or code

---

### US-005: Matter Management

**As a** fee earner,
**I want** to create matters linked to clients with auto-generated matter codes,
**So that** all work is tracked against the correct matter with a unique reference.

**Acceptance Criteria:**

- Matter code format: `PREFIX/CLIENT-NNN` (e.g. `JJ/APS-001`)
- Matter code sequences use atomic `SELECT FOR UPDATE` to avoid conflicts
- Matter description, type, department, owner
- Status: Open / Closed
- Open and close dates
- Multiple fee earners can access a matter
- Associated matters linkage
- Matter attachments and notes tabs
- Business & Trust accounting tab
- FICA status inherited from client

---

### US-006: Practice Notes on Matter

**As a** fee earner,
**I want** to record status notes, to-do items, allocation, and billing status on each matter,
**So that** the team always knows the current state of every matter.

**Acceptance Criteria:**

- `matter_status_note`: inline editable text
- `to_do`: numbered list with checkboxes (check = strikethrough, muted)
- `allocation`: dropdown (Jess, Laken, Laken-Ash, Chris, or free type)
- `comment`: inline editable (court dates, notes)
- `billing_status`: Paid / Awaiting payment / Not yet billed
- `loe_fica_done`: toggle boolean
- All fields save immediately on click-away (no save button)

---

### US-007: Practice Overview Page

**As a** fee earner,
**I want** a firm-wide table of all open matters with their practice notes,
**So that** I have a single view of what needs attention across all matters.

**Acceptance Criteria:**

- Page at `/practice` in sidebar under Practice section
- Table columns: Client, Matter, Status Note, To-Do count, Allocation, Comment, Billing Status, LOE/FICA
- All columns inline editable
- Filter by: allocated to, matter type, status text search
- Sort by any column
- Row colour coding: green tint (paid + no todos), amber (overdue diary), red left border (FICA incomplete)
- Admin sees all matters; fee earners see only their allocated matters
- Matter count displayed at top

---

### US-008: Global Search

**As a** user,
**I want** to search matters and clients from anywhere in the app,
**So that** I can quickly navigate to any matter without browsing.

**Acceptance Criteria:**

- Search input visible in the dark header bar on every page
- Search by: client name, matter code, matter description
- Results appear as dropdown after 2 characters (debounced 300ms)
- Each result: matter code · description · client name
- Click → navigate to matter page
- Keyboard navigation: arrows, Enter, Escape
- Max 8 results
- API: `GET /api/search?q=term&type=matters`

---

## Phase 3 — Time Recording & Fee Capture

### US-009: Fee Entry Capture

**As a** fee earner,
**I want** to record time and fee entries against matters,
**So that** all billable work is captured accurately before invoicing.

**Acceptance Criteria:**

- Entry types: Time / Unitary / Disbursement
- Fee earner, fee level, activity/posting code
- Date, start time, end time with auto-calculate minutes
- Minutes field accepts: `90`, `1h30`, `1.5h`, `1:30`
- 6-minute billing blocks applied automatically
- Rate auto-populated from fee earner's fee level
- Discount percentage
- Billable toggle
- Add to notes checkbox
- Entries locked once invoiced

---

### US-010: Record Time Global Access

**As a** fee earner,
**I want** to record time from anywhere in the app,
**So that** I never lose time entries while working.

**Acceptance Criteria:**

- Fixed "RECORD TIME" FAB bottom-right on all pages
- Keyboard shortcut `T` opens the time recording slide-over
- Slide-over includes matter typeahead search
- Time entry form fully functional in slide-over

---

### US-011: Matter Transactions List

**As a** fee earner,
**I want** to see all unbilled fees and disbursements on a matter,
**So that** I know exactly what work is ready to invoice.

**Acceptance Criteria:**

- Tabs: All Unbilled / Fees / Disbursements
- Summary bar: Fees total, Disbursements total, Grand Total
- Columns: Date, Fee Earner, Description, Duration, Amount, Actions
- Sorted by `entry_date` descending (most recent first)
- Inline edit and delete (with confirmation)
- Bulk select with checkboxes
- Bulk actions: Invoice Selected, Make Billable/Unbillable, Delete, Move
- "Invoice (n)" button appears when entries selected

---

### US-012: Timesheet View

**As a** fee earner,
**I want** to see my time entries grouped by day,
**So that** I can review and manage my recorded time.

**Acceptance Criteria:**

- Page at `/timesheet` in sidebar
- Week and month view navigator
- Daily grouped entries with day totals
- Shows all my entries across all matters
- Click entry to edit

---

## Phase 4 — Invoicing & PDF Generation

### US-013: Create Invoice

**As a** fee earner,
**I want** to create pro forma and tax invoices from selected fee entries,
**So that** clients receive accurate invoices with proper VAT treatment.

**Acceptance Criteria:**

- Select fee entries from matter → click "Invoice (n)"
- Choose invoice type: Tax Invoice / Pro Forma
- Invoice date selection
- Invoice number auto-generated (`INV-XXXX`)
- Line items immutable after sending
- Snapshot fields on invoice: VAT rate, VAT reg number, trust bank details, matter code, client name, firm details
- Invoice states: Draft → Sent → Paid

---

### US-014: Invoice PDF Generation

**As a** fee earner,
**I want** invoices to generate as professional PDFs,
**So that** clients receive properly formatted documents.

**Acceptance Criteria:**

- Firm logo and address top right
- "TAX INVOICE" or "PRO FORMA INVOICE" heading
- Invoice To + matter code reference
- Matter description as bold heading
- Line items table: Date / Description / QTY / Rate / Amount
- VAT line and Total
- Payment instructions: Trust Account bank details, matter code as reference
- Download PDF button on invoice page

---

### US-015: Send Invoice by Email

**As a** fee earner,
**I want** to send invoices directly from the system,
**So that** clients receive invoices without me switching to email.

**Acceptance Criteria:**

- "Send Invoice" button on invoice detail page
- Uses SMTP settings from firm settings
- Sends to client's invoice email address
- PDF attached to email
- Invoice status updated to "Sent"
- Sent timestamp recorded

---

## Phase 5 — General Ledger & Trust/Business Accounting

### US-016: Chart of Accounts

**As an** admin,
**I want** a double-entry general ledger with trust and business account separation,
**So that** the firm complies with LPA s86 trust accounting requirements.

**Acceptance Criteria:**

- System GL accounts seeded:
  - Trust Bank (1001)
  - Business Current (1002)
  - Debtors Control (1010)
  - Trust Creditors (2001)
  - Payables Control (2010)
  - Professional Fees Income (4001)
  - Trust-to-Business Transfer (4002)
  - Disbursements Expense (5001)
- All monetary values stored as integers (cents)
- Double-entry balance enforced by DB trigger
- Trust/business separation enforced by DB trigger

---

### US-017: Trust Transactions

**As an** admin,
**I want** to record all trust receipts, payments, and transfers,
**So that** client funds are tracked accurately in compliance with LPA s86.

**Acceptance Criteria:**

- Trust receipt: money received into trust for a matter
- Trust payment: disbursement paid from trust
- Inter-matter trust transfer: move funds between matters
- Trust-to-business transfer: transfer earned fees to business account (admin only, requires linked trust entry)
- GL journal auto-posted via DB trigger on trust entries
- Per-matter trust balance always visible

---

### US-018: Business Transactions

**As an** admin,
**I want** to record business account income and expenses,
**So that** the firm's operating accounts are tracked in the system.

**Acceptance Criteria:**

- Business receipt, business payment
- Supplier invoice, supplier payment
- Trust-to-business transfer (receiving side)
- GL journal auto-posted via DB trigger
- Trial balance available

---

### US-019: Trust Register

**As an** admin,
**I want** a trust register showing all matter balances,
**So that** monthly LPC reconciliation reports can be produced.

**Acceptance Criteria:**

- List of all matters with trust balances
- Firm total trust balance
- Trust register report: per-matter balances as at selected date
- Trust Banks sheet: actual bank balance
- Must balance: matter totals = bank balance

---

## Phase 6 — Bank Reconciliation

### US-020: FNB CSV Bank Statement Import

**As an** admin,
**I want** to upload FNB bank statements and match transactions,
**So that** I can reconcile the bank account against my GL entries.

**Acceptance Criteria:**

- FNB CSV format supported (exact column structure):
  - First row: account metadata (Account Number, Account Description etc)
  - Blank row
  - Header row: Date, Description, Amount, Balance
  - Transaction rows: `DD Mon YYYY` format dates, signed amounts
- Upload for Trust or Business account type
- Statement list shows: filename, date range, match progress, closing balance
- Reconcile button opens side-by-side view

---

### US-021: Side-by-Side Reconciliation

**As an** admin,
**I want** to match bank statement lines against GL entries,
**So that** I can confirm all transactions are accounted for.

**Acceptance Criteria:**

- Left panel: bank statement lines (Date, Description, Amount)
- Right panel: GL/accounting entries (Date, Description, Type, Amount)
- Auto-match: exact amount +/-3-day date tolerance
- Manual match: select one from each panel and click match
- Green highlight for matched lines
- Unmatch to reverse
- Reconciliation report: SA Section 78(2) format
- Progress indicator: X/Y matched (%)

---

## Phase 7 — Collections, Debtors & FICA

### US-022: Debtors Age Analysis

**As an** admin,
**I want** to see outstanding invoices aged by days overdue,
**So that** I can prioritise collections follow-up.

**Acceptance Criteria:**

- Table grouped by client
- Age buckets: 0-30 / 31-60 / 61-90 / 90+ days
- Colour coded: green → amber → orange → red
- Expandable rows showing individual invoices
- Grand total row
- Page at `/debtors` in sidebar under Billing

---

### US-023: Client Statements

**As a** fee earner,
**I want** to generate client statements showing invoices and payments,
**So that** clients can see their full billing history and outstanding balance.

**Acceptance Criteria:**

- Statement tab on client detail page
- Date range filter (load on demand)
- Columns: Date, Type, Reference, Debit, Credit, Running Balance
- Totals footer
- Export to PDF

---

### US-024: FICA Compliance Management

**As an** admin,
**I want** to track and manage FICA compliance for all clients,
**So that** the firm meets its obligations under FICA 38 of 2001.

**Acceptance Criteria:**

- FICA page at `/fica` showing all clients with compliance status
- Filter tabs: All / Not Compliant / Partially Compliant / Compliant
- Status badges: Not Compliant (red) / Partially Compliant (amber) / Compliant (green)
- Manage link → client's FICA documents tab
- Upload documents on behalf of client
- 5-year document retention (soft delete only)
- Stat cards showing counts per status at top of page

---

### US-025: Collections

**As a** fee earner,
**I want** to see outstanding invoices with collection status,
**So that** I know which clients need to be followed up for payment.

**Acceptance Criteria:**

- Page at `/collections` under Billing in sidebar
- Age analysis table with expandable client rows
- Individual invoice rows with age badges
- Status and to-do notes per invoice

---

## Phase 8 — Dashboard, Reports & Diary

### US-026: Dashboard

**As a** fee earner,
**I want** a personalised dashboard showing my tasks, fees, and unbilled work,
**So that** I can start each day knowing exactly what needs attention.

**Acceptance Criteria:**

- Two-column CSS Grid layout (`1fr` left, `380px` right)
- Dark frosted header bar: greeting (time-aware), date, task/unbilled summary, Record Time button
- **Left column:** Fee chart, My WIP, My Unsent Invoices, Firm KPIs (admin only), All Earners chart (admin only)
- **Right column:** Full interactive calendar, Today's Tasks, This Week
- Calendar: proper 7-column grid, Mo-Su headers, today highlighted in rose-taupe, diary entry dots
- Click calendar day → show diary entries below calendar
- Widget drag-to-reorder and show/hide customisation
- Staggered fadeUp load animations
- Hover lift effect on all cards
- Admin-only widgets hidden from fee earners

---

### US-027: Fee Earner Chart

**As a** fee earner,
**I want** to see my fees this month vs last month vs target on a chart,
**So that** I can track my billing performance.

**Acceptance Criteria:**

- Area/line chart: current month (rose-taupe), previous month (stone), target (dotted)
- X-axis: days 1-31, Y-axis: ZAR abbreviated (R50k, R100k)
- Today marker as vertical line
- Admin toggle: My Fees / All Earners
- Monthly target set per user in Settings → Users
- Target line only shown if target is set

---

### US-028: Reports

**As an** admin,
**I want** comprehensive reports covering billing, trust, GL, and audit requirements,
**So that** I can manage the firm's finances and meet LPC compliance obligations.

**Acceptance Criteria:**

- Reports page at `/reports` with sidebar-nav + panel layout
- **Billing Reports:** Trial Balance, General Journal, Trust Register, Debtors Age Analysis, Invoice Register, WIP (Work in Progress), Fee Earner Performance (admin only), Time Recording Summary, Bank Reconciliation
- **Financial Reports:** Income & Expense Report (P&L), Balance Sheet, Statement of All Accounts (GL Detail)
- **Audit Reports:** Detailed Matter Ledger (Trust), Trust and Investments Report (monthly, LPC format)
- All reports filterable by date range
- Export to Excel and/or PDF
- Financial and Audit reports are admin only

---

### US-029: Trust & Investments Monthly Report

**As an** admin,
**I want** to generate the monthly Trust and Investments report,
**So that** I can provide the required documentation for the annual LPC audit.

**Acceptance Criteria:**

- Three-sheet Excel export matching LawPractice ZA format exactly:
  - **Sheet 1 — Matters:** Client, Matter, Matter Code, Owner, Trust Balance, Investment Balance
  - **Sheet 2 — Trust Banks:** account name and balance
  - **Sheet 3 — Investment Banks:** blank (s86(4) removed)
- Matter totals must equal Trust Bank balance
- Filter: select as-at date (defaults to last day of current month)
- Generated monthly, kept on file for auditor

---

### US-030: Detailed Matter Ledger (Audit)

**As an** admin,
**I want** to generate a detailed matter ledger for any date range,
**So that** the auditor can verify every trust transaction per matter.

**Acceptance Criteria:**

- One section per matter with activity in the period
- Opening balance row per matter
- Transaction rows: seq, Date, Type (Trust Receipt/Transfer/Payment), Reference, Description, Amount, Running Balance
- Closing balance row
- Two blank rows between matters
- Amounts: negative = money held, positive = money out
- Export to Excel matching LawPractice ZA format

---

### US-031: Diary & Calendar

**As a** fee earner,
**I want** a diary to track tasks and appointments linked to matters,
**So that** nothing falls through the cracks.

**Acceptance Criteria:**

- Page at `/diary` with monthly calendar view (Monday start)
- List view toggle
- Day panel: click day to see/add entries
- Entry fields: matter typeahead, title, notes, assignee (admin), due date
- Complete/incomplete toggle per entry
- Completed: strikethrough, muted
- Admin scope toggle: Mine / All
- Diary entries appear on dashboard calendar with dots

---

## Design System

### US-032: Visual Design System

**As a** user,
**I want** the application to have a consistent, professional visual design,
**So that** the system reflects the Dolata & Co. brand.

#### Brand Colours

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#F1EDEA` | Warm taupe (all pages) |
| Dark charcoal | `#4A4845` | Sidebar, dark header bars |
| Primary accent | `#B08B82` | Rose-taupe — buttons, highlights |
| Trust accent | `#8897C0` | Periwinkle-slate — trust elements only |
| Body text | `#2C2C2A` | — |
| Muted text | `#80796F` | — |
| Border/stone | `#D8D3CB` | — |

#### Typography

- **Headings:** Playfair Display
- **Body:** Noto Sans
- **No DM Mono** — removed from entire platform
- **Amounts:** Noto Sans, color `#B08B82`

#### Glass Card Style

```css
background: rgba(255, 252, 250, 0.62);
backdrop-filter: blur(24px);
border: 1px solid rgba(255, 255, 255, 0.80);
border-radius: 20px;
/* Hover: translateY(-3px) with deeper shadow */
```

#### Page Headers

- Dark frosted bar: `rgba(74, 72, 69, 0.92)`
- Title in Playfair Display 24px `#F1EDEA`
- Action buttons in rose-taupe pill style

#### Tables

- Header: Noto Sans 9px uppercase spaced, `#80796F`
- Rows: 12px 16px padding, hover rose tint
- Full width with defined column widths
- Sortable columns with up/down indicators
- Resizable columns (drag handle, saved to localStorage)

#### Animations

- Staggered fadeUp on page load (80ms increments)
- Hover lift on cards (0.25s ease)
- Wrapped in `prefers-reduced-motion` check

#### FICA Status Badges

| Status | Background | Text |
|--------|-----------|------|
| Not Compliant | `#9A3A3A` | white |
| Partially Compliant | `#A07030` | white |
| Compliant | `#4A7C59` | white |

All: `border-radius: 20px`, `padding: 4px 12px`, Noto Sans 11px

---

## Fee Schedules

### US-033: Trade Mark Fee Schedule

**As a** fee earner,
**I want** to access the firm's trade mark tariff in the system,
**So that** fees auto-populate when recording trade mark time entries.

**Acceptance Criteria:**

- Page at `/fee-schedules` under Billing in sidebar (Tag icon)
- Left panel: list of fee schedule categories (Trade Marks — South Africa initially)
- Right panel: items grouped by section (Searches, Applications, Prosecution, Registration, Assignment, Registered Users)
- Columns: Description, Official Fee, Professional Fee (ex VAT), VAT, Total
- Admin: inline edit on double-click, delete
- When recording a time entry on a Trade Mark matter: "Select from fee schedule" button
- Selecting an item auto-fills: narration, rate (professional fee), entry type (Unitary), and creates disbursement entry for official fee if applicable
- South Africa tariff seeded with all standard items at correct ZAR amounts

---

## Data Import

### US-034: Import Data from LawPractice ZA

**As an** admin,
**I want** to import historical data from LawPractice ZA,
**So that** all client, matter, and billing history is available in the new system.

**Acceptance Criteria:**

- Import Data tab in Settings (admin only)
- Single dropdown to select import type:
  - Clients (from LawPractice ZA)
  - Matters (from LawPractice ZA)
  - Invoice History (from LawPractice ZA)
  - Unbilled Fees & Disbursements (from LawPractice ZA)
- File upload + Import button per type
- Results panel: imported count, skipped count, errors list
- Duplicates skipped (no overwriting)
- Historical invoices: marked `is_historical = true`, no GL journal entries generated
- Historical fee entries: marked `is_historical = true`
- Fee earner matching: fuzzy partial name match against DB users
- Matter code matching: strip spaces before lookup

**Import file formats supported:**

| Type | Source | Volume |
|------|--------|--------|
| Clients | LawPractice ZA customer list Excel export | 359 rows |
| Matters | LawPractice ZA matter list Excel export | 549 rows |
| Invoices | "Invoiced Fees and Disbursements" Excel | 2,994 line items → 364 invoices |
| Unbilled | "Unbilled Fees and Disbursements" Excel | 347 rows |

---

## SA Legal Compliance

### US-035: LPA & Regulatory Compliance

**As an** admitted attorney,
**I want** the system to enforce South African legal practice compliance,
**So that** the firm meets all LPA, FICA, VAT, and POPIA obligations.

**Regulatory Requirements:**

| Requirement | Source |
|-------------|--------|
| Trust account segregation | LPA 28 of 2014, s86 |
| Monthly trust reconciliation | LPA + LPC Rules |
| FICA client identification + 5yr retention | FICA 38 of 2001 |
| Tax invoices: VAT No, excl/incl VAT | VAT Act 89 of 1991, s20 |
| VAT rate 15% (configurable) | VAT Act 89 of 1991 |
| POPIA compliance | POPIA Act 4 of 2013 |
| Currency ZAR | — |
| Matter code as payment reference | Standard SA practice |
| Section 86(4) removed (not applicable) | LPA 28 of 2014 |

---

## Pinned Items (Future Phases)

The following were identified during the build session and pinned for future development:

| ID | Description |
|----|-------------|
| PIN-001 | New Client Leads / CRM (Excel Sheet 2 — lead tracking with source, follow-up status) |
| PIN-002 | Trade Mark Actions tracker (checklist per matter: POA, TM2, CIPC submission, Official Actions with deadlines) |
| PIN-003 | Payments to be Made (disbursements owed to advocates, sheriffs, correspondents) |
| PIN-004 | Fee Recording — adding fees directly in the system (not just via import) |
| PIN-005 | Standard Fees schedule (non-trade mark fixed fees) |
| PIN-006 | Set Fees schedule (agreed fixed fees per matter type) |
| PIN-007 | Financial Reports — Income & Expense, Balance Sheet, Statement of All Accounts (GL Detail) |
| PIN-008 | Trust transfer prompts — when sending an invoice, alert if matter has trust funds available to cover it |
| PIN-009 | Sidebar colour toggle (dark charcoal vs warm neutral stone) saved per user |
| PIN-010 | Dark mode for entire platform |
| PIN-011 | JAIDE platform (separate product — trade mark search, filing, and advisory) |

---

## Build Phases Summary

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Scaffold, auth, design system, firm settings, user management | Complete |
| Phase 2 | Clients, matters, matter codes, global search | Complete |
| Phase 3 | Time recording, fee capture, 6-min billing, timesheet | Complete |
| Phase 4 | Invoicing, PDF generation, email sending | Complete |
| Phase 5 | Full GL, trust/business transactions, DB triggers | Complete |
| Phase 6 | Bank reconciliation, FNB CSV import, side-by-side matching | Complete |
| Phase 7 | Collections, FICA documents, client statements, debtors | Complete |
| Phase 8 | Dashboard KPIs, fee chart, 9 reports, diary/calendar | Complete |
| Design | Platform-wide visual redesign (glassmorphism, brand colours) | Complete |
| Data Migration | Import clients, matters, invoices, unbilled fees from LawPractice ZA | Complete |
| Fee Schedules | Trade mark tariff importer and fee auto-populate | Complete |
| Practice Overview | Matter status, to-do, allocation firm-wide view | Complete |

---

*Document generated: 26 March 2026*
*System: Dolata & Co. Attorneys — dcco-billing*
*Built with Claude Code (Anthropic)*
