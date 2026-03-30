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
