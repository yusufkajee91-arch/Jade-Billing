# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project Overview

Legal billing system for Dolata & Co Attorneys. Manages clients, matters, fee entries, invoicing, trust/business accounting, bank reconciliation, FICA compliance, and diary scheduling.

## Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
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

## Architecture

- **Next.js 16** with App Router, React 19, TypeScript, Tailwind CSS v4
- **Auth**: NextAuth.js v4 with JWT strategy + credentials provider (`src/lib/auth.ts`)
- **Database**: PostgreSQL via Prisma 7 with the `@prisma/adapter-pg` driver adapter
- **Prisma client**: Generated to `src/generated/prisma/` (not default location)
- **UI**: shadcn/ui components in `src/components/ui/`, icons from `lucide-react`, toasts via `sonner`
- **Forms**: react-hook-form + zod validation
- **PDF generation**: `@react-pdf/renderer` (`src/lib/invoice-pdf.tsx`)
- **Theming**: next-themes (light/dark), fonts: Playfair Display (headings) + Noto Sans (body)

### Route Structure

- `src/app/(auth)/` — login page (public)
- `src/app/(app)/` — authenticated app shell; layout checks session and redirects to `/login` if unauthenticated. Sections: dashboard, clients, matters, timesheet, invoices, diary, reports, trust, reconciliation, business, settings, etc.
- `src/app/api/` — API routes for each domain (clients, matters, invoices, trust-entries, bank-statements, reconciliation, etc.)

### Key Patterns

- **Monetary values** are stored as integer cents (`*Cents` fields) throughout the schema and API to avoid floating-point issues. VAT rate is stored in basis points (`vatRateBps`, default 1500 = 15%).
- **Prisma schema** uses `@@map` to map PascalCase models to snake_case table/column names.
- **Path alias**: `@/` maps to `src/` (configured in tsconfig and vitest).
- **Tests** live in `src/__tests__/` (integration/API tests) and `src/lib/__tests__/` (unit tests for utilities). Test environment is jsdom with setup file at `src/__tests__/setup.ts`.
- **Entity types** and shared type definitions are in `src/lib/entity-types.ts` and `src/types/`.

## Environment Variables

Required in `.env.local`: `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`. See `.env.example`.
