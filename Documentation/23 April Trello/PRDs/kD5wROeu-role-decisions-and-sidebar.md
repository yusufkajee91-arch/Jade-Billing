# PRD — Role decisions + role-aware sidebar

**Trello card:** `69ce3b5859018d32900410ee` (short: `kD5wROeu`) — [open in Trello](https://trello.com/c/kD5wROeu)
**List:** Triage (`69ccca10312e55a8159be989`)
**Status (audit 2026-04-23):** Partial
**Card title:** "Fix bug when inputting fees"
**Date:** 2026-04-23

---

## 1. Problem

The card's title is misleading: the description is actually **six product questions for the business owners** about who-can-do-what, not a single bug. The "Record Time" crash that prompted the card is already mitigated by Yusuf's interim patch (see comments `69cfbb3a…` and `69cfbbdb…`, both 2026-04-03) that opens `POST /api/fee-entries` to fee_earner + admin but still blocks `assistant`.

What remains unfixed is the **decision-making**. The six open questions:

1. Which roles can record time? (interim: fee_earner + admin; assistant blocked)
2. Do fee earners see Collections? Today the page exists but has no explicit role gate.
3. Do fee earners see Reconciliation?
4. Is Settings hidden from non-admins, or read-only? Today: flash-then-redirect pattern via `if (role !== 'admin') router.push('/dashboard')`.
5. **Does the sidebar adapt to role?** Today it does not. `src/components/layout/sidebar.tsx` has no `role` reference.
6. Do assistants act on behalf of fee earners (time, diary, invoices)?

Symptom: non-admins currently see sidebar links to pages they cannot use, some of which briefly render before redirecting. That's a visible UX gap regardless of the underlying role decisions.

## 2. Goals

- Capture a **single product decision doc** answering all six questions with named stakeholder + date.
- Make the **sidebar role-aware** so non-admins stop seeing dead-end links.
- Reconcile the interim fee-entries / invoices role patches with the product decision — tighten or open as appropriate.
- Close this card once the decision doc exists and the sidebar filter ships.

## 3. Non-goals

- No redesign of the permission model (admin / fee_earner / assistant enum stays).
- No server-side role gate changes for pages that already use `router.push('/dashboard')` — defence-in-depth stays; this PRD only hides links.
- No automatic creation of follow-up cards — any decision-driven code changes are scoped within the existing Permission Audit PRD (`C9idroZH`).

## 4. User story

> As a non-admin user (fee earner or assistant), I want the Casey sidebar to show only the pages I can use, so that I don't waste time clicking links that either flash past or render empty.

## 5. Acceptance criteria

- [ ] `Documentation/permissions-decisions.md` exists and contains a row for each of the six questions with: decision, owner, date, follow-up action (if any).
- [ ] `src/components/layout/sidebar.tsx` accepts the session role and filters the nav item list based on a single `NAV_ITEMS` array that tags each item with its allowed roles.
- [ ] fee_earner session does not see sidebar links to `/settings/*`, `/reconciliation`, `/debtors` (unless the decisions doc says otherwise).
- [ ] assistant session sees a strict subset — confirmed against the decisions doc.
- [ ] admin session sees every item (unchanged behaviour).
- [ ] New e2e test in `e2e/tests/` that, for each of the three auth fixtures, asserts the sidebar's rendered link set matches the expected list per role.
- [ ] If the decisions doc overturns the interim fee-entries patch, `src/app/api/fee-entries/route.ts:109-111` is updated and a one-line note references the decision.
- [ ] Card `kD5wROeu` moves to `Done` (`69ccca34b90b2ffc09bbdf78`) with its description linking to the decisions doc.

## 6. Design / Solution

### 6a. Decisions doc

`Documentation/permissions-decisions.md`. Suggested skeleton:

```markdown
| Question | Decision | Owner | Date | Follow-up |
|---|---|---|---|---|
| Q1 — who records time? | fee_earner + admin; assistant NO | <name> | YYYY-MM-DD | — |
| Q2 — Collections visibility | … | | | |
| Q3 — Reconciliation access | … | | | |
| Q4 — Settings visibility | hidden from non-admins (sidebar) + defence-in-depth redirect | | | — |
| Q5 — Sidebar adapts | Yes — this PRD | | | this PRD |
| Q6 — Assistants acting for fee earners | … | | | |
```

### 6b. Sidebar refactor

Today's sidebar renders a hardcoded list. Refactor to:

```tsx
// src/components/layout/sidebar.tsx
type Role = 'admin' | 'fee_earner' | 'assistant'
const NAV: { href: string; label: string; roles: Role[] }[] = [
  { href: '/dashboard',       label: 'Dashboard',       roles: ['admin','fee_earner','assistant'] },
  { href: '/matters',         label: 'Matters',         roles: ['admin','fee_earner','assistant'] },
  { href: '/timesheet',       label: 'Timesheet',       roles: ['admin','fee_earner'] },
  { href: '/invoices',        label: 'Invoices',        roles: ['admin','fee_earner'] },
  // ...
  { href: '/debtors',         label: 'Debtors',         roles: ['admin'] },
  { href: '/reconciliation',  label: 'Reconciliation',  roles: ['admin'] },
  { href: '/settings',        label: 'Settings',        roles: ['admin'] },
]

export function Sidebar({ role }: { role: Role }) {
  const visible = NAV.filter(item => item.roles.includes(role))
  // ...
}
```

`role` comes from session via the `(app)` layout server component; pass as a prop.

### 6c. Tests

`e2e/tests/31-sidebar-role-filter.spec.ts`:

```ts
for (const { fixture, expected } of [
  { fixture: 'admin.json',      expected: [...admin] },
  { fixture: 'fee_earner.json', expected: [...feeEarner] },
  { fixture: 'assistant.json',  expected: [...assistant] },
]) {
  test(`sidebar for ${fixture}`, async ({ page }) => {
    // visit / ; assert rendered nav matches expected
  })
}
```

## 7. Dependencies & risks

- **Sequencing:** the decisions doc is a product artefact. Shipping the sidebar refactor without the doc risks hiding a link product later wants visible. Draft the doc first.
- **Overlap with [C9idroZH](C9idroZH-permission-audit.md):** both PRDs reference `permissions-decisions.md`. Coordinate: one of the two PRDs produces the doc; the other links to it. Simpler if `C9idroZH` creates the skeleton and this PRD fills in the sidebar-facing rows.
- Low implementation risk: the sidebar refactor is localised to one component.

## 8. Open questions

- For question 6 (assistants acting on behalf of fee earners): if allowed, `POST /api/fee-entries` needs to accept an explicit `feeEarnerId` for role=assistant, and the fee-entry form must let assistants pick any fee_earner as the owner. That's non-trivial — possibly split into a separate card.

## 9. Traceability

- **Trello card:** `69ce3b5859018d32900410ee` (short `kD5wROeu`)
- **Attachments on card:** none
- **Comments on card:**
  - `69cfbb3ad0fbf6dcef53cbaf` — Yusuf Kajee (2026-04-03): "Post running test i found some issues with the roles can you review and provide info"
  - `69cfbbdb8b849dd7c4a5cbe6` — Yusuf Kajee (2026-04-03): "For now i made any user able to record time… as per question 1 have a think and let me know if i need to change it"
- **Relevant source files:**
  - [src/components/layout/sidebar.tsx](../../../src/components/layout/sidebar.tsx)
  - [src/app/(app)/layout.tsx](../../../src/app/(app)/layout.tsx)
  - [src/app/api/fee-entries/route.ts](../../../src/app/api/fee-entries/route.ts) (interim patch at line 109-111)
- **Related PRDs:**
  - [C9idroZH-permission-audit.md](C9idroZH-permission-audit.md) — decisions doc shared
  - [d0vVGoP7-add-client-matter-quick-buttons-completed.md](d0vVGoP7-add-client-matter-quick-buttons-completed.md) — role-gated quick actions shipped
