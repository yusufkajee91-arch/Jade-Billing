# Dependency Map

## Layer Hierarchy (top → bottom, never import upward)

```
Pages       src/app/(app)/**  src/app/(auth)/**
              |          |
API Routes  src/app/api/**
              |
Components  src/components/{feature}/
              |
UI          src/components/ui/
              |
Lib         src/lib/*
              |
Data        src/generated/prisma/   (+ prisma/schema.prisma)
```

Rules: Pages import Components + Lib. API routes import Lib + Generated. Components import UI + Lib. UI imports only Lib/utils. Lib files may import Lib/prisma but nothing else in src/. No component imports Generated/Prisma directly — all DB access is server-side.

## Foundation Layer (src/lib/) — depended on by everything above

| File | Exports | Depends on | Consumed by |
|------|---------|------------|-------------|
| prisma.ts | `prisma` singleton | — | 80 files: all API routes, auth.ts, matter-code.ts, invoice-number.ts, 5 pages (server) |
| auth.ts | `authOptions` | prisma.ts | 81 files: all API routes, (app)/layout.tsx, 17 pages |
| utils.ts | `cn`, `formatCurrency`, `formatDate` | — | 54 files: all UI components, all reports, bookkeeping, invoices, time-recording, 8 pages |
| entity-types.ts | `ENTITY_TYPE_LABELS`, `formatEntityType` | — | client-form, client-view, client detail page, fica page |
| billing-blocks.ts | `roundToBillingBlock`, `calcTimeAmount`, `calcDiscount` | — | fee-entry-form.tsx, api/fee-entries (2 routes) |
| time-parser.ts | `parseTimeToMinutes`, `formatMinutes` | — | fee-entry-form, timesheet-view, invoice-preview, invoice-create-form, matter-detail |
| excel-export.ts | `exportToExcel`, `ExcelSheet` | — | all 14 report components |
| invoice-pdf.tsx | `InvoicePDF` | — | api/invoices/[id]/pdf, api/invoices/[id]/send |
| statement-pdf.tsx | `StatementPDF` | — | api/clients/[id]/statement/pdf |
| invoice-number.ts | `claimInvoiceNumber` | prisma.ts | api/invoices/route.ts |
| matter-code.ts | `generateMatterCode` | prisma.ts | api/matters/route.ts |
| email.ts | `sendInvoiceEmail` | — | api/invoices/[id]/send |
| fnb-csv-parser.ts | `parseFnbCsv` | — | api/bank-statements/route.ts |
| import-utils.ts | `matchFeeEarner` | — | api/import/* (4 routes) |

## Component Layer — grouped by feature

**layout/** (app-layout, sidebar, fab, settings-nav)
- app-layout.tsx → sidebar, fab, search/command-palette, search/global-search, time-recording/provider + slide-over
- fab.tsx → time-recording/provider (useTimeRecording hook)
- sidebar.tsx → ui/avatar, lib/utils

**time-recording/** (provider, slide-over, form, timesheet)
- provider.tsx → standalone React context (no deps)
- slide-over.tsx → provider (useTimeRecording), fee-entry-form, ui/sheet
- fee-entry-form.tsx → lib/time-parser, lib/billing-blocks, lib/utils, 7 ui/ components
- timesheet-view.tsx → provider (useTimeRecording), lib/utils, lib/time-parser

**matters/** (detail, form, practice-overview)
- matter-detail.tsx → matter-form, time-recording/fee-entry-form, time-recording/provider, bookkeeping/trust-ledger, bookkeeping/business-ledger, lib/utils, lib/time-parser
- matter-form.tsx → 6 ui/ components
- practice-overview.tsx → lib/utils

**bookkeeping/** (trust-account-view, business-account-view, trust-ledger, business-ledger, reconciliation-view)
- All import lib/utils (formatCurrency, formatDate) + ui/button. No cross-feature deps.

**invoices/** (create-form, preview)
- Both import lib/utils, lib/time-parser. No cross-feature deps.

**clients/** (client-form, debtors-view)
- client-form.tsx → lib/entity-types, 7 ui/ components
- debtors-view.tsx → lib/utils

**dashboard/** (shell, widgets, charts)
- dashboard-shell.tsx → all 7 widget files + customise-panel
- Widget files are self-contained (fetch own data), some use lib/utils

**reports/** (14 reports + helpers + router)
- reports-view.tsx → all 14 individual report components
- Each report → lib/utils + lib/excel-export. No cross-feature deps.

**search/** (command-palette, global-search) — standalone, no cross-feature deps

## API Routes — all follow auth+prisma pattern

Every route imports `auth.ts` + `prisma.ts`. Additional specialized imports:
- fee-entries/* → billing-blocks.ts
- invoices/route.ts → invoice-number.ts
- invoices/[id]/pdf → invoice-pdf.tsx
- invoices/[id]/send → invoice-pdf.tsx + email.ts + utils.ts
- matters/route.ts → matter-code.ts
- bank-statements/route.ts → fnb-csv-parser.ts
- import/* → import-utils.ts
- clients/[id]/statement/pdf → statement-pdf.tsx
- invoices/[id]/route.ts, reconciliation/report, trust-register → @/generated/prisma enums

## If you change X, you MUST also check Y

**prisma/schema.prisma** → run `prisma generate`, bump PRISMA_SCHEMA_VERSION in lib/prisma.ts, check every API route that queries the changed model, check components that display that model's data

**lib/prisma.ts** → every API route (80 files), lib/auth.ts, lib/matter-code.ts, lib/invoice-number.ts, 5 server pages

**lib/auth.ts** → every protected API route, (app)/layout.tsx (session gate), all server pages using getServerSession, src/types/next-auth.d.ts (custom claims)

**lib/utils.ts (formatCurrency)** → 14 report components, all bookkeeping views, invoice components, timesheet-view, debtors-view, fees-chart, 8 pages. Changing ZAR format affects entire app display.

**lib/utils.ts (cn)** → all 17 ui/ components, sidebar, diary-view, calendar-widget

**lib/billing-blocks.ts** → fee-entry-form.tsx (client-side preview), api/fee-entries (2 routes, server-side save). Both MUST agree.

**lib/time-parser.ts** → fee-entry-form, timesheet-view, matter-detail, invoice-preview, invoice-create-form

**lib/excel-export.ts** → all 14 report components

**lib/entity-types.ts** → client-form, client-view, client detail page, fica page

**lib/invoice-pdf.tsx** → api/invoices/[id]/pdf (download), api/invoices/[id]/send (email attachment)

**lib/invoice-number.ts** → api/invoices/route.ts. Also depends on FirmSettings.nextInvoiceSeq — changing that column requires updating this file.

**lib/matter-code.ts** → api/matters/route.ts. Depends on MatterCodeSeq table — changing code format affects all existing matter references.

**components/time-recording/provider.tsx** → app-layout (wraps entire app), fab (trigger), slide-over (consumer), timesheet-view, matter-detail. Changing context shape breaks all consumers.

**components/ui/* (any shadcn component)** → grep for the component name; every feature area uses ui/button, ui/input, ui/sheet, ui/select, ui/dialog

**src/types/next-auth.d.ts** → lib/auth.ts (JWT callbacks), every file accessing session.user.role / .id / .initials

**components/reports/reports-view.tsx** → must be updated when adding/removing any report component

**components/dashboard/dashboard-shell.tsx** → must be updated when adding/removing any dashboard widget

**components/matters/matter-detail.tsx** → highest fan-out component; imports from matters, time-recording, bookkeeping. Changes to any of those features may require updates here.

## LP-parity tables (added 2026-04-20)

10 new master-data tables match LawPracticeZA's data model so historical data can be imported with full fidelity. All schema changes are additive — no existing column was dropped or renamed.

| Table | Purpose | Populated from |
|---|---|---|
| `currencies` | Multi-currency support (ZAR default) | LP `List_product` (currency cols) |
| `tax_types` | VAT/tax categorisation per posting code (e.g. TT_120 "Not Registered") | LP `List_product` (taxtype cols) |
| `posting_code_categories` | Groups posting codes (Fees, Disbursements) with default GL account | LP `List_productcategory` |
| `gl_account_categories` | GL account grouping (Assets, Liabilities, Equity, Income, Expenses) | LP `List_accountcategory` |
| `receipt_methods` | Cash/EFT methods linked to bank accounts | LP `List_customerpaymentmethod` |
| `bank_accounts` | Trust/Business/Investment bank accounts (replaces hardcoded FirmSettings) | LP bank screenshot + FirmSettings |
| `supplier_types` | Categorises suppliers (advocates, sheriffs, etc.) | LP `List_suppliertype` |
| `contacts` | Per-client contact persons separate from main client record | LP `List_contact` |
| `canned_narrations` | Pre-built narration templates by context | LP `List_cannednarration` |
| `investment_entries` | Investment-ledger transactions (Section 86(4) accounts) | LP investment ledger statements |

New columns on existing tables (LP-parity):
- `clients` + 20 cols: trading_as, reg_number, id_number, title/first_name/surname, tax_number, fax, website, sector, notes, credit_terms, bank_*, currency_id, tax_type_id, client_ref, account_number, department_id
- `matters` + 15 cols: client_ref, account_number, restricted, billing_entity_override, default_discount_percent, fee_level_id, investment_name, claim_amount_cents, reserve_trust, fee_cap_*, tax_number, css_class, email, accounts_email
- `fee_entries` + 3 cols: vat_flag (Y/N enum), stamp_date (when entered, distinct from entry_date), capturer_id (FK to users — distinct from fee_earner_id)
- `posting_codes` + 6 cols: category_id, department_id, unit_type (time/qty enum), default_unit_price_cents, tax_type_id, gl_account_id
- `suppliers` + 14 cols: supplier_code (unique), supplier_type_id, default_account_id, trading_as, reg_number, tax_number, addresses, credit_days, bank_*
- `invoices` + 2 cols: original_invoice_id (self-FK for credit_note → original), lp_pdf_url
- `gl_accounts` + 4 cols: category_id, fee_earner_id, opening_balance_cents, flag

Enum extensions:
- `InvoiceType` += `credit_note`
- `BankAccountType` += `investment`
- New: `VatFlag` (Y/N), `UnitType` (time/qty), `TaxTypeCategory` (sales/purchase), `NarrationContext`, `InvestmentEntryType`

## DB triggers (auto-generate journals on bookkeeping inserts)

Three triggers fire on `trust_entries`/`business_entries` INSERT:
- `trg_check_trust_balance` — blocks `trust_payment`/`trust_transfer_out` that would put a matter's trust balance below zero. **Disable during bulk historical imports** (e.g. `ALTER TABLE trust_entries DISABLE TRIGGER trg_check_trust_balance`).
- `trg_gl_journal_trust` → `generate_gl_journal_for_trust()` — auto-creates `journal_entries` + `journal_lines` for receipts/payments (codes 1001, 2001). Skips inter-matter transfers (net GL effect = 0).
- `trg_gl_journal_business` → `generate_gl_journal_for_business()` — same pattern for business side.

When importing historical data, leave the GL-journal triggers ON so journals are created automatically; only the balance-check trigger needs disabling.

## LP-import scripts (`scripts/phase*.mjs`)

Single-shot reproducible scripts run via `node --env-file=.env.local scripts/phaseX-Y-name.mjs`. Each is idempotent (truncate-and-reimport for transactional, upsert for masterfile).

Source files: `Documentation/Recon/*.xlsx` — original LP exports. `Documentation/Recon/PARITY.md` tracks row-count parity per phase. `Documentation/Recon/lp-user-mapping.md` documents the LP-login → Casey-user alias map used to attribute historical `created_by`.

The `lp-import@dcco.law` user (role=admin, is_active=false) is the system attribution for any LP entry whose original poster doesn't map to a real Casey user (Chris Geale = LP vendor, Shaan Stander = external, System = LP auto-posts).
