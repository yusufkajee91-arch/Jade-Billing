# PRD — Close out the Permission Audit (PA-001, PA-002, PA-007)

**Trello card:** `69cccc7b1fa365c3a48d4a11` (short: `C9idroZH`) — [open in Trello](https://trello.com/c/C9idroZH)
**List:** Triage (`69ccca10312e55a8159be989`)
**Status (audit 2026-04-23):** Partial (5 of 11 sub-items shipped)
**Card title:** "Review Permissions - Permission Audit"
**Date:** 2026-04-23

---

## 1. Problem

The attached Permission-Audit markdown (attachment `69ccccaa107bc1e2f087f9ae`, authored 2026-03-30) catalogued 11 issues (PA-001 … PA-011) where API role-checks contradicted the billing-system user stories. Today's re-verification:

| ID | State | Note |
|---|---|---|
| PA-001 | **Open** | `src/app/api/posting-codes/route.ts:26` — GET still blocks non-admin |
| PA-002 | **Open** | `src/app/api/fee-levels/route.ts:25` — GET still blocks non-admin |
| PA-003 | Resolved | `firm-settings/route.ts:53-69` — GET now only requires a session |
| PA-004 | Resolved | `invoices/route.ts:86-89` — blocks only `assistant` |
| PA-005 | Resolved | `matters/[id]/notes/route.ts` uses `checkAccess()` pattern |
| PA-006 | Resolved | `matters/[id]/attachments/route.ts` same pattern |
| PA-007 | **Open** | `fee-schedules/route.ts:43` — all endpoints still admin-only |
| PA-008 | Resolved | `src/app/(app)/collections/page.tsx` exists |
| PA-009 | Unclear | `assistant` role has no product definition |
| PA-010 | Unclear | `bank-matches/route.ts:34` — fee_earner POST allowed; user story says admin-only |
| PA-011 | Unclear | `trust-entries/route.ts:77` + `business-entries/route.ts:70` — same pattern |

**Impact note:** these permission gaps were the visible root cause of card `BQXnfIe0` ("Forbidden when making something a disbursement"). That downstream scenario is now covered and completed in [BQXnfIe0-forbidden-on-disbursement-completed.md](BQXnfIe0-forbidden-on-disbursement-completed.md).

## 2. Goals

- Close PA-001, PA-002, PA-007 — open the three GET endpoints to any authenticated session while preserving admin-only mutation gates.
- Decide and document PA-009, PA-010, PA-011 in a single product note so they stop living as ambiguous audit rows.
- Close the umbrella Trello card once all 11 are either shipped or have a recorded decision.

## 3. Non-goals

- No refactor of the session shape or NextAuth callbacks.
- No new permission model (e.g. per-matter ACL). The existing admin / fee_earner / assistant enum stays.
- No re-verification of the 5 Resolved items — they remain in place.

## 4. User story

> As a fee earner recording time, I want every data dropdown in the fee-entry form (posting codes, fee levels, fee schedules) to load without a 403, so that the form is actually usable in my role.

## 5. Acceptance criteria

- [ ] `src/app/api/posting-codes/route.ts:26` — GET allows any authenticated session; POST/PATCH/DELETE remain admin-only.
- [ ] `src/app/api/fee-levels/route.ts:25` — GET allows any authenticated session; POST/PATCH/DELETE remain admin-only.
- [ ] `src/app/api/fee-schedules/route.ts:43` **and** `fee-schedules/[id]/items/route.ts` — GET allows any authenticated session; POST/PATCH/DELETE remain admin-only.
- [ ] Unit tests under `src/__tests__/` (one per route) assert GET returns 200 for `fee_earner` and `assistant` mocked sessions, 401 for missing session, and admin-only for mutations.
- [ ] New e2e test under `e2e/tests/` logs in as the fee_earner fixture (`e2e/.auth/fee_earner.json`), opens the fee-entry slide-over, and asserts **zero** `status === 403` responses during mount (Playwright `page.on('response', ...)` listener).
- [ ] `Documentation/permissions-decisions.md` captures the three pending decisions (PA-009, PA-010, PA-011) with a named stakeholder and decision date.
- [ ] The umbrella Trello card is moved to `Done` (list `69ccca34b90b2ffc09bbdf78`) once all 11 items are either shipped or have a recorded decision; card's description is updated with a short summary + a link to this PRD.

## 6. Design / Solution

### 6a. The three code changes (each is one line)

```ts
// src/app/api/posting-codes/route.ts:26
- if (session.user.role !== 'admin') {
+ // GET is readable by any authenticated user — mutations below remain admin-only.

// src/app/api/fee-levels/route.ts:25
// same change

// src/app/api/fee-schedules/route.ts:43
// same change
```

Each of these files already has a separate admin-only guard on POST/PATCH/DELETE, so opening GET does not expose mutations.

### 6b. Tests

- Unit: add `src/__tests__/posting-codes-api.test.ts`, `fee-levels-api.test.ts`, `fee-schedules-api.test.ts`. Follow the `vi.mock('@/lib/auth')` pattern already used in `src/__tests__/matters.test.ts` to stub sessions.
- e2e: covered by `e2e/tests/35-fee-entry-form-mount-permissions.spec.ts` using the fee_earner storage state.

### 6c. Decisions doc

`Documentation/permissions-decisions.md`:

```markdown
# Permissions decisions (2026-04-XX)

## PA-009 — `assistant` role scope
Decision: <TBD>
Rationale: <TBD>

## PA-010 — bank-matches POST by fee_earner
Decision: <TBD>

## PA-011 — trust/business entries POST by fee_earner
Decision: <TBD>
```

Each decision either (a) confirms the current code is intentional and updates the source user story, or (b) tightens the code with a follow-up card.

## 7. Dependencies & risks

- **Unblocked** card `BQXnfIe0` (disbursement 403) — its fee-earner disbursement scenario now passes without 403 responses.
- **Unblocks** card `kD5wROeu` (role decisions) — the `permissions-decisions.md` doc satisfies four of its six product questions.
- Low risk: each of the three code changes is one line, and the separate admin-only mutation guard is still in place.
- Risk: any client code that assumes these endpoints return 403 for non-admins (defensive rendering) could break — grep `rg -n '403|Forbidden' src/components/` to find any such assumption.

## 8. Open questions

- The three "Unclear" sub-items (PA-009/010/011) require product input. Who owns that decision — Jessica? Laken? Name a stakeholder in `permissions-decisions.md`.

## 9. Traceability

- **Trello card:** `69cccc7b1fa365c3a48d4a11` (short `C9idroZH`)
- **Attachments on card:** `69ccccaa107bc1e2f087f9ae` — `Permission-Audit_(1).md` (the source audit — cached at `.trello-audit-cache/69ccca063fec31d86ac34a38/69cccc7b1fa365c3a48d4a11/`).
- **Relevant source files:**
  - [src/app/api/posting-codes/route.ts](../../../src/app/api/posting-codes/route.ts)
  - [src/app/api/fee-levels/route.ts](../../../src/app/api/fee-levels/route.ts)
  - [src/app/api/fee-schedules/route.ts](../../../src/app/api/fee-schedules/route.ts)
  - [src/app/api/fee-schedules/[id]/items/route.ts](../../../src/app/api/fee-schedules/[id]/items/route.ts)
  - [src/app/api/bank-matches/route.ts](../../../src/app/api/bank-matches/route.ts)
  - [src/app/api/trust-entries/route.ts](../../../src/app/api/trust-entries/route.ts)
  - [src/app/api/business-entries/route.ts](../../../src/app/api/business-entries/route.ts)
- **Related PRDs:**
  - [BQXnfIe0-forbidden-on-disbursement-completed.md](BQXnfIe0-forbidden-on-disbursement-completed.md) — fixed as a side-effect
  - [kD5wROeu-role-decisions-and-sidebar.md](kD5wROeu-role-decisions-and-sidebar.md) — shares the decisions doc
