# PRD — Reconcile historical trust + business transfers so clients can have statements

**Trello card:** `69df590a3c73644db61036f2` (short: `ShXkgfbm`) — [open in Trello](https://trello.com/c/ShXkgfbm)
**List:** Triage (`69ccca10312e55a8159be989`)
**Status (audit 2026-04-23):** Open
**Card title:** "Reconcile all the Trust and Business transfers so clients can have statements"
**Date:** 2026-04-23

---

## 1. Problem

Client statements rely on matched inter-account transfer pairs: every trust-to-business transfer is two entries linked via `linked_entry_id` (out on trust, in on business — or vice versa). If a historical transfer is present on one side but not matched to its counterpart on the other, the client statement balance is wrong or the PDF fails to generate.

Recent LP-parity imports (phases 1–4, committed 2026-04-20 and earlier) brought historical data in. Per `docs/dataflow.md`, "Trust entries: linked entry pairs for transfers (via linkedEntryId)" is the mechanism. **Open question: what fraction of imported inter-account transfers are currently unlinked?**

The card has no description — no client IDs, no error trace, no example statement. Almost certainly: at least one specific client's statement was wrong or missing when the card was authored. That's the thread to pull.

## 2. Goals

- Produce a **diagnostic list** of all trust/business entries where the counterpart in the other ledger should exist but `linked_entry_id` is null.
- Link each matched pair, either automatically (when amount + date + narration make it unambiguous) or via a documented manual review.
- Verify the resulting statement PDF generates correctly for at least two sample clients.
- Extend the e2e suite to guard against regressions.

## 3. Non-goals

- No change to the live `linked_entry_id` schema or the write path — the infra is there; this is a data-correctness pass.
- No automatic **creation** of new trust/business entries from bank statement imports — that belongs to the reconciliation feature, not this card.
- No schema changes.

## 4. User story

> As a firm admin, I want every historical trust-to-business transfer to be reconciled as a linked pair, so that I can generate an accurate statement PDF for any client on demand — and so that the Bookkeeping views show the correct WIP.

## 5. Acceptance criteria

- [ ] Card description is updated to name the specific client(s) or matter(s) whose statements are currently wrong — the concrete set of affected records drives scope.
- [ ] A one-shot diagnostic script at `scripts/diagnose-unlinked-transfers.mjs` produces a CSV or JSON list of `trust_entries` and `business_entries` that:
  - Have `entry_type` in `('trust_transfer_in','trust_transfer_out','business_transfer_in','business_transfer_out')`.
  - Have `linked_entry_id IS NULL`.
  - Output columns: matter_id, matter_code, entry_date, amount_cents, entry_type, narration, likely_counterpart_id_or_nulls.
- [ ] For every row returned, one of two paths closes it:
  - **Auto-link:** a second pass matches on (matter_id, abs(amount_cents), abs(date_diff) <= 3 days, narration fuzzy-match) and updates `linked_entry_id` atomically on both sides. Ships as a one-shot migration script, not a trigger.
  - **Manual review:** unresolved cases dumped to `Documentation/reconciliation-audit-2026-04-XX.md`, reviewed with the firm, linked via a second migration.
- [ ] `src/lib/statement-pdf.tsx` generates a correct statement for at least **two** sample clients whose statements were previously wrong — opening balance, each line, closing balance match a manually-prepared Excel reconciliation.
- [ ] `e2e/tests/21-reconciliation.spec.ts` (or a new file) takes a fixture client with known opening/closing balances and asserts the generated statement matches.
- [ ] The card moves to `Done` only after the sample-client reconciliation is signed off by the firm admin.

## 6. Design / Solution

### 6a. Diagnostic script

```js
// scripts/diagnose-unlinked-transfers.mjs
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const unlinkedTrust = await prisma.$queryRaw`
  SELECT id, matter_id, entry_type, entry_date, amount_cents, narration
  FROM trust_entries
  WHERE entry_type IN ('trust_transfer_in','trust_transfer_out')
    AND linked_entry_id IS NULL
  ORDER BY matter_id, entry_date;
`
// same for business_entries, then join/pair on (matter_id, abs(amount_cents), date proximity)
// emit CSV or JSON
```

Run read-only first, confirm counts, then author the migration that writes `linked_entry_id`.

### 6b. Auto-link migration

Wrap in a `prisma.$transaction()` so paired updates are atomic. Do not disable the GL-journal triggers (per `docs/dataflow.md`: leave GL-journal triggers ON during historical imports; only `trg_check_trust_balance` is the one ever disabled, and we're not inserting, only updating FKs).

### 6c. Statement verification

Pick two sample clients with uncomplicated histories. Generate statement PDF via `src/lib/statement-pdf.tsx`. Compare against manual Excel. Fix any residual discrepancies by manual linking or description edits.

### 6d. Test

```ts
// e2e/tests/22-statement-balance.spec.ts
test('statement for client X matches known-good balances', async ({ request }) => {
  const res = await request.get(`${BASE}/api/clients/<id>/statement/pdf`)
  // extract text, assert opening and closing balance strings
})
```

## 7. Dependencies & risks

- **Blocked on:** the card author naming the specific affected clients. Scoping the fix without that list risks over-engineering.
- Low schema risk — no migrations to columns; only updates to `linked_entry_id` values.
- Risk: the auto-link heuristic (date-proximity fuzzy match) could link the wrong pair when a client has multiple same-amount transfers close together. Dry-run the output before running the write migration.

## 8. Open questions

- Which clients' statements are wrong? (blocks all other work)
- Is there a desired date cutoff for this reconciliation (e.g. only reconcile FY2026), or should every historical row be paired?
- For GL journals: will re-linking trigger a journal rewrite, or are we only updating the pair link (no financial effect)? Confirm against the trigger logic in `docs/dataflow.md`.

## 9. Traceability

- **Trello card:** `69df590a3c73644db61036f2` (short `ShXkgfbm`)
- **Attachments on card:** none
- **Relevant source files:**
  - [src/lib/statement-pdf.tsx](../../../src/lib/statement-pdf.tsx)
  - [src/app/api/clients/[id]/statement/pdf/route.ts](../../../src/app/api/clients/[id]/statement/pdf/route.ts)
  - [prisma/schema.prisma](../../../prisma/schema.prisma) — `TrustEntry`, `BusinessEntry`, `linkedEntryId`
  - [e2e/tests/21-reconciliation.spec.ts](../../../e2e/tests/21-reconciliation.spec.ts)
  - [docs/dataflow.md](../../../docs/dataflow.md) — "DB triggers" section
  - [scripts/](../../../scripts/) — LP-parity import scripts pattern
- **Related PRDs:** standalone.
