# Gap Analysis: Jessica V2 Requirements vs Current Implementation

**Date:** 31 March 2026
**Source:** 26.03.30 Billing Software Page by Page (Jessica's first draft)
**Compared against:** dcco-billing current codebase (main branch, commit 50466aa)

---

## Legend

| Status | Meaning |
|--------|---------|
| BUILT | Feature exists and matches requirements |
| PARTIAL | Feature exists but is missing key functionality |
| NOT BUILT | Feature does not exist yet |

---

## 1. Dashboard

| Requirement | Status | Notes |
|-------------|--------|-------|
| Search by matter, client, ref nr, name | BUILT | Global search + command palette (Cmd+K) exist |
| Fee graph (past month, current month, target) | PARTIAL | Fee chart exists but no target line overlay |
| Toggle graph view (6mo, 1yr, 2yr, 3yr, 5yr) | NOT BUILT | Currently only shows current period |
| Work In Progress widget | BUILT | UnbilledWork widget exists |
| WIP dedicated page | NOT BUILT | Only a dashboard widget, no standalone page |
| Unbilled time categorized by matters | PARTIAL | Widget shows totals, not categorized breakdown |
| Unsent invoices | BUILT | UnssentInvoices widget exists |
| Firm overview (outstanding debtors, unsent invoices) | BUILT | FirmKpis widget shows these |
| Deadlines this week | PARTIAL | Diary widget exists but not filtered to "this week" deadlines specifically |
| Side panel calendar | BUILT | Calendar widget in dashboard |
| Today's diary | BUILT | Diary widget shows today's entries |
| "Coming Up" chronological upcoming events | NOT BUILT | No dedicated upcoming events view beyond today |
| Top bar ADD quick action (new client + consultation email flow) | NOT BUILT | No quick-add client with email trigger |
| New Client Leads storage | NOT BUILT | No leads/prospects module |
| AI Chatbot for querying data | NOT BUILT | No chatbot integration |

---

## 2. Matters

| Requirement | Status | Notes |
|-------------|--------|-------|
| List of all matters with columns | BUILT | Matters list page exists |
| Client Surname, FN column | BUILT | Client name shown |
| Matter Subject column | BUILT | Matter description shown |
| Summary column | NOT BUILT | No summary/synopsis field on matters |
| To Do + Allocation column | NOT BUILT | No task allocation column on matters list; diary entries exist separately |
| Task allocation to specific people with calendar due dates | PARTIAL | DiaryEntry has assignee and dueDate, but no allocation from matters list view |
| Status column | BUILT | Matter status exists |
| Comment/Deadline column | NOT BUILT | No inline comment or deadline column on list |
| Sortable columns | PARTIAL | Basic sorting may exist, needs verification for all columns |
| Inside matter: see what's done and to-do | PARTIAL | Notes and diary exist in matter detail, but no structured done/to-do view |
| Email linking via reference number | NOT BUILT | No email integration |

---

## 3. Clients

| Requirement | Status | Notes |
|-------------|--------|-------|
| Client list (surname, first name) | BUILT | Client list page exists |
| Client Code column | BUILT | Client code exists in schema and list |
| Client email column | BUILT | Email shown |
| Client phone column | BUILT | Phone shown |
| FICA Status column | BUILT | FICA badge on client list |
| Links to matters | BUILT | Client detail shows associated matters |
| Toggle surname/first name ordering | NOT BUILT | No toggle for name display order |
| Click client for expanded info | BUILT | Client detail page exists |
| List of all their matters (in detail) | BUILT | Matters listed in client detail |
| Link to statements/billing | PARTIAL | Statement API exists but may not be linked in client detail UI |
| Amounts outstanding | NOT BUILT | No outstanding amount shown on client detail |
| New Client Leads section | NOT BUILT | No leads/prospects database |

---

## 4. Diary

| Requirement | Status | Notes |
|-------------|--------|-------|
| Calendar view | PARTIAL | Diary page exists but is task-list based, not a visual calendar |
| Apple Calendar-like UI | NOT BUILT | Current UI is a table/list, not a calendar grid |
| Email integration | NOT BUILT | No email calendar sync |
| Deadline notifications | NOT BUILT | No push/browser notifications |
| Integration with matters | BUILT | DiaryEntry links to matters |
| Coming Up view (chronological all events) | NOT BUILT | No chronological upcoming events view |

---

## 5. Practice Overview

| Requirement | Status | Notes |
|-------------|--------|-------|
| Combined matters + clients + billing view | PARTIAL | Practice overview page exists but limited |
| Client Surname, FN | BUILT | Shown |
| Matter Subject | BUILT | Shown |
| Summary | NOT BUILT | No summary field |
| To Do + Allocation | NOT BUILT | Not shown in practice overview |
| Status | BUILT | Shown |
| Comment/Deadline | NOT BUILT | Not shown |
| Last Bill Sent | NOT BUILT | Not shown |
| Monies owed | NOT BUILT | Not shown |
| FICA/LOE status | NOT BUILT | Not shown in practice overview |
| Red highlighting for clients who owe money | NOT BUILT | No conditional styling |

---

## 6. Billing - My Timesheet

| Requirement | Status | Notes |
|-------------|--------|-------|
| Quick fee input | BUILT | TimesheetView with FeeEntryForm |
| See what has been timed | BUILT | Timesheet list shows entries |
| Overview: month/last month/target with graph | NOT BUILT | No stats/graph header on timesheet page |
| Display matters with fees for day/month/week for quick selection | NOT BUILT | No matter quick-select based on recent activity |
| Toggle between week and month view | NOT BUILT | No weekly/monthly toggle view |
| Side panel diary for the day | NOT BUILT | No diary panel in timesheet |

---

## 7. Unbilled Fees (Changed from Invoicing)

| Requirement | Status | Notes |
|-------------|--------|-------|
| Dedicated unbilled fees page | NOT BUILT | Unbilled fees only shown in invoice creation flow and dashboard widget |
| List all unbilled fees and disbursements | PARTIAL | Data exists via API, no dedicated browse page |
| Click to edit unbilled entries | PARTIAL | Fee entries are editable but not from a dedicated unbilled fees page |
| Pro forma invoice creation | PARTIAL | Invoice has proForma status but workflow from unbilled fees page doesn't exist |

---

## 8. Debtors

| Requirement | Status | Notes |
|-------------|--------|-------|
| List of clients owing money | BUILT | Collections/Debtors page exists |
| Categorized invoices | BUILT | Aging buckets (0-30, 31-60, 61-90, 90+) exist |

---

## 9. Fee Schedules

| Requirement | Status | Notes |
|-------------|--------|-------|
| Fee schedule management | BUILT | Fee schedules page with categories and items |
| Categorized: General Fees (hourly, fixed, disbursement) | PARTIAL | Categories exist but not pre-structured as specified |
| Categorized: Trade Marks by country (SA, AU, UK, US) | NOT BUILT | No country-specific trademark fee schedules |
| Ability to add more categories | BUILT | Can create new fee schedule categories |
| Link fee schedules to timesheet input | NOT BUILT | No auto-population of fees from schedules when recording time |
| Link fee schedules to matter fee entry | NOT BUILT | No linking between schedules and matter-level entries |

---

## 10. Trust Account

| Requirement | Status | Notes |
|-------------|--------|-------|
| Place to input trust entries | BUILT | Trust entry CRUD exists |
| See which clients have trust funds | PARTIAL | Trust entries exist per client but no summary view of balances by client |
| Trust transactions list | BUILT | TrustLedger component exists |
| Insert trust bank statements | BUILT | Bank statement import exists |

---

## 11. Business Account

| Requirement | Status | Notes |
|-------------|--------|-------|
| Place to put business transactions | BUILT | Business entry CRUD exists |
| See how much is in business | PARTIAL | Entries exist but no running balance display |
| Add received invoices (payables) | NOT BUILT | No accounts payable / received invoice tracking |
| Payment reminders in diary | NOT BUILT | No auto-diary entries for payables |

---

## 12. Bank Reconciliation

| Requirement | Status | Notes |
|-------------|--------|-------|
| Bank reconciliation | BUILT | Full reconciliation with auto-matching exists |

---

## 13. Collections

| Requirement | Status | Notes |
|-------------|--------|-------|
| Debtors aging | BUILT | Collections page with aging buckets |
| Action tracking (invoice sent, followed up, demand letter, summons) | NOT BUILT | No collection action/workflow tracking |
| Interest calculation on outstanding accounts | NOT BUILT | No interest calculation engine |

---

## 14. Compliance - Letters of Engagement

| Requirement | Status | Notes |
|-------------|--------|-------|
| Send LOEs to clients | NOT BUILT | Entire LOE module missing |
| Adobe Sign / e-signature integration | NOT BUILT | No e-signature integration |
| List clients with LOE signed/unsigned status | NOT BUILT | No LOE tracking |
| Access fee schedules per LOE | NOT BUILT | No LOE-to-fee-schedule linking |

---

## 15. FICA

| Requirement | Status | Notes |
|-------------|--------|-------|
| FICA compliance tracking | BUILT | FICA page with status tracking |
| Document upload | BUILT | FICA document upload exists |
| Client-facing upload portal (public link) | NOT BUILT | No public-facing FICA upload link for clients |
| Entity type selection with dynamic document requests | NOT BUILT | No dynamic document requirements by entity type |

---

## 16. Reports

| Requirement | Status | Notes |
|-------------|--------|-------|
| Quick access for audit/tax season | PARTIAL | 12+ reports exist but not organized for audit/tax workflows |

---

## 17. Permission System (from Permission-Requirements.md)

| Requirement | Status | Notes |
|-------------|--------|-------|
| Zone-based permission system (16 zones) | NOT BUILT | Still using 3-role enum (admin, fee_earner, assistant) |
| Per-zone access control on API routes | NOT BUILT | Current guards use role checks |
| User zone assignment UI | NOT BUILT | No zone management in settings |

---

## Summary: What Needs to Be Built

### High Priority (Core Workflow Gaps)
1. **Letters of Engagement module** - entirely missing
2. **Unbilled Fees dedicated page** - critical billing workflow
3. **Timesheet enhancements** - stats, graph, week/month toggle, matter quick-select
4. **Collections action tracking** - workflow stages and interest calculation
5. **Client-facing FICA portal** - public upload link
6. **Zone-based permission system** - documented but not implemented
7. **New Client Leads module** - enquiry tracking with email flow

### Medium Priority (UX & Feature Enhancements)
8. **Dashboard fee graph toggle** - multi-period views
9. **Dashboard "Coming Up" view** - chronological upcoming events
10. **Apple Calendar-style diary** - visual calendar with notifications
11. **Practice Overview enhancements** - additional columns, red highlighting
12. **Matter task allocation** - to-do with assignment and calendar integration
13. **Matters summary & comment/deadline columns** - on list view
14. **Client detail: amounts outstanding** - show debtor balance
15. **Business account payables** - received invoices with diary reminders
16. **Trust balance by client summary** - who has trust funds

### Lower Priority (Nice-to-Have)
17. **AI chatbot** for data queries
18. **Email integration** - link emails to matters by reference number
19. **Email calendar sync** for diary
20. **Fee schedule linking** to timesheet and matter entries
21. **Trademark fee schedules** by country
22. **Name display toggle** (surname/first name ordering)
23. **Audit/tax report workflow** - organized report bundles
