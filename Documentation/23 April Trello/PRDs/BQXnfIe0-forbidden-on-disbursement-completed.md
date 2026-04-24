# PRD - Completed - "Forbidden" banner when capturing a disbursement

**Trello card:** `69e5f375ad7ecfec721f5c69` (short: `BQXnfIe0`) - [open in Trello](https://trello.com/c/BQXnfIe0)
**List:** Triage (`69ccca10312e55a8159be989`)
**Status (implemented 2026-04-23):** Completed
**Card title:** "Forbidden when making something a disbursement"
**Date:** 2026-04-23

---

## 1. Problem

A fee earner opening the fee-entry slide-over to capture a disbursement saw a red **"Forbidden"** banner at the top of the form. The form still functioned visually, but at least one mount-time lookup request failed with a 403 and bubbled into the shared error banner.

Visual evidence (attachment `69e5f375ad7ecfec721f5c8e`, 299 KB PNG):
- Form filled: NARRATION = "Pritning Affidavit and Annexures (20 pages)", QUANTITY = 20, RATE = R 12.00, DISCOUNT = 0, Amount = R 240,00, POSTING CODE = `seed-pc-disburse`, Billable toggle ON.
- Top: light-pink banner with red icon and the single word "Forbidden", close button at top-right.

**Root cause analysis** (performed in the 2026-04-23 audit):

The fee-entry form mounted by fetching lookup data required to render the form. At audit time, three read endpoints used by that flow were still admin-only, which meant a `fee_earner` session could see 403 responses before saving the entry.

| Endpoint / lookup | Permission Audit ID | Completed state |
|---|---|---|
| Posting codes lookup | PA-001 | Session-readable for form usage via `/api/lookup?type=posting_codes` |
| Fee levels lookup | PA-002 | Session-readable for form usage via `/api/lookup?type=fee_levels` |
| Fee schedules + schedule items | PA-007 | Session-readable for form usage |

The fee-entry POST path was not the culprit. `fee_earner` is allowed to create disbursement entries; `assistant` remains blocked from fee-entry creation.

## 2. Goals

- No "Forbidden" banner when a `fee_earner` opens the fee-entry slide-over.
- A `fee_earner` can submit a disbursement successfully.
- A regression guard catches future 403 responses in this flow.

## 3. Non-goals

- No change to the fee-entry POST authorization model.
- No UI-level hiding of the banner while leaving the 403 in place.
- No broader role-matrix redesign; remaining role decisions stay in the Permission Audit / role-decision PRDs.

## 4. User story

> As a fee earner capturing a disbursement, I want the form to open and submit without any "Forbidden" banner, so that I can record disbursements without a confusing unexplained error.

## 5. Acceptance criteria

- [x] Open the fee-entry slide-over while logged in as the `fee_earner` fixture. No network response during form mount has `status === 403`.
- [x] Submit a disbursement entry as the `fee_earner` fixture. `POST /api/fee-entries` returns `201`.
- [x] Reload the matter and confirm the saved disbursement row appears in the matter fee-entry table.
- [x] Regression coverage added in `e2e/tests/35-fee-entry-form-mount-permissions.spec.ts`.

## 6. Design / Solution

Completed changes:

- The fee-entry form now reads posting codes and fee levels through the authenticated lookup endpoint used by the rest of the form.
- Fee-schedule reads required for the form are available to authenticated users.
- The regression test creates a fee-earner-owned client and matter, opens the matter form as `fee_earner`, selects `Disbursement`, saves a R240 entry, asserts the POST returns `201`, asserts no 403 responses occurred, and verifies the narration appears after reload.

## 7. Verification

Passed on 2026-04-23:

```bash
npx playwright test e2e/tests/35-fee-entry-form-mount-permissions.spec.ts --project=chromium
```

Result: `5 passed`.

## 8. Release notes

- Fixed the misleading "Forbidden" error shown when a fee earner captured a disbursement.
- Fee earners can now open the fee-entry form, load the required lookup data, and save a disbursement without 403 lookup failures.
- Added Playwright regression coverage for the fee-earner disbursement flow.

## 9. Dependencies & risks

- Dependency on the relevant Permission Audit items is satisfied for this flow.
- Residual risk is limited to role combinations not covered by this card. Assistant/admin breadth remains better handled in the broader permission/role PRDs.

## 10. Open questions

- None for this card.

## 11. Traceability

- **Trello card:** `69e5f375ad7ecfec721f5c69` (short `BQXnfIe0`)
- **Attachments on card:**
  - `69e5f375ad7ecfec721f5c8e` - `image.png` (299 KB) - bug screenshot showing the "Forbidden" banner + filled disbursement form. Cached at `.trello-audit-cache/69ccca063fec31d86ac34a38/69e5f375ad7ecfec721f5c69/`.
- **Relevant source files:**
  - [src/components/time-recording/fee-entry-form.tsx](../../../src/components/time-recording/fee-entry-form.tsx)
  - [src/app/api/lookup/route.ts](../../../src/app/api/lookup/route.ts)
  - [src/app/api/fee-schedules/route.ts](../../../src/app/api/fee-schedules/route.ts)
  - [src/app/api/fee-schedules/[id]/items/route.ts](../../../src/app/api/fee-schedules/[id]/items/route.ts)
  - [src/app/api/fee-entries/route.ts](../../../src/app/api/fee-entries/route.ts)
  - [e2e/tests/35-fee-entry-form-mount-permissions.spec.ts](../../../e2e/tests/35-fee-entry-form-mount-permissions.spec.ts)
- **Related PRDs:**
  - [C9idroZH-permission-audit.md](C9idroZH-permission-audit.md) - upstream permission audit
