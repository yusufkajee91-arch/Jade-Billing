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
