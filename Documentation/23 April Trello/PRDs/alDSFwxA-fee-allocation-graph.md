# PRD — Fix Fee Allocation / Graph (discovery, BLOCKED)

**Trello card:** `69dce6ee52e5ae07d8b97cfc` (short: `alDSFwxA`) — [open in Trello](https://trello.com/c/alDSFwxA)
**List:** Triage (`69ccca10312e55a8159be989`)
**Status (audit 2026-04-23):** Unclear — **blocked on card author**
**Card title:** "Fix Fee Allocation / Graph"
**Date:** 2026-04-23

---

## 1. Problem

This PRD cannot be written. The card has:
- Title only: "Fix Fee Allocation / Graph"
- Empty description
- No comments
- No attachments
- No checklist
- Last activity 2026-04-13

"Fee Allocation" + "Graph" could plausibly mean several different things:

| Candidate interpretation | Evidence in code |
|---|---|
| The cumulative fees chart on the dashboard | `src/components/dashboard/fees-chart.tsx` (already separately tracked on card `3rVH53Mv` — "Add toggle") |
| The per-earner cumulative chart | `src/components/dashboard/all-earners-chart.tsx` |
| Fee entry allocation to matters (matterId selection UX) | `src/components/time-recording/fee-entry-form.tsx` |
| The fee performance report graph | `src/components/reports/fee-performance-report.tsx` |
| A graph in the dashboard widget that shows matter/client fee split | no obvious match |

None of these has a clearly-stated bug today. Without more detail, any fix is a guess.

## 2. Goals

- Unblock this card by collecting the missing detail from its last editor (Yusuf Kajee, 2026-04-13).
- Once clarified, either (a) update this PRD with a real spec, or (b) split into a concrete follow-up card and archive this one.

## 3. Non-goals

- No speculative code changes.
- No attempt to second-guess the author by shipping a fix for one of the candidate interpretations.

## 4. User story

_Pending clarification._

## 5. Acceptance criteria

- [ ] Card author adds a description to the Trello card identifying:
  - The specific page or widget affected (URL or screenshot).
  - The observed vs expected behaviour.
  - A reproduction steps list if it's a bug, or a target design if it's a feature.
- [ ] A screenshot is attached to the card showing the broken state.
- [ ] Once the above is in place, this PRD is rewritten with real goals, solution, and AC — or the card is split into a new concrete card and this one archived.

## 6. Design / Solution

_N/A pending clarification._

## 7. Dependencies & risks

- **Blocked on:** the card author.
- Risk of stale work: if this card sits in Triage unclarified for another audit cycle, propose archiving it.

## 8. Open questions (for the card author)

1. Which page contains the broken graph — dashboard, reports, matter detail, or something else?
2. What exactly is wrong — is a graph rendering incorrect numbers, missing data points, or misallocating fees to the wrong matter/earner?
3. Is there a specific matter or fee earner where the issue reproduces?
4. Is this a regression from a recent deploy, or has the behaviour always been wrong?

## 9. Traceability

- **Trello card:** `69dce6ee52e5ae07d8b97cfc` (short `alDSFwxA`)
- **Attachments on card:** none
- **Candidate source files** (speculative only — to be narrowed after clarification):
  - [src/components/dashboard/fees-chart.tsx](../../../src/components/dashboard/fees-chart.tsx)
  - [src/components/dashboard/all-earners-chart.tsx](../../../src/components/dashboard/all-earners-chart.tsx)
  - [src/components/reports/fee-performance-report.tsx](../../../src/components/reports/fee-performance-report.tsx)
  - [src/components/time-recording/fee-entry-form.tsx](../../../src/components/time-recording/fee-entry-form.tsx)
- **Related PRDs:**
  - [3rVH53Mv-fees-chart-toggle-completed.md](3rVH53Mv-fees-chart-toggle-completed.md) — if "graph" means the dashboard cumulative chart, this PRD folds into that one.
