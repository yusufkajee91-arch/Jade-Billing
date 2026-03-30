# Copilot Instructions for DCCO Billing System

**See also:** [CLAUDE.md](../CLAUDE.md) for project overview, commands, architecture, and environment setup.

## Quick Start for AI Agents

- **Tech Stack**: Next.js 16 + React 19 + Prisma 7 + PostgreSQL + TypeScript
- **Database**: Monetary values must use integers (cents) — NEVER floats
- **Key Warning**: Next.js 16 has breaking changes from training data — check `node_modules/next/dist/docs/` when in doubt
- **Generated Prisma client**: Located at `src/generated/prisma/` (non-standard location) — regenerate after schema changes with `npx prisma generate`, then bump `PRISMA_SCHEMA_VERSION` in `src/lib/prisma.ts`

### Essential Commands

**Development & Building:**
```bash
npm run dev              # Start dev server (localhost:3000)
npm run build            # Production build
npm run lint             # ESLint
npm run test             # Vitest in watch mode
```

**Database:**
```bash
npx prisma migrate dev   # Create + apply migration during dev
npx prisma generate      # Regenerate Prisma client (required after schema changes)
npm run test:run         # CI test runner
```

---

## Development Patterns & Conventions

### Monetary Values
- **Store as cents** (integers only): `feeCents: Int`, `trustBalanceCents: BigInt`
- **VAT stored in basis points**: `vatRateBps: Int` (default 1500 = 15%)
- **Why**: Avoid floating-point precision errors in financial calculations
- **Example**: $1,234.56 → 123456 cents in DB

### Prisma & Database
- **Models**: PascalCase in schema, auto-mapped to snake_case tables/columns via `@@map`
- **Generated location**: `src/generated/prisma/` (not `node_modules/.prisma/client`)
- **Environment**: `.env.local` must have `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- **Migrations**: Place in `prisma/migrations/` with descriptive names (e.g., `add_invoice_historical`)
- **After schema changes**:
  1. Run `npx prisma migrate dev` (creates migration + regenerates client)
  2. Run `npx prisma generate` if needed to force regeneration
  3. **Important**: Bump `PRISMA_SCHEMA_VERSION` in [src/lib/prisma.ts](../src/lib/prisma.ts) so dev server picks up new client

### Type Definitions & Path Aliases
- **Shared entity types**: `src/lib/entity-types.ts` and `src/types/`
- **Path alias**: `@/` → `src/` (configured in [tsconfig.json](../tsconfig.json) and [vitest.config.ts](../vitest.config.ts))
- Always use `@/` for imports to avoid brittle relative paths

### API Routes & Authentication
- **Auth provider**: NextAuth.js v4 (JWT + credentials) — see [src/lib/auth.ts](../src/lib/auth.ts)
- **Protected routes**: `src/app/(app)/` layout enforces auth; unauthenticated users redirected to `/login`
- **API structure**: `src/app/api/[domain]/` — each domain (clients, matters, invoices, etc.) has its own route group
- **Session checks**: Use NextAuth session helpers to verify user identity in API routes

### Testing
- **Unit tests**: `src/lib/__tests__/` (utilities, helpers)
- **Integration tests**: `src/__tests__/` (API routes, end-to-end flows)
- **Environment**: jsdom with setup at [src/__tests__/setup.ts](../src/__tests__/setup.ts)
- **Run single test**: `npx vitest run src/__tests__/matters.test.ts`

### Forms & Validation
- **Framework**: react-hook-form + zod
- **Pattern**: Define zod schema → pass to `useForm()` → handle submission with error boundaries
- **Components**: Use shadcn/ui inputs for consistency

### UI & Styling
- **Components**: shadcn/ui in `src/components/ui/`
- **Icons**: lucide-react
- **Toasts**: sonner
- **Theming**: next-themes (light/dark mode)
- **Fonts**: Playfair Display (headings), Noto Sans (body)
- **CSS**: Tailwind CSS v4 (check postcss.config for @layer directives)

### PDF Generation
- **Library**: `@react-pdf/renderer`
- **Invoice PDFs**: [src/lib/invoice-pdf.tsx](../src/lib/invoice-pdf.tsx)
- **Remember**: PDF rendering has constraints (no CSS animations, limited font support)

---

## Common Pitfalls & Anti-Patterns

### ❌ Don't Do This

1. **Use floats for money**: `const total = 123.45` — use cents instead: `const totalCents = 12345`
2. **Forget Prisma regeneration**: After schema changes, always run `npx prisma generate` and bump `PRISMA_SCHEMA_VERSION`
3. **Use relative imports**: `import from '../../../lib'` — use path alias instead: `import from '@/lib'`
4. **Assume Next.js API from training data**: Next.js 16 has breaking changes — check docs when uncertain
5. **Hardcode timezone logic**: Use PostgreSQL's timezone functions; store times as UTC in DB
6. **Client-side authentication**: Never check auth only in component logic — always validate in API routes
7. **Untyped API responses**: Always define response types with zod or TypeScript types
8. **Miss session version bumps**: After Prisma regeneration, forgetting to update `PRISMA_SCHEMA_VERSION` causes stale client in dev mode

### ✅ Do This Instead

1. Work in cents everywhere: tests, calculations, DB storage
2. After schema changes: `npx prisma migrate dev && npx prisma generate` → bump `PRISMA_SCHEMA_VERSION`
3. Always use `@/` path alias for workspace imports
4. Check `node_modules/next/dist/docs/` when APIs feel off
5. Store all times as UTC; apply timezone in UI layer
6. Validate user & permissions in API route handlers
7. Validate & document all API responses with types
8. Make Prisma regeneration part of your schema change workflow

---

## Development Workflow

### Making Schema Changes

1. Modify `prisma/schema.prisma`
2. Run `npx prisma migrate dev` (creates migration, regenerates client)
3. Edit `src/lib/prisma.ts` → increment `PRISMA_SCHEMA_VERSION` by 1
4. Test with `npm run test` or manual verification
5. Commit both migration file and version bump

### Adding a New Feature

1. **Plan the data model** → Update `prisma/schema.prisma`
2. **Create migration** → `npx prisma migrate dev --name feature_name`
3. **Regenerate client** → `npx prisma generate` + bump version
4. **Add types** → `src/types/` or `src/lib/entity-types.ts`
5. **Implement API routes** → `src/app/api/[feature]/`
6. **Add UI components** → `src/components/[feature]/`
7. **Write tests** → unit tests in `src/lib/__tests__/`, integration tests in `src/__tests__/`
8. **Update session** → Run dev server or manual test to verify

### Debugging

- **Verify `.env.local`**: `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET` must be set
- **Check Prisma client version**: Is `src/lib/prisma.ts` `PRISMA_SCHEMA_VERSION` up to date?
- **Run migrations**: Ensure `npx prisma migrate deploy` has been run
- **Check logs**: `npm run test` output or browser console for React errors
- **Database issues**: Connect directly with `psql` or use Prisma Studio: `npx prisma studio`

---

## Project Structure Reference

```
src/
├── app/
│   ├── (auth)/              # Public routes (login)
│   ├── (app)/               # Authenticated app shell
│   │   ├── layout.tsx       # Auth check + session validation
│   │   ├── clients/
│   │   ├── matters/
│   │   ├── invoices/
│   │   ├── diary/
│   │   ├── reports/
│   │   ├── trust/           # Trust account management
│   │   ├── reconciliation/  # Bank reconciliation
│   │   ├── business/        # GL & P&L reports
│   │   ├── fica/            # FICA compliance
│   │   └── ...
│   └── api/                 # API routes
│       ├── clients/
│       ├── matters/
│       ├── invoices/
│       ├── trust-entries/
│       ├── bank-statements/
│       └── ...
├── components/
│   ├── ui/                  # shadcn/ui components
│   ├── clients/
│   ├── invoices/
│   ├── matters/
│   ├── time-recording/
│   ├── bookkeeping/
│   ├── reports/
│   └── ...
├── lib/
│   ├── auth.ts              # NextAuth configuration
│   ├── entity-types.ts      # Shared TS types
│   ├── invoice-pdf.tsx      # PDF generation
│   ├── prisma.ts            # Prisma client + version
│   ├── utils.ts             # Utility functions
│   ├── time-parser.ts       # Time entry parsing
│   ├── matter-code.ts       # Matter code generation
│   └── __tests__/           # Lib unit tests
├── types/
│   ├── next-auth.d.ts       # NextAuth type extensions
│   └── ...
├── __tests__/               # Integration & API tests
│   ├── setup.ts
│   ├── auth.test.ts
│   ├── clients.test.ts
│   ├── matters.test.ts
│   └── ...
├── generated/
│   └── prisma/              # Generated Prisma client
└── globals.css              # Global styles
```

---

## Key Phases of the Application

- **Phase 1** (`20260318192553_init`): Base schema
- **Phase 2** (`20260318194914_phase2_clients_matters`): Clients & matters
- **Phase 3** (`20260318212343_phase3_fee_entries`): Fee entries & time recording
- **Phase 4** (`20260318215552_phase4_invoicing`): Invoicing & billing
- **Phase 5** (`20260318230524_phase5_bookkeeping`): Trust/business GL & trust balance triggers
- **Phase 6** (`20260319001000_phase6_bank_recon`): Bank reconciliation
- **Recent**: Fee schedules, invoice/fee entry history, fee earner names

---

## Environment & Dependencies

### Required Environment Variables

```
DATABASE_URL=postgresql://user:password@localhost:5432/dcco_billing
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generate-with: openssl rand -base64 32>
```

### Key Dependencies

| Package | Purpose |
|---------|---------|
| `next` 16.2.0 | Framework (⚠️ breaking changes) |
| `react` 19.2.4 | UI library |
| `@prisma/client` 7.5.0 | ORM |
| `next-auth` 4.24.13 | Authentication |
| `react-hook-form` 7.71.2 | Form management |
| `zod` 4.3.6 | Schema validation |
| `@react-pdf/renderer` 4.3.2 | PDF generation |
| `lucide-react` 0.577.0 | Icons |
| `sonner` 2.0.7 | Toasts |
| `recharts` 3.8.0 | Data visualization |
| `tailwindcss` 4 | Styling |
| `next-themes` 0.4.6 | Light/dark mode |

---

## Quality & Testing

- Always write tests for new features
- Run `npm run test` before committing
- Run `npm run lint` to catch style issues
- Focus on API integration tests (more value than unit tests for routes)
- Use jsdom test environment for React component tests

---

## Links & Resources

- [CLAUDE.md](../CLAUDE.md) — Full project overview, commands, architecture
- [AGENTS.md](../AGENTS.md) — Next.js 16 breaking changes notice
- [Prisma Documentation](https://www.prisma.io/docs/) — Database ORM
- [Next.js 16 Docs](https://nextjs.org/docs) — ⚠️ Check for breaking changes
- [React 19 Docs](https://react.dev/) — UI framework
- [NextAuth.js Docs](https://next-auth.js.org/) — Authentication
- [Zod Docs](https://zod.dev/) — Schema validation

---

**Last Updated**: 28 March 2026

For questions or clarifications, refer to [CLAUDE.md](../CLAUDE.md) or check the specific feature's implementation in `src/`.
