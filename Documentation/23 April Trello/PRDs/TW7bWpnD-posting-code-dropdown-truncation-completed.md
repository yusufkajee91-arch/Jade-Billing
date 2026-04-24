# PRD — Posting-code dropdown: fix description truncation

**Trello card:** `69e5f474f32b90533f9d56f9` (short: `TW7bWpnD`) — [open in Trello](https://trello.com/c/TW7bWpnD)
**List:** Triage (`69ccca10312e55a8159be989`)
**Status:** Completed
**Card title:** "Cant read what these posting codes say"
**Completed date:** 2026-04-23

---

## 1. Problem

The posting-code dropdown in the fee-entry form was too narrow, so longer descriptions were clipped on the right edge and could not be read reliably.

## 2. Shipped result

- The posting-code dropdown now widens up to the viewport width available in the slide-over.
- Dropdown rows now allow the description text to wrap instead of forcing a single line.
- The short code remains visually distinct from the description.
- The selected trigger value now shows the human-readable posting code instead of the internal posting-code ID.

## 3. Implementation

Implemented in:

- [src/components/time-recording/fee-entry-form.tsx](../../../src/components/time-recording/fee-entry-form.tsx)
- [src/components/ui/select.tsx](../../../src/components/ui/select.tsx)
- [e2e/tests/35-fee-entry-form-mount-permissions.spec.ts](../../../e2e/tests/35-fee-entry-form-mount-permissions.spec.ts)

Shipped behavior:

- `SelectContent` uses `w-[min(24rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)]`
- Each posting-code row uses `textClassName="shrink whitespace-normal"`
- The selected trigger renders the selected posting-code `code` instead of the raw `postingCodeId`

## 4. Acceptance criteria

- [x] Posting-code descriptions are readable in the dropdown without mid-word clipping.
- [x] Re-opening the dropdown after selection still shows full descriptions.
- [x] The dropdown remains usable at `320px` viewport width with no horizontal overflow inside the popover.
- [x] The visual separation between code and description is preserved.
- [x] The selected trigger no longer shows the internal ID.

## 5. Verification

- `npm run lint -- src/components/time-recording/fee-entry-form.tsx src/components/ui/select.tsx e2e/tests/35-fee-entry-form-mount-permissions.spec.ts`
  - Passed with one existing React Compiler warning on `watch()` in `fee-entry-form.tsx`
- `npx playwright test e2e/tests/35-fee-entry-form-mount-permissions.spec.ts --project=chromium -g "posting code dropdown"`
  - Passed: `5 passed`

## 6. Notes

- The original PRD referenced some posting-code labels that do not match the current seed data. Current seeded examples include `EMAIL Email to client`, `CONSULT Consultation`, `REVIEW Review and advice`, and `DISBURSE Disbursement`.
- I did not find `Z010` / `Z020` / `Z030` / `Z040` in the current seed set, so completion was verified against the actual current posting-code data path rather than those earlier examples.

## 7. Release notes

- Fixed truncation in the posting-code dropdown on the fee-entry form.
- Improved mobile handling so long posting-code descriptions remain readable at narrow widths.
- Corrected the selected posting-code display so the control shows the user-facing code rather than the internal database ID.

## 8. Traceability

- **Trello card:** `69e5f474f32b90533f9d56f9` (short `TW7bWpnD`)
- **Attachment:** `69e5f474f32b90533f9d571d` — bug screenshot
- **Relevant source files:**
  - [src/components/time-recording/fee-entry-form.tsx](../../../src/components/time-recording/fee-entry-form.tsx)
  - [src/components/ui/select.tsx](../../../src/components/ui/select.tsx)
  - [e2e/tests/35-fee-entry-form-mount-permissions.spec.ts](../../../e2e/tests/35-fee-entry-form-mount-permissions.spec.ts)
  - [prisma/seed.ts](../../../prisma/seed.ts)
