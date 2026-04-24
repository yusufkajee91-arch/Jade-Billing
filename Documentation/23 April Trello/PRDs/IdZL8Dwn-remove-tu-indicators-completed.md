# PRD — Remove T / U / D entry-type indicators under the date column — Completed

**Trello card:** `69e5f4154cfc552492e8137e` (short: `IdZL8Dwn`) — [open in Trello](https://trello.com/c/IdZL8Dwn)
**List:** Triage (`69ccca10312e55a8159be989`)
**Status:** Completed
**Card title:** "Dont like or need these here - stands for 'time' / 'unitary'"
**Date:** 2026-04-23
**Completed:** 2026-04-23

---

## 1. Problem

In the matter's **All Unbilled** table, a small tinted letter previously rendered directly beneath each row's DATE value:

- `T` for time
- `U` for unitary
- `D` for disbursement

These indicators were redundant because the DURATION column already distinguishes the types: `"6 min"` for time, `"×18.000"` style quantities for unitary, and `"—"` for disbursement.

The Trello screenshot attachment `69e5f4164cfc552492e813a2` showed red arrows pointing at the unwanted `T` / `U` letters.

## 2. Scope Decision

The card title only named time and unitary, but the implementation also emitted `D` for disbursement. The completed change removes all three indicators consistently.

## 3. Completed Changes

- Removed the per-row entry-type letter render from the DATE cell in `src/components/matters/matter-detail.tsx`.
- Confirmed the DATE value itself remains unchanged:

```tsx
<span className="font-sans text-xs text-muted-foreground">
  {formatDate(entry.entryDate)}
</span>
```

- Confirmed the dead `entryTypeLabel` and `entryTypeColor` helpers are no longer present in source.
- Left DURATION formatting unchanged:
  - Time entries still render as `"6 min"` style durations.
  - Unitary entries still render as `"×N.NNN"`.
  - Disbursement entries still render as `"—"`.
- Cleaned up existing lint issues in `matter-detail.tsx` that blocked focused verification:
  - Removed unused `toggleBillable`.
  - Removed an unused `router` variable.
  - Adjusted the associated-matters initial load effect to satisfy the hook lint rule.

## 4. Acceptance Criteria

- [x] The inner `<div className="flex items-center gap-1 mt-0.5">` containing the `T` / `U` / `D` span has been removed.
- [x] The rest of the DATE cell is preserved.
- [x] `rg -n "entryTypeLabel|entryTypeColor" src/` returns no source matches.
- [x] DURATION column rendering remains unchanged.
- [x] The shared row renderer no longer shows the indicator across All Unbilled, Fees, or Disbursements.
- [x] Focused lint passes for `src/components/matters/matter-detail.tsx`.

## 5. Verification

Commands run:

```bash
rg -n "entryTypeLabel|entryTypeColor|title=\{entry\.entryType\}|\{entryTypeLabel\(entry\.entryType\)\}" src
npm run lint -- src/components/matters/matter-detail.tsx
```

Results:

- Indicator helper/source search: no source matches.
- Focused lint: passed.

## 6. Release Notes

Users viewing matter unbilled entries will no longer see the small `T`, `U`, or `D` letters underneath the DATE column. The table keeps the same date, fee earner, description, duration, amount, and action layout, with entry type still inferable from the DURATION column.

## 7. Traceability

- **Trello card:** `69e5f4154cfc552492e8137e` (short `IdZL8Dwn`)
- **Attachment:** `69e5f4164cfc552492e813a2` — annotated screenshot showing the unwanted indicators.
- **Relevant source file:** [src/components/matters/matter-detail.tsx](../../../src/components/matters/matter-detail.tsx)
- **Related PRDs:** standalone.
