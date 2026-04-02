# User Stories: dcco-billing V2

**Date:** 31 March 2026
**Source:** Gap Analysis from Jessica's Page-by-Page Requirements
**Format:** As a [role], I want [feature], so that [benefit].

---

## Epic 1: Letters of Engagement (LOE) Module

### US-1.1: Create and Send Letters of Engagement
**As a** fee earner,
**I want to** create a Letter of Engagement for a client and send it for signing,
**so that** the client formally engages our firm before work commences.

**Acceptance Criteria:**
- Can create an LOE from a template linked to a specific client and matter
- Can include fee schedule terms within the LOE
- Can send the LOE to the client's email for signing
- LOE is stored against the client record

### US-1.2: E-Signature Integration
**As a** fee earner,
**I want** clients to electronically sign LOEs via a signing service (e.g., Adobe Sign),
**so that** I don't need to manage physical signatures.

**Acceptance Criteria:**
- LOE is sent with a signing link
- System receives callback or status update when signed
- Signed document is stored in the system

### US-1.3: LOE Status Tracking
**As an** administrator,
**I want to** see a list of all clients and whether they have a signed LOE,
**so that** I can ensure compliance before billing.

**Acceptance Criteria:**
- LOE list page showing client name, LOE status (draft, sent, signed, expired)
- Filter by status
- Can click through to view the LOE document
- Can see the fee terms agreed in the LOE

### US-1.4: Link Fee Schedules to LOE
**As a** fee earner,
**I want** the LOE to reference specific fee schedules and rates,
**so that** billing terms are captured at engagement and can be referenced later.

**Acceptance Criteria:**
- When creating an LOE, can select fee schedule items and rates
- Agreed rates are stored and visible from the client/matter record

---

## Epic 2: Unbilled Fees Page

### US-2.1: Dedicated Unbilled Fees Browse Page
**As a** fee earner,
**I want** a dedicated page listing all unbilled fees and disbursements across all matters,
**so that** I can review and manage work-in-progress before invoicing.

**Acceptance Criteria:**
- Page at `/unbilled-fees` showing all fee entries where `invoiced = false`
- Columns: date, matter, client, description, fee earner, amount
- Sortable and filterable by matter, client, fee earner, date range
- Shows total unbilled amount

### US-2.2: Edit Unbilled Fees Inline
**As a** fee earner,
**I want to** click on an unbilled fee entry and edit it directly,
**so that** I can correct descriptions, amounts, or time before invoicing.

**Acceptance Criteria:**
- Click entry to open edit form (slide-over or modal)
- Can update description, quantity, rate, amount
- Changes save immediately and reflect in the list

### US-2.3: Create Pro Forma Invoice from Unbilled Fees
**As a** fee earner,
**I want to** select unbilled fee entries and generate a pro forma invoice,
**so that** I can send a draft to the client for review before issuing a tax invoice.

**Acceptance Criteria:**
- Multi-select fee entries from unbilled fees page
- "Create Pro Forma" action generates a draft invoice
- Pro forma can be converted to a tax invoice later

---

## Epic 3: Timesheet Enhancements

### US-3.1: Timesheet Stats Header
**As a** fee earner,
**I want to** see a summary header on my timesheet showing this month's fees, last month's fees, and my target,
**so that** I can track my billing performance at a glance.

**Acceptance Criteria:**
- Stats bar at top of timesheet: current month total, last month total, monthly target
- Includes a fee graph (same as dashboard)

### US-3.2: Quick Matter Selection from Recent Activity
**As a** fee earner,
**I want** the timesheet to show matters I've already recorded time against this week/month,
**so that** I can quickly select a matter and add more entries without searching.

**Acceptance Criteria:**
- Section showing "Recent matters" with quick-add buttons
- Displays matters with existing entries for the current period
- Clicking a matter pre-fills the matter field in the fee entry form

### US-3.3: Week/Month Toggle View
**As a** fee earner,
**I want to** toggle my timesheet between a week view and a month view,
**so that** I can see what I've already recorded and identify gaps.

**Acceptance Criteria:**
- Toggle control: "Week" / "Month"
- Week view shows daily breakdown for the current week
- Month view shows all entries for the current month
- Both views show totals

### US-3.4: Side Panel Diary on Timesheet
**As a** fee earner,
**I want** a side panel on the timesheet showing my diary entries for the day,
**so that** I can reference what I did and record time against it.

**Acceptance Criteria:**
- Collapsible side panel showing today's diary entries
- Can click a diary entry to pre-fill a fee entry form

---

## Epic 4: Collections Workflow

### US-4.1: Collection Action Tracking
**As an** administrator,
**I want to** record collection actions against overdue invoices (e.g., follow-up call, letter of demand, summons warning),
**so that** I have a history of collection efforts.

**Acceptance Criteria:**
- On the collections page, each debtor row can be expanded
- Can add action entries with: date, action type (from predefined list), notes
- Action types: Invoice Sent, Follow-up, Letter of Demand, Warned of Summons, Summons Issued
- Action history displayed chronologically

### US-4.2: Interest Calculation on Outstanding Invoices
**As an** administrator,
**I want** the system to calculate interest on overdue invoices based on the rate in the Letter of Engagement,
**so that** I can include accrued interest in collection communications.

**Acceptance Criteria:**
- Interest rate configurable per client (from LOE terms) or a firm-wide default
- System calculates simple interest from invoice due date to current date
- Interest amount shown on collections page per invoice
- Total with interest shown

---

## Epic 5: Client-Facing FICA Portal

### US-5.1: Public FICA Upload Link
**As an** administrator,
**I want to** generate a unique URL for each client that they can visit to upload their FICA documents,
**so that** clients can self-serve without needing system access.

**Acceptance Criteria:**
- Generate a unique, secure link per client
- Link opens a public page (no login required) with the firm's branding
- Client can upload documents which are stored against their FICA record
- Link can be emailed to the client

### US-5.2: Entity Type Selection with Dynamic Document Requirements
**As a** client visiting the FICA portal,
**I want to** select my entity type (individual, company, trust, etc.) and see which documents are required,
**so that** I know exactly what to upload.

**Acceptance Criteria:**
- Portal asks client to select entity type
- Document checklist updates dynamically based on entity type
- Client uploads documents against each requirement
- Status is reflected in the admin's FICA tracking

---

## Epic 6: Zone-Based Permission System

### US-6.1: Permission Zone Data Model
**As a** system administrator,
**I want** the system to use a zone-based permission model instead of simple roles,
**so that** I can granularly control what each user can access.

**Acceptance Criteria:**
- Database supports 16 permission zones as defined in Permission-Requirements.md
- Users can have multiple zones assigned
- Zones are additive (no zone removes permissions from another)
- Seed data creates default zone presets (Partner, Senior Associate, Junior Associate, Bookkeeper, Assistant, Auditor)

### US-6.2: Zone Assignment UI
**As a** system administrator,
**I want to** assign and remove permission zones for each user through the settings UI,
**so that** I can manage access without database changes.

**Acceptance Criteria:**
- User edit page shows all available zones as checkboxes
- Can toggle zones on/off per user
- Can optionally scope Junior Department Admin zone to specific departments
- Preset buttons for common role combinations

### US-6.3: Zone-Based API Authorization
**As a** developer,
**I want** all API routes to check zone-based permissions instead of role-based checks,
**so that** access control is enforced consistently.

**Acceptance Criteria:**
- `hasZone()` and `hasAnyZone()` helper functions implemented
- All existing API routes migrated to use zone checks (per mapping in Permission-Requirements.md)
- Unauthorized requests return 403 with clear error message

---

## Epic 7: New Client Leads Module

### US-7.1: New Client Leads Database
**As an** administrator,
**I want** a section to store enquiries from potential clients,
**so that** I can track leads before they become formal clients.

**Acceptance Criteria:**
- "New Client Leads" page accessible from Clients section
- Fields: name, email, phone, enquiry date, source, notes, status (new, contacted, converted, closed)
- Can convert a lead to a full client record

### US-7.2: Quick-Add Lead with Consultation Email
**As a** fee earner,
**I want** a quick-add button in the top bar to capture a new lead's details and trigger a consultation email,
**so that** I can respond to phone enquiries immediately.

**Acceptance Criteria:**
- "Add" button in the top navigation bar
- Opens a compact form: name, email, phone, brief notes
- On save, creates a lead record and sends a templated consultation booking email
- Lead appears in New Client Leads section

---

## Epic 8: Dashboard Enhancements

### US-8.1: Fee Graph Period Toggle
**As a** fee earner,
**I want to** toggle the dashboard fee graph to show different time periods (6 months, 1 year, 2 years, 3 years, 5 years),
**so that** I can analyze revenue trends over time.

**Acceptance Criteria:**
- Period selector buttons above the fee chart
- Options: 1 month (default), 6 months, 1 year, 2 years, 3 years, 5 years
- Graph re-renders with appropriate data and time axis

### US-8.2: Fee Target Line on Graph
**As a** fee earner,
**I want** my monthly billing target displayed as a line on the fee chart,
**so that** I can see how I'm tracking against my goal.

**Acceptance Criteria:**
- Horizontal target line drawn on the fee chart
- Target value sourced from user's monthlyTarget field
- Visual distinction (dashed line, different color)

### US-8.3: Coming Up - Chronological Upcoming Events
**As a** fee earner,
**I want** a "Coming Up" section in the dashboard sidebar showing all upcoming diary entries in chronological order,
**so that** I can see what's ahead beyond just today.

**Acceptance Criteria:**
- Section below "Today's Diary" showing future diary entries
- Ordered chronologically, grouped by date
- Shows at least the next 2 weeks of entries
- Clicking an entry navigates to the diary/matter

---

## Epic 9: Calendar-Style Diary

### US-9.1: Visual Calendar Grid
**As a** fee earner,
**I want** the diary page to display as a visual calendar grid (day, week, month views),
**so that** I can see my schedule at a glance like Apple Calendar.

**Acceptance Criteria:**
- Day view: hourly time slots with entries
- Week view: 7-column grid with entries per day
- Month view: calendar grid with entry counts/previews
- Toggle between views
- Click to create new entry on a date/time

### US-9.2: Deadline Notifications
**As a** fee earner,
**I want to** receive browser notifications for upcoming diary deadlines,
**so that** I don't miss critical dates.

**Acceptance Criteria:**
- Browser notification permission requested on first use
- Notifications triggered for diary entries with upcoming due dates
- Configurable reminder timing (e.g., 15 min, 1 hour, 1 day before)

---

## Epic 10: Practice Overview Enhancements

### US-10.1: Extended Practice Overview Columns
**As a** partner,
**I want** the practice overview to include Last Bill Sent date, Monies Owed, and FICA/LOE status columns,
**so that** I have a complete operational picture in one view.

**Acceptance Criteria:**
- Columns added: Last Bill Sent (date of most recent invoice), Monies Owed (outstanding balance), FICA Status, LOE Status
- All columns sortable

### US-10.2: Red Highlighting for Debtors
**As a** partner,
**I want** client rows in the practice overview to be highlighted red when they owe money,
**so that** overdue accounts are immediately visible.

**Acceptance Criteria:**
- Rows with Monies Owed > 0 have a red/warning background tint
- Intensity or shade could vary by aging (optional)

---

## Epic 11: Business Account Payables

### US-11.1: Record Received Invoices (Accounts Payable)
**As a** bookkeeper,
**I want to** record invoices received from suppliers that need to be paid from the business account,
**so that** I can track what the firm owes.

**Acceptance Criteria:**
- "Received Invoices" section within Business Account
- Fields: supplier, invoice number, amount, due date, description, status (pending, paid)
- Link to supplier record

### US-11.2: Payment Reminder in Diary
**As a** bookkeeper,
**I want** a diary entry automatically created when a received invoice is due,
**so that** I don't miss payment deadlines.

**Acceptance Criteria:**
- When a received invoice is created, a diary entry is auto-created for the due date
- Diary entry references the invoice and supplier
- Marking the invoice as paid marks the diary entry as complete

---

## Epic 12: Matter Task Allocation

### US-12.1: Assign Tasks from Matter View
**As a** fee earner,
**I want to** create to-do items within a matter and assign them to specific team members with due dates,
**so that** work is allocated and tracked.

**Acceptance Criteria:**
- To-do section within matter detail view
- Can add a task with: description, assignee (user), due date, priority
- Assigned tasks appear in the assignee's diary/calendar
- Tasks can be marked complete

### US-12.2: To-Do Column on Matters List
**As a** partner,
**I want** the matters list to show a count or summary of outstanding to-do items per matter,
**so that** I can see which matters need attention.

**Acceptance Criteria:**
- "To Do" column on matters list showing count of incomplete tasks
- Click to expand and see task details

---

## Epic 13: Trust Balance by Client

### US-13.1: Client Trust Balance Summary
**As a** bookkeeper,
**I want** a summary view showing trust account balances grouped by client,
**so that** I can see at a glance which clients have trust funds and how much.

**Acceptance Criteria:**
- Trust account page includes a "Balances by Client" view/tab
- Shows client name, total trust balance, last transaction date
- Sortable by balance amount
- Click client to see their trust ledger

---

## Epic 14: Fee Schedule Enhancements

### US-14.1: Trademark Fee Schedules by Country
**As an** administrator,
**I want to** create trademark fee schedules categorized by country (South Africa, Australia, UK, USA, etc.),
**so that** we can quickly reference the correct fees when doing trademark work.

**Acceptance Criteria:**
- Fee schedule categories support a "country" tag
- Pre-built categories: South Africa, Australia, United Kingdom, America
- Can add additional countries
- Items within each have the specific trademark fees

### US-14.2: Link Fee Schedule to Time Entry
**As a** fee earner,
**I want to** select a fee from a fee schedule when recording time,
**so that** the description and rate are auto-populated.

**Acceptance Criteria:**
- Fee entry form has optional "From Schedule" selector
- Selecting a schedule item populates description, rate, and amount
- Can still override values after selection

---

## Epic 15: Client Detail Enhancements

### US-15.1: Outstanding Balance on Client Detail
**As a** fee earner,
**I want** the client detail page to show the total outstanding balance,
**so that** I know the client's financial position before engaging with them.

**Acceptance Criteria:**
- Client detail header shows total outstanding (sum of unpaid invoices)
- Breakdown by invoice visible on click

### US-15.2: Statement Link on Client Detail
**As a** fee earner,
**I want** a direct link to generate/view a client statement from their detail page,
**so that** I can quickly produce a statement without navigating elsewhere.

**Acceptance Criteria:**
- "View Statement" button on client detail page
- Opens statement in a new tab or modal
- Option to download as PDF or email to client

---

## Epic 16: Lower Priority Enhancements

### US-16.1: AI Chatbot for Data Queries
**As a** fee earner,
**I want** a chatbot in the app that I can ask questions about my data (e.g., "What's my WIP total?", "How many matters are open?"),
**so that** I can get quick answers without navigating to specific pages.

### US-16.2: Email Integration via Reference Number
**As a** fee earner,
**I want** emails tagged with a matter reference number to be linked to that matter,
**so that** correspondence is centralized.

### US-16.3: Email Calendar Sync
**As a** fee earner,
**I want** diary entries to sync with my email calendar (Google/Outlook),
**so that** I see legal deadlines alongside my other commitments.

### US-16.4: Name Display Toggle
**As a** user,
**I want to** toggle whether client names are displayed as "Surname, First Name" or "First Name Surname",
**so that** the display matches my preference.

### US-16.5: Audit/Tax Report Bundles
**As a** bookkeeper,
**I want** pre-configured report bundles for audit and tax season,
**so that** I can generate all required reports in one action.
