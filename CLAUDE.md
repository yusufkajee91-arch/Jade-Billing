# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md
@docs/dataflow.md

## Project Overview

Legal billing system for Dolata & Co Attorneys. Manages clients, matters, fee entries, invoicing, trust/business accounting, bank reconciliation, FICA compliance, and diary scheduling.

## Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build (runs prisma generate first)
npm run lint         # ESLint
npm run test         # Vitest in watch mode
npm run test:run     # Vitest single run (CI)
npx vitest run src/__tests__/matters.test.ts          # Run a single test file
npx vitest run src/lib/__tests__/time-parser.test.ts  # Run a single lib test
```

### Database

```bash
npx prisma migrate dev       # Create + apply migration during dev
npx prisma migrate deploy    # Apply pending migrations (prod/CI)
npx prisma generate          # Regenerate Prisma client after schema changes
npx tsx prisma/seed.ts       # Seed database
```

After running `prisma generate`, bump `PRISMA_SCHEMA_VERSION` in `src/lib/prisma.ts` so the dev server picks up the new client.

### E2E Tests (Playwright)

```bash
npm run test:e2e             # Run all E2E tests (headless)
npm run test:e2e:headed      # Run with visible browser
npm run test:e2e:ui          # Interactive Playwright UI
npm run test:e2e:debug       # Debug mode
```

E2E tests run against `localhost:3001` (not 3000). They use `.env.test` and create a fresh `dcco_billing_test` database via `e2e/global-setup.ts`. Auth state is stored in `e2e/.auth/` (admin and fee_earner fixtures).

## Architecture

- **Next.js 16** with App Router, React 19, TypeScript, Tailwind CSS v4
- **Auth**: NextAuth.js v4 with JWT strategy + credentials provider (`src/lib/auth.ts`). Custom claims on token: `id`, `role`, `initials`.
- **Database**: PostgreSQL via Prisma 7 with the `@prisma/adapter-pg` driver adapter
- **Prisma client**: Generated to `src/generated/prisma/` (not default location)
- **UI**: shadcn/ui components in `src/components/ui/`, icons from `lucide-react`, toasts via `sonner`
- **Forms**: react-hook-form + zod validation
- **PDF generation**: `@react-pdf/renderer` (`src/lib/invoice-pdf.tsx`)
- **Charts**: Recharts for dashboard analytics
- **Excel**: `xlsx` for import/export
- **Email**: Nodemailer for SMTP (`src/lib/email.ts`)
- **Theming**: next-themes (light/dark), fonts: Playfair Display (headings) + Noto Sans (body)
- **No middleware.ts**: Auth is checked server-side in layouts and API routes, not via middleware.

### Route Structure

- `src/app/(auth)/` — login page (public)
- `src/app/(app)/` — authenticated app shell; layout checks session and redirects to `/login` if unauthenticated. Sections: dashboard, clients, matters, timesheet, invoices, diary, reports, trust, reconciliation, business, settings, etc.
- `src/app/api/` — API routes for each domain (clients, matters, invoices, trust-entries, bank-statements, reconciliation, etc.)

### API Route Patterns

All API routes follow a consistent structure:

1. **Auth**: `getServerSession(authOptions)` → 401 if missing
2. **Authorization**: Role checks → 403 if insufficient (admin-only for clients/users/firm-settings/GL-accounts; fee_earner+admin for fee entries POST; owner-or-assigned for matters)
3. **Validation**: Zod `.safeParse()` → 400 with `{ error, details: parsed.error.flatten() }`
4. **Response**: Direct JSON (no wrapper). 201 for POST, 200 for GET/PATCH. Errors: `{ error: string }`
5. **Business errors**: 409 for conflicts/duplicates, 422 for business logic violations (e.g., insufficient trust funds)

### Key Patterns

- **Monetary values** are stored as integer cents (`*Cents` fields) throughout the schema and API to avoid floating-point issues. VAT rate is stored in basis points (`vatRateBps`, default 1500 = 15%). Use `formatCurrency()` from `src/lib/utils.ts` for display (ZAR).
- **Prisma schema** uses `@@map` to map PascalCase models to snake_case table/column names.
- **Atomic operations**: Matter code generation uses `ON CONFLICT...DO UPDATE` and invoice numbers use `UPDATE...RETURNING` to prevent race conditions.
- **Immutable invoice snapshots**: Invoices capture client, firm, and matter data at creation time. Invoice line items snapshot fee entry data — `feeEntryId` is informational only.
- **Invoice state machine**: `draft_pro_forma` → `sent_pro_forma` → `draft_invoice` → `sent_invoice` → `paid`. Types: `pro_forma`, `invoice`.
- **Billing blocks**: South African 6-minute billing standard. `roundToBillingBlock()` in `src/lib/billing-blocks.ts` rounds to ceil(minutes/6)*6.
- **Fee entry types**: `time` (hourly), `unitary` (units stored as integer thousandths), `disbursement` (fixed amount).
- **Double-entry bookkeeping**: `JournalEntry` + `JournalLine` with matter sub-ledger tagging via `GlAccount`.
- **Trust entries**: Linked entry pairs for transfers (via `linkedEntryId`).
- **User roles**: `admin`, `fee_earner`, `assistant`. Fee earners see only own entries unless admin. Non-admins access only owned/assigned matters.
- **Path alias**: `@/` maps to `src/` (configured in tsconfig and vitest).

### Component Organization

- `src/components/ui/` — shadcn/ui primitives
- `src/components/layout/` — app shell: sidebar, FAB, settings nav
- Feature components grouped by domain: `bookkeeping/`, `clients/`, `dashboard/`, `diary/`, `invoices/`, `matters/`, `time-recording/`, `reports/`, `search/`, `suppliers/`
- `TimeRecordingProvider` wraps the app for global time recording state; `FeeEntrySlideOver` is portalled in the app layout
- Global search: `CommandPalette` + `GlobalSearchBar` in app layout

### Key Libraries in `src/lib/`

- **`prisma.ts`** — Singleton Prisma client with schema version cache-busting
- **`auth.ts`** — NextAuth config with credentials provider, JWT callbacks
- **`entity-types.ts`** — Client entity type enum labels and `formatEntityType()` helper
- **`matter-code.ts`** — Atomic matter code generation (format: `{INITIALS}/{CLIENT_CODE}-{SEQ}`)
- **`time-parser.ts`** — Flexible time input parsing ("90", "1h30", "1:30", "1.5h") and `formatMinutes()`
- **`billing-blocks.ts`** — 6-min block rounding, `calcTimeAmount()`, `calcDiscount()`
- **`invoice-number.ts`** — Atomic invoice number generation (format: `INV-0042`)
- **`utils.ts`** — `cn()` (clsx+tailwind-merge), `formatCurrency()` (ZAR), `formatDate()` (ZA locale)
- **`fnb-csv-parser.ts`** — FNB bank CSV parsing for statement imports
- **`excel-export.ts`** — Excel export utilities

### Tests

- **Unit tests**: `src/lib/__tests__/` — business logic utilities
- **Integration tests**: `src/__tests__/` — API route handler logic via helper functions, mocking Prisma and NextAuth with `vi.mock()`
- **E2E tests**: `e2e/tests/` — 20+ Playwright suites with real database. Auth fixtures in `e2e/.auth/` (admin password from seed, fee_earner password `Earner1234!`)
- **Test environment**: jsdom, globals enabled, setup file at `src/__tests__/setup.ts`

## Environment Variables

Required in `.env.local`: `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`. See `.env.example`.

E2E tests use `.env.test` with a separate `dcco_billing_test` database.
