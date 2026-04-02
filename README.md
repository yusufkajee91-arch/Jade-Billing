# Dolata & Co — Legal Billing System

## Prerequisites

- Node.js 20+
- PostgreSQL 15+

## Setup

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd dcco-billing
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in the values:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_URL` | Base URL of the app (e.g. `http://localhost:3000`) |
| `NEXTAUTH_SECRET` | Random secret — generate with `openssl rand -base64 32` |

### 3. Run database migrations

```bash
npx prisma migrate deploy
```

### 4. Seed the database

```bash
npx tsx prisma/seed.ts
```

### 5. Start the development server

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Default login

| Field | Value |
|---|---|
| Email | `admin@dcco.law` |
| Password | `Admin1234!` |

**Change the password immediately after first login.**

## Tech stack

Next.js · TypeScript · Tailwind CSS · shadcn/ui · PostgreSQL · Prisma · NextAuth.js

## Development commands

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run test:run` | Run tests |
| `npm run test:e2e` | Run Playwright E2E against the local disposable test DB |
| `npm run test:e2e:supabase` | Run Playwright E2E against a cloned Supabase DB configured in `.env.e2e.supabase` |

## Supabase Staging E2E

For a Supabase-backed E2E run, create a separate cloned/staging Supabase database first. Do not point the suite at your live production database.

1. Copy the example env file:

```bash
cp .env.e2e.supabase.example .env.e2e.supabase
```

2. Fill in the cloned Supabase connection string.

3. Run:

```bash
npm run test:e2e:supabase
```

The Supabase mode is destructive for the target staging database:
- it resets the `public` schema before each run
- it reruns migrations and seed data
- it should only be used against a disposable cloned/staging Supabase database
