# PRD — Completed — Fees graph: Recorded ↔ Billed toggle

**Trello card:** `69de194aa7f074715b308dda` (short: `3rVH53Mv`) — [open in Trello](https://trello.com/c/3rVH53Mv)
**List:** Triage (`69ccca10312e55a8159be989`)
**Status (implemented 2026-04-23):** Completed
**Card title:** "Add toggle on Fee graph to show Fees inputted & Fees Billed"
**Date:** 2026-04-23

---

## 1. Problem

The dashboard "Fees Recorded" cumulative chart shows only one series — fees **captured / inputted**. It does not show fees **billed** (i.e. already on an issued invoice). That's a visibility gap: users cannot tell at a glance how much of captured work is still WIP versus already invoiced.

Visual evidence (attachment `69de1951965882bf3915580e`, 405 KB, PNG): the current chart titled "April — Cumulative" has a small pill header labelled "FEES RECORDED" in the top-left corner. A red arrow drawn on the screenshot points at this pill — the author is explicitly calling out where the toggle should go. Jessica's comment (`69de19728c4bd420cd2848fd`) says: "Want to add a toggle so we can see what fees we have inputted for the month vs. what fees have actually been billed so we can see accurate graphs on billed work".

Audit-time code evidence (before implementation):
- `src/components/dashboard/fees-chart.tsx:175` renders the static string "Fees Recorded" as the heading.
- `src/components/dashboard/fees-chart.tsx:178` renders "<Month> — Cumulative" — matches the screenshot.
- At audit time, `rg "Fees Billed" src/` returned 0 hits. The billed series did not exist anywhere.
- `src/components/dashboard/all-earners-chart.tsx` has a parallel "Cumulative by Earner" chart with the same structure and the same gap.

## 2. Goals

- Replace the static "Fees Recorded" pill with a toggle control between **Fees Recorded** and **Fees Billed**.
- Provide the billed cumulative data via the existing dashboard endpoint (new query param or parallel series).
- Same treatment for the per-earner chart so the dashboard remains consistent.

## 3. Non-goals

- No new chart type (still a cumulative line chart).
- No change to the X-axis (day 1 … last day of month) or to the Target dashed line.
- No per-matter or per-client breakdown — that's a different widget.

## 4. User story

> As a firm user viewing the dashboard, I want to toggle the cumulative fees chart between Fees Recorded and Fees Billed, so that I can see at a glance how much of the month's captured work has actually been invoiced vs still WIP.

## 5. Acceptance criteria

- [x] `src/components/dashboard/fees-chart.tsx:175` replaces the static pill with a 2-state toggle (Recorded / Billed). Default: Recorded (backwards-compatible behaviour).
- [x] The server endpoint backing the chart accepts `?series=recorded|billed` (or returns both series in one payload; implementer's choice) and returns cumulative cents per day for the chosen series.
- [x] Billed cumulative is computed from `(Invoice.sentAt ?? Invoice.invoiceDate)` + `InvoiceLineItem.totalCents` for invoices where `invoiceType = 'invoice'`, `status in ['sent_invoice', 'paid']`, and line-item `entryType in ['time', 'unitary']`. Treat `sentAt` as the preferred bucketing date, falling back to `invoiceDate` for legacy/imported invoices where `sentAt` is null. Exclude drafts, pro-formas, credit notes, and disbursements.
- [x] Switching the toggle re-plots without a full page reload — either re-fetch on toggle change or pre-fetch both on mount and swap client-side.
- [x] The toggle UI matches the attachment `69de1951965882bf3915580e-image.png` styling: same small-caps pill look as the current "FEES RECORDED" badge, same position, same typography stack. The "<Month> — Cumulative" heading stays as-is.
- [x] Legend still shows `<current month>`, `<previous month>`, Target — unchanged.
- [x] Parallel treatment for `src/components/dashboard/all-earners-chart.tsx:130` and its endpoint, so admins can toggle the per-earner cumulative chart between Recorded and Billed.
- [x] Manual regression: open dashboard, flip toggle, confirm Y-axis adapts (billed cumulative will typically be lower than recorded cumulative for the same month).
- [x] Unit test for the billed cumulative aggregator (new function in `src/lib/` or within the API route) asserting correct bucketing for a fixture invoice set.

## 6. Design / Solution

### 6a. UI — toggle

Replace the static pill at `fees-chart.tsx:175`. shadcn has no "segmented toggle" out of the box; use a light-weight two-button implementation or reuse `ToggleGroup` from Radix primitives. Example:

```tsx
const [series, setSeries] = useState<'recorded'|'billed'>('recorded')

<div className="inline-flex rounded-full border text-[11px] tracking-widest uppercase">
  <button onClick={() => setSeries('recorded')} aria-pressed={series==='recorded'}>Fees Recorded</button>
  <button onClick={() => setSeries('billed')}   aria-pressed={series==='billed'}>Fees Billed</button>
</div>
```

### 6b. Data — server

Two viable shapes; pick one:

**Option A — single payload.** Backing endpoint returns `{ days, recorded: [...], billed: [...] }`. Simpler client, one fetch.

**Option B — query param.** `?series=recorded|billed`. Smaller payload but two round trips if both are viewed.

Recommend **Option A** — the payload is small (~31 ints per series) and the UX wins are meaningful.

### 6c. Billed aggregation

Pseudocode, run server-side:

```ts
const issued = await prisma.invoice.findMany({
  where: {
    invoiceType: 'invoice',
    status: { in: ['sent_invoice', 'paid'] },
    OR: [
      { sentAt: { gte: monthStart, lt: monthEnd } },
      { sentAt: null, invoiceDate: { gte: monthStart, lt: monthEnd } },
    ],
  },
  include: { lineItems: true },
})
// Filter lineItems to time/unitary, bucket totalCents by day(sentAt ?? invoiceDate), then cumulative-sum.
```

Confirm against the existing "recorded" path for consistency — same day buckets, same currency unit (cents).
Use `InvoiceLineItem.totalCents`, not `amountCents`, so discounts are respected and the billed series is comparable to the recorded series.

## 7. Dependencies & risks

- Moderate-low risk: isolated to dashboard widgets + their two API paths.
- Watch for multi-tenant filtering if the dashboard scopes by firm/user — apply the same scope to the billed branch.
- Definition is pinned: "billed" means tax invoices that have actually been sent or paid (`status in ['sent_invoice', 'paid']`), bucketed by `sentAt ?? invoiceDate`.

## 8. Open questions

- None currently. Product decision recorded here: Fees Billed excludes pro-formas, credit notes, drafts, and disbursements; uses `sentAt ?? invoiceDate` as the billed date; and includes the per-earner chart in this PR.

## 9. Release Notes

- Added a **Fees Recorded / Fees Billed** toggle to the dashboard cumulative fees chart.
- Added the same Recorded / Billed toggle to the admin per-earner cumulative chart.
- Dashboard API responses now include both recorded and billed series in one payload so the UI can switch without a page reload.
- Billed totals include only actual invoices with `status in ['sent_invoice', 'paid']`, exclude pro-formas, drafts, credit notes, and disbursements, and use discounted line totals via `InvoiceLineItem.totalCents`.
- Billed chart dates use `Invoice.sentAt` when available, falling back to `Invoice.invoiceDate` for imported or legacy invoices where `sentAt` is null.
- Added unit coverage for billed bucketing, fee-line filtering, scoped fee-entry filtering, per-earner attribution, and cumulative series generation.

Verification:
- `npm run test:run -- src/lib/__tests__/dashboard-fees.test.ts` passed.
- Targeted ESLint passed for the changed dashboard/API/helper/test files.
- `npx tsc --noEmit` remains blocked by unrelated pre-existing mock typing errors in `src/__tests__/clients.test.ts`, `src/__tests__/matters.test.ts`, and `src/__tests__/search.test.ts`.

Known limitation:
- Imported invoice lines without `feeEntryId` can appear in the main chart's **All Earners** billed total, but cannot be attributed to **My Fees** or the per-earner chart until the import/base process captures fee-earner attribution.

## 10. Traceability

- **Trello card:** `69de194aa7f074715b308dda` (short `3rVH53Mv`)
- **Attachments on card:**
  - `69de1951965882bf3915580e` — `image.png` (405 KB) — annotated current-state screenshot. Cached at `.trello-audit-cache/69ccca063fec31d86ac34a38/69de194aa7f074715b308dda/`.
- **Comments on card:**
  - `69de19728c4bd420cd2848fd` — Jessica-Jayde Dolata (2026-04-14): rationale quoted above.
- **Relevant source files:**
  - [src/components/dashboard/fees-chart.tsx](../../../src/components/dashboard/fees-chart.tsx)
  - [src/components/dashboard/all-earners-chart.tsx](../../../src/components/dashboard/all-earners-chart.tsx)
  - [src/components/dashboard/dashboard-shell.tsx](../../../src/components/dashboard/dashboard-shell.tsx)
  - `src/app/api/dashboard/...` — backing endpoint (locate + update)
  - [prisma/schema.prisma](../../../prisma/schema.prisma) — `Invoice`, `InvoiceLineItem` models
- **Related PRDs:**
  - [alDSFwxA-fee-allocation-graph.md](alDSFwxA-fee-allocation-graph.md) — may collapse into this one after clarification
