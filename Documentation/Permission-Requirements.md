# Permission Requirements — Zone-Based Access Control

**Source:** LawPractice ZA permission zones (screenshot)
**Date:** 30 March 2026
**Purpose:** Translate LawPractice ZA's 16 permission zones into requirements for dcco-billing

---

## Current vs Required Role Model

### Current (dcco-billing)
3 roles: `admin`, `fee_earner`, `assistant` — too coarse for the permission model needed.

### Required (from LawPractice ZA zones)
A **zone-based permission system** where each user is assigned one or more permission zones. Zones are additive — a user with multiple zones gets the combined permissions of all assigned zones.

---

## Zone Definitions

### 1. General Access (required for all users)
- **Grants:** Basic app access — login, view dashboard, navigate sidebar
- **Rule:** Every user must have this zone at minimum
- **Maps to:** Authenticated session baseline

### 2. Fee Earner
- **Grants:** Record time entries (WIP/draft items) against matters assigned to them
- **Grants:** Edit/delete their own WIP (draft fee entries not yet invoiced)
- **Does NOT grant:** Editing other users' WIP, raising invoices, or accessing reports
- **Maps to:** Time recording, own fee entry CRUD

### 3. Fee Earner Reports
- **Grants:** View own performance data — amounts billed, targets, time summaries
- **Does NOT grant:** Viewing other fee earners' data
- **Maps to:** Personal fee chart, own timesheet, own performance stats

### 4. Senior File Manager
- **Grants:** Edit and delete matter notes and attachments
- **Maps to:** Matter notes CRUD, matter attachments CRUD

### 5. Access Any Matter
- **Grants:** View all matters in the system regardless of ownership or assignment
- **Without this:** User can only see matters they own or are assigned to
- **Maps to:** Remove matter ownership filter on GET queries

### 6. Raise Invoices
- **Grants:** Convert draft WIP items into invoices (pro forma and tax invoices)
- **Grants:** Send invoices by email
- **Does NOT grant:** Reversals or credit notes
- **Maps to:** POST /api/invoices, invoice PDF generation, invoice email

### 7. Bookkeeper
- **Grants:** Post all transaction types (trust receipts, trust payments, business entries)
- **Grants:** View most reports (invoice register, WIP, time summary, trial balance)
- **Does NOT grant:** Bank statement access or account balances (need Senior Bookkeeper)
- **Maps to:** Trust entry CRUD, business entry CRUD, standard report access

### 8. Senior Bookkeeper (Additional Permissions)
- **Grants:** View transactions and balances of any account
- **Grants:** Bank statement import and viewing
- **Grants:** Bank reconciliation (side-by-side matching, auto-match)
- **Rule:** Partners and senior bookkeepers should have this in addition to Bookkeeper
- **Maps to:** Bank statement CRUD, reconciliation, account balance views

### 9. Edit WIP (Edit or Delete Others' Draft Items)
- **Grants:** Edit/delete any user's WIP (draft fee entries) regardless of who captured them
- **Context:** Without this zone, users can only edit their own WIP. Matter owners can delete any WIP on their own matters.
- **Maps to:** Bypasses ownership check on fee entry PATCH/DELETE

### 10. Junior Department Admin
- **Grants:** View billing reports and run invoices/statements for specific department(s)
- **Use case:** Non-bookkeeper who needs department-scoped billing visibility
- **Rule:** When assigning this zone, also select which department(s) the user can access
- **Maps to:** Department-scoped access to invoice register, WIP report, statements

### 11. Reversals
- **Grants:** Reverse accounting entries (e.g. credit an invoice)
- **Does NOT grant:** Without this, entries are permanent once posted
- **Maps to:** Invoice credit notes, trust/business entry reversal

### 12. Masterfile Manager
- **Grants:** Create and update master data — clients, matters, suppliers, posting codes, matter types, departments, fee levels
- **Does NOT grant:** Firm settings or user management
- **Maps to:** Client CRUD, matter CRUD, supplier CRUD, posting code CRUD, reference data management

### 13. Auditor
- **Grants:** Read-only access to all financial data, reports, and ledgers
- **Does NOT grant:** Any write/edit/delete capability
- **Rule:** Do not assign to users who already have Senior Bookkeeper — use Auditor only for external auditors
- **Maps to:** Read-only access to GL detail, balance sheet, income/expense, matter ledger, trust register, reconciliation report

### 14. Payroll
- **Grants:** Access to payroll module
- **Maps to:** Future feature — not yet built in dcco-billing
- **Status:** Deferred

### 15. Collections
- **Grants:** View debtors age analysis, outstanding invoices, collection follow-up
- **Maps to:** Debtors page, collections workflow

### 16. Administer Users
- **Grants:** Create, edit, deactivate users. Assign permission zones to users.
- **Rule:** Only give to senior staff as it enables creating a user with any permission
- **Maps to:** User management CRUD, zone assignment

### 17. Can Delete Applied Workflows
- **Grants:** Delete workflow items that have already been applied/finalised
- **Maps to:** Future feature — not yet built in dcco-billing
- **Status:** Deferred

---

## Implied Business Rules

| Rule | Source |
|------|--------|
| All users must have General Access | Explicit in LawPractice ZA notes |
| Users can edit/delete their own WIP | Default behaviour |
| Matter owners can delete any WIP on their matters | Explicit in notes |
| Edit WIP zone removes the ownership restriction | Explicit in notes |
| Bookkeeper + Senior Bookkeeper should be combined for partners | Explicit in notes |
| Auditor is for external auditors only — don't give to Senior Bookkeepers | Explicit in notes |
| Administer Users is restricted to senior staff | Explicit in notes |
| Zones are additive — no zone removes permissions from another | Implied by design |

---

## Recommended Implementation Approach

### Database Changes

Replace the current `UserRole` enum with a zone-based permission system:

```
Table: permission_zones
  - id (TEXT, PK)
  - name (TEXT, unique) — e.g. "fee_earner", "bookkeeper"
  - description (TEXT)

Table: user_zones
  - user_id (TEXT, FK → users)
  - zone_id (TEXT, FK → permission_zones)
  - department_id (TEXT, FK → departments, nullable) — for Junior Department Admin scoping
  - PRIMARY KEY (user_id, zone_id)
```

### Permission Check Pattern

```typescript
// Helper: check if user has a specific zone
function hasZone(session: Session, zone: string): boolean

// Helper: check if user has any of the specified zones
function hasAnyZone(session: Session, zones: string[]): boolean

// Example usage in API route:
if (!hasZone(session, 'raise_invoices')) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

### Seed Data — Default Zone Assignments

| Preset Role | Zones Assigned |
|-------------|---------------|
| **Partner / Admin** | All zones except Auditor and Payroll |
| **Senior Associate** | General Access, Fee Earner, Fee Earner Reports, Senior File Manager, Access Any Matter, Raise Invoices, Edit WIP, Collections |
| **Junior Associate** | General Access, Fee Earner, Fee Earner Reports |
| **Bookkeeper** | General Access, Bookkeeper, Senior Bookkeeper, Raise Invoices, Collections, Masterfile Manager |
| **Assistant** | General Access, Masterfile Manager, Senior File Manager |
| **Auditor** | General Access, Auditor |

---

## Migration Path from Current Roles

| Current Role | Maps To |
|-------------|---------|
| `admin` | All zones (Partner preset) + Administer Users |
| `fee_earner` | General Access + Fee Earner + Fee Earner Reports |
| `assistant` | General Access only (review if Masterfile Manager should be added) |

---

## Mapping to Existing Endpoints

| Endpoint | Current Guard | Required Zone(s) |
|----------|--------------|-----------------|
| `GET /api/posting-codes` | admin | General Access (read), Masterfile Manager (write) |
| `POST /api/posting-codes` | admin | Masterfile Manager |
| `GET /api/fee-levels` | admin | General Access (read), Masterfile Manager (write) |
| `GET /api/fee-schedules` | admin | General Access (read), Masterfile Manager (write) |
| `GET /api/firm-settings` | admin | General Access (read) |
| `PUT /api/firm-settings` | admin | Administer Users |
| `GET /api/users` | admin | Administer Users |
| `POST /api/users` | admin | Administer Users |
| `POST /api/fee-entries` | not assistant | Fee Earner |
| `PATCH /api/fee-entries/[id]` | admin or owner | Owner OR Edit WIP |
| `DELETE /api/fee-entries/[id]` | admin or owner | Owner OR Edit WIP OR matter owner |
| `POST /api/invoices` | admin | Raise Invoices |
| `POST /api/matters/[id]/notes` | admin | Senior File Manager |
| `POST /api/matters/[id]/attachments` | admin | Senior File Manager |
| `GET /api/matters/[id]` | admin or owner/team | Owner/team OR Access Any Matter |
| `POST /api/clients` | not assistant | Masterfile Manager |
| `POST /api/suppliers` | not assistant | Masterfile Manager |
| `POST /api/trust-entries` | not assistant | Bookkeeper |
| `DELETE /api/trust-entries/[id]` | admin | Reversals |
| `POST /api/business-entries` | not assistant | Bookkeeper |
| `DELETE /api/business-entries/[id]` | admin | Reversals |
| `GET /api/bank-statements` | admin | Senior Bookkeeper |
| `POST /api/bank-statements` | admin | Senior Bookkeeper |
| `POST /api/bank-matches` | admin or fee_earner | Senior Bookkeeper |
| `GET /api/reconciliation/report` | admin | Senior Bookkeeper OR Auditor |
| `GET /api/reports/balance-sheet` | admin | Bookkeeper OR Auditor |
| `GET /api/reports/gl-detail` | admin | Bookkeeper OR Auditor |
| `GET /api/reports/income-expense` | admin | Bookkeeper OR Auditor |
| `GET /api/reports/fee-earner-performance` | admin | Administer Users |
| `GET /api/reports/matter-ledger` | admin | Bookkeeper OR Auditor |
| `GET /api/debtors` | admin | Collections |
| `POST /api/import/*` | admin | Administer Users |
| `DELETE /api/fica-documents/[id]` | admin | Masterfile Manager |

---

*Translated from LawPractice ZA permission zones — 30 March 2026*
