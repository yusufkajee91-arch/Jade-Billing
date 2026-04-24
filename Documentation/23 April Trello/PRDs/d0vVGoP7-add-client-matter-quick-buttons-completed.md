# PRD - Completed - Quick-action buttons: Add client + Add matter

**Trello card:** `69df571c07a29f781c9812a1` (short: `d0vVGoP7`) - [open in Trello](https://trello.com/c/d0vVGoP7)
**List:** Triage (`69ccca10312e55a8159be989`)
**Status (implemented 2026-04-23):** Completed
**Card title:** "Add quick button for Add client & Add matter at the bottom"
**Date:** 2026-04-23

---

## 1. Problem

The app had one fixed-position floating action button (FAB): "Record Time". Opening a new client or a new matter required navigating to the relevant list page first, then using the page-local "New Client" or "New Matter" action. That broke flow when a user needed to create a record from elsewhere in the app.

During implementation review, the original PRD assumption that `/clients/new` and `/matters/new` already existed was found to be incorrect. Client and matter creation existed only as sheets inside the list pages.

## 2. Goals

- Expose **Add Client** and **Add Matter** as global quick actions alongside **Record Time**.
- Keep the visual language consistent with the existing rounded pill FAB.
- Provide URL-addressable create screens at `/clients/new` and `/matters/new`.
- Hide create actions for roles that cannot perform them.

## 3. Non-goals

- No inline quick-create popover.
- No change to the existing list-page create sheets.
- No keyboard shortcuts for client or matter creation in this pass.

## 4. User story

> As a fee earner mid-workflow, I want quick-action buttons to Add Client and Add Matter fixed at the bottom of the screen, so that I can onboard a walk-in client or open a new matter without navigating away from whatever I'm doing.

## 5. Acceptance criteria

- [x] `src/components/layout/fab.tsx` now exports `FabGroup` and preserves the `FAB` export for existing layout wiring.
- [x] Desktop quick actions render three stacked buttons at bottom-right: **Add Client**, **Add Matter**, **Record Time**.
- [x] Add Client navigates to `/clients/new`.
- [x] Add Matter navigates to `/matters/new`.
- [x] Record Time still opens the time-recording slide-over through `useTimeRecording().open()`.
- [x] On small viewports, actions collapse behind a single plus button and menu.
- [x] `admin` and `fee_earner` see all three actions.
- [x] `assistant` sees no create/time-recording quick actions.
- [x] `/clients/new` and `/matters/new` pages exist and reuse the existing `ClientForm` and `MatterForm`.
- [x] `POST /api/matters` blocks `assistant`, matching the UI gate and the existing `POST /api/clients` rule.

## 6. Design / Solution

Completed changes:

- Replaced the single FAB with a role-aware `FabGroup` in `src/components/layout/fab.tsx`.
- Added new route pages:
  - `src/app/(app)/clients/new/page.tsx`
  - `src/app/(app)/clients/new/new-client-page.tsx`
  - `src/app/(app)/matters/new/page.tsx`
  - `src/app/(app)/matters/new/new-matter-page.tsx`
- The route pages perform server-side role checks before rendering the client-side form wrappers.
- The client form route saves a client and returns to `/clients`.
- The matter form route saves a matter and navigates to the created matter detail page.
- `src/app/api/matters/route.ts` now rejects assistant matter creation with `403`.

## 7. Verification

Passed on 2026-04-23:

```bash
npm run lint -- src/components/layout/fab.tsx "src/app/(app)/clients/new/page.tsx" "src/app/(app)/clients/new/new-client-page.tsx" "src/app/(app)/matters/new/page.tsx" "src/app/(app)/matters/new/new-matter-page.tsx" src/app/api/matters/route.ts src/__tests__/matters.test.ts e2e/tests/36-quick-actions.spec.ts
npm run test:run -- src/__tests__/matters.test.ts
npx playwright test e2e/tests/36-quick-actions.spec.ts --project=chromium
```

Results:
- Targeted lint passed.
- Matter API unit tests: `10 passed`.
- Quick-action e2e: `7 passed`.
- Full `npx tsc --noEmit` remains blocked by existing Vitest mock typing errors in `src/__tests__/clients.test.ts`, `src/__tests__/matters.test.ts`, and `src/__tests__/search.test.ts`; no new page/component TypeScript errors remain.

## 8. Release notes

- Added global **Add Client** and **Add Matter** quick actions beside **Record Time**.
- Added `/clients/new` and `/matters/new` create screens using the existing production forms.
- Added mobile quick-action menu behavior.
- Aligned assistant role gating between the UI and `POST /api/matters`.
- Added Playwright regression coverage for quick-action navigation, creation, and role gating.

## 9. Dependencies & risks

- The role decision for this card is implemented as: `admin` and `fee_earner` can create clients/matters; `assistant` cannot.
- Broader assistant role policy still belongs in [kD5wROeu-role-decisions-and-sidebar.md](kD5wROeu-role-decisions-and-sidebar.md).
- The orphan screenshot migration remains a board-hygiene task in [D9eZSljA-imagepng-orphan-archive.md](D9eZSljA-imagepng-orphan-archive.md); it is not needed for the shipped behavior.

## 10. Open questions

- None for this implementation. Keyboard shortcuts for client/matter creation can be a separate enhancement if wanted.

## 11. Traceability

- **Trello card:** `69df571c07a29f781c9812a1` (short `d0vVGoP7`)
- **Attachments on card:** intended destination for `69df571ac99651d2fd561af1` (`image.png`, 226 KB) once migrated from `D9eZSljA`.
- **Relevant source files:**
  - [src/components/layout/fab.tsx](../../../src/components/layout/fab.tsx)
  - [src/app/(app)/clients/new/page.tsx](../../../src/app/(app)/clients/new/page.tsx)
  - [src/app/(app)/clients/new/new-client-page.tsx](../../../src/app/(app)/clients/new/new-client-page.tsx)
  - [src/app/(app)/matters/new/page.tsx](../../../src/app/(app)/matters/new/page.tsx)
  - [src/app/(app)/matters/new/new-matter-page.tsx](../../../src/app/(app)/matters/new/new-matter-page.tsx)
  - [src/app/api/matters/route.ts](../../../src/app/api/matters/route.ts)
  - [src/__tests__/matters.test.ts](../../../src/__tests__/matters.test.ts)
  - [e2e/tests/36-quick-actions.spec.ts](../../../e2e/tests/36-quick-actions.spec.ts)
- **Related PRDs:**
  - [D9eZSljA-imagepng-orphan-archive.md](D9eZSljA-imagepng-orphan-archive.md) - attachment source
  - [kD5wROeu-role-decisions-and-sidebar.md](kD5wROeu-role-decisions-and-sidebar.md) - broader role gating
