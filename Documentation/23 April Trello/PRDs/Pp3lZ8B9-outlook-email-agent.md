# PRD — Outlook email agent: auto-attach emails to matters

**Trello card:** `69de19a4fa17c9409d5ecebf` (short: `Pp3lZ8B9`) — [open in Trello](https://trello.com/c/Pp3lZ8B9)
**List:** Triage (`69ccca10312e55a8159be989`)
**Status (audit 2026-04-23):** Open (large greenfield)
**Card title:** "Add Agent to connect to outlook to add all emails to matters by way of surname / ref nr etc"
**Date:** 2026-04-23

---

## 1. Problem

Fee earners manually forward or drop emails onto matters today. That's time-consuming, easily skipped, and produces gaps in the evidence trail for each matter. The request: a background agent reads each fee earner's Outlook inbox and **auto-attaches matter-relevant emails to the correct matter** based on surname / matter ref number / matter code matching.

Today:
- `rg -rn "outlook|Outlook|msgraph|microsoft/graph" src/` → 0 hits.
- No OAuth flow, no scheduled job runner, no encrypted token storage pattern.
- The matter-attachments table + API does exist (`src/app/api/matters/[id]/attachments/route.ts`) — the sink is ready, the source isn't.

## 2. Goals

- Fee earners grant Casey OAuth access to their Outlook.
- A scheduled worker polls Microsoft Graph for new messages per connected user.
- The agent matches each message against the matter corpus via a documented rule set and attaches successful matches to `matters.attachments`, with a link back to the Outlook message ID for idempotency.
- Fee earners can see per-user sync status + last-run timestamp.
- Privacy-by-design: opt-in, POPIA-aware, with documented retention.

## 3. Non-goals

- No outbound email — Casey does not send email on the user's behalf via Graph.
- No mailbox-wide scan — only new messages since the user connected.
- No non-Outlook sources (Word time, Adobe PDF opens) — those live under the integrations umbrella PRD ([P9I9l8GL](P9I9l8GL-caisey-integrations-umbrella.md)).
- No automatic **creation** of matters from unmatched emails; unmatched messages simply are not attached.

## 4. User story

> As a fee earner, I want Casey to periodically read my Outlook inbox and attach each matter-relevant email to the correct matter — matched by client surname, matter ref number, or matter code — so that every matter's evidence trail is complete without me forwarding or uploading anything by hand.

## 5. Acceptance criteria

- [ ] Fee earner can grant OAuth access to Outlook via a new page `src/app/(app)/settings/integrations/page.tsx`. Tokens are stored encrypted at rest in a new `user_integrations` table.
- [ ] Scheduled worker (external cron invoking a Next.js API route, or a separate `scripts/` runner) fetches new messages via Microsoft Graph `/me/messages` since a per-user `watermark` timestamp.
- [ ] Matching rule set (implemented in `src/lib/matter-matcher.ts`):
  1. If subject contains a string matching `MATTER_REF_REGEX` (to be defined) → attach to that matter.
  2. Else if a unique matter-code substring is in the subject → attach to that matter.
  3. Else if the email's from/to participants include `<Surname>` of exactly one active client with a single open matter → attach to that matter.
  4. Otherwise: no match, no attach (recorded in a debug log; not surfaced in UI unless opted in).
- [ ] Each attached email inserts one row in `matter_email_attachments` (new table) and one in the existing `matter_attachments` table with `source = 'outlook'` and `externalMessageId = <graphMessageId>`. Re-running the job does **not** duplicate.
- [ ] Settings → Integrations page shows, per connected user: last sync timestamp, count of emails attached in the last 24h, and a "Sync now" button (rate-limited).
- [ ] POPIA doc at `Documentation/integrations/outlook-agent-popia.md` covers: purpose, lawful basis, data retention (emails stored as attachments indefinitely? or with a TTL? decide), third-party data considerations, opt-out flow.
- [ ] New tests:
  - Unit tests for `src/lib/matter-matcher.ts` covering every matching rule + edge cases (two matters with the same surname; ambiguous ref number).
  - e2e stub test that mocks Microsoft Graph and asserts the worker writes the expected rows.
- [ ] Fee earners can revoke access in the Integrations page; revocation deletes the access + refresh tokens from `user_integrations` and stops further polling.

## 6. Design / Solution

### 6a. Schema

```prisma
model UserIntegration {
  id           String   @id @default(cuid())
  userId       String
  provider     String   // 'outlook' for now
  accessToken  String   // encrypted
  refreshToken String   // encrypted
  expiresAt    DateTime
  status       String   // 'active' | 'revoked' | 'error'
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@unique([userId, provider])
  @@map("user_integrations")
}

model EmailSyncState {
  userId    String   @id
  watermark DateTime // last Graph `receivedDateTime` processed
  updatedAt DateTime @updatedAt
  @@map("email_sync_states")
}

model MatterEmailAttachment {
  id                 String   @id @default(cuid())
  matterId           String
  attachmentId       String   // FK to MatterAttachment
  externalMessageId  String   // Graph message id
  createdAt          DateTime @default(now())
  @@unique([externalMessageId])
  @@map("matter_email_attachments")
}
```

Bump `PRISMA_SCHEMA_VERSION` after migration.

### 6b. Auth flow

`src/app/api/integrations/outlook/start/route.ts` → redirects to Microsoft OAuth consent URL with scope `Mail.Read offline_access`.
`src/app/api/integrations/outlook/callback/route.ts` → exchanges code for tokens, encrypts, persists, redirects to Settings.

### 6c. Worker

Not an in-process job (Next.js serverless isn't suited). Options:
- **A**: External cron (e.g. Supabase scheduled function, Vercel cron, or a small Fly.io worker) hitting `POST /api/integrations/outlook/sync` with a shared secret.
- **B**: `scripts/sync-outlook.mjs` invoked from a host cron.

Either way, the job iterates active integrations, refreshes tokens as needed, pulls `/me/messages?$filter=receivedDateTime gt <watermark>`, runs matcher, inserts matches, advances watermark.

### 6d. Matcher

```ts
// src/lib/matter-matcher.ts
export function matchMessageToMatter(message: GraphMessage, corpus: MatterCorpus): MatchResult { ... }
```

`MatterCorpus` is a pre-loaded map (`matterCode -> matterId`, `surname -> matterIds[]`, `refRegex`). Rebuild on each run or cache with TTL.

### 6e. Privacy guard

Never read messages where the logged-in fee earner is neither sender nor a recipient. Graph API exposes this — filter server-side before ingestion.

## 7. Dependencies & risks

- **Blocked on:** the umbrella integrations strategy doc ([P9I9l8GL](P9I9l8GL-caisey-integrations-umbrella.md)) + a privacy review per POPIA.
- **Cost / licensing:** Microsoft Graph API requires Microsoft 365 + appropriate app registration. Confirm procurement before build.
- **Token security:** encrypted-column pattern does not exist in this codebase. Decide on envelope encryption approach (e.g. `libsodium` + KMS-held key) before storing tokens.
- **False-positive matches:** the matcher will attach wrong emails to wrong matters unless rules are tight. Consider a "quarantine" status for low-confidence matches that requires fee earner confirmation.
- **Runtime:** the polling job is per-user; at scale, batch via Graph `delta` queries to reduce API calls.

## 8. Open questions

- Retention policy on stored email bodies? (POPIA-driven)
- Does the firm want a "preview + confirm" step, or auto-attach on every match?
- Should the fee earner be notified (toast / email) when emails are auto-attached?

## 9. Traceability

- **Trello card:** `69de19a4fa17c9409d5ecebf` (short `Pp3lZ8B9`)
- **Attachments on card:** none
- **Relevant source files:**
  - [src/app/api/matters/[id]/attachments/route.ts](../../../src/app/api/matters/[id]/attachments/route.ts) — existing sink
  - [prisma/schema.prisma](../../../prisma/schema.prisma)
  - [src/lib/auth.ts](../../../src/lib/auth.ts)
- **Related PRDs:**
  - [P9I9l8GL-caisey-integrations-umbrella.md](P9I9l8GL-caisey-integrations-umbrella.md) — parent strategy
