# PRDs — Casey board (2026-04-23 audit)

Each file here is a product requirements document for one Trello card on the Casey board (`69ccca063fec31d86ac34a38`). Filenames are prefixed with the Trello short-link ID so every PRD is traceable back to a single card.

Source audit: [../trello-audit-2026-04-23.md](../trello-audit-2026-04-23.md).

## Index

| Short | PRD | Trello card title | Status | Notes |
|---|---|---|---|---|
| `pOpH18E4` | [pOpH18E4-casey-colour-scheme.md](pOpH18E4-casey-colour-scheme.md) | Casey Color scheme to change (TBD) | Open | Blocked on palette definition |
| `C9idroZH` | [C9idroZH-permission-audit.md](C9idroZH-permission-audit.md) | Review Permissions — Permission Audit | Partial | 5 of 11 sub-items shipped; 3 Open, 3 Unclear |
| `P9I9l8GL` | [P9I9l8GL-caisey-integrations-umbrella.md](P9I9l8GL-caisey-integrations-umbrella.md) | Connect Caisey to other apps | Open | Discovery only — no code |
| `kD5wROeu` | [kD5wROeu-role-decisions-and-sidebar.md](kD5wROeu-role-decisions-and-sidebar.md) | Fix bug when inputting fees | Partial | 6 product questions + sidebar fix |
| `alDSFwxA` | [alDSFwxA-fee-allocation-graph.md](alDSFwxA-fee-allocation-graph.md) | Fix Fee Allocation / Graph | Unclear | Needs description from author |
| `3rVH53Mv` | [3rVH53Mv-fees-chart-toggle-completed.md](3rVH53Mv-fees-chart-toggle-completed.md) | Add toggle on Fee graph: Recorded vs Billed | Completed | Dashboard toggle shipped |
| `Pp3lZ8B9` | [Pp3lZ8B9-outlook-email-agent.md](Pp3lZ8B9-outlook-email-agent.md) | Add Agent to connect Outlook → matters | Open | Large greenfield; needs integration strategy |
| `D9eZSljA` | [D9eZSljA-imagepng-orphan-archive.md](D9eZSljA-imagepng-orphan-archive.md) | image.png (orphan) | Unclear | Board hygiene — archive and merge attachment |
| `d0vVGoP7` | [d0vVGoP7-add-client-matter-quick-buttons-completed.md](d0vVGoP7-add-client-matter-quick-buttons-completed.md) | Add quick buttons: Add client & Add matter | Completed | Quick actions shipped |
| `ShXkgfbm` | [ShXkgfbm-reconcile-trust-business-transfers.md](ShXkgfbm-reconcile-trust-business-transfers.md) | Reconcile trust + business transfers for statements | Open | Data task + small code |
| `BQXnfIe0` | [BQXnfIe0-forbidden-on-disbursement-completed.md](BQXnfIe0-forbidden-on-disbursement-completed.md) | Forbidden when making something a disbursement | Completed | Fee-earner disbursement flow verified |
| `IdZL8Dwn` | [IdZL8Dwn-remove-tu-indicators-completed.md](IdZL8Dwn-remove-tu-indicators-completed.md) | Remove "T"/"U" entry-type indicators | Completed | Indicators removed |
| `TW7bWpnD` | [TW7bWpnD-posting-code-dropdown-truncation-completed.md](TW7bWpnD-posting-code-dropdown-truncation-completed.md) | Posting-code dropdown truncation | Completed | Dropdown wrapping and selected label fixed |

## Dependency graph (suggested execution order)

```
C9idroZH (permission audit)  ──────────────►  BQXnfIe0 (disbursement 403)
                            └──────────────►  kD5wROeu (role decisions + sidebar)
                                                   └──►  d0vVGoP7 (quick buttons role gate)

P9I9l8GL (integrations umbrella)  ─────────►  Pp3lZ8B9 (Outlook agent)

pOpH18E4 (colour scheme)  ─ independent
3rVH53Mv (fees-chart toggle)  ─ independent
IdZL8Dwn (T/U indicators)  ─ completed
TW7bWpnD (posting-code dropdown)  ─ completed
ShXkgfbm (reconciliation)  ─ data task; needs specific client list from author
alDSFwxA (fee allocation)  ─ BLOCKED on clarification
D9eZSljA (orphan)  ─ board hygiene; no code
```

## PRD template

Every file follows the same skeleton:

1. **Problem** — what's wrong / missing, tied to the Trello card + any visual evidence.
2. **Goals** — what "done" looks like.
3. **Non-goals** — what's explicitly not in scope.
4. **User story** — role, goal, benefit.
5. **Acceptance criteria** — testable checklist.
6. **Design / Solution** — concrete file-level changes.
7. **Dependencies & risks** — blockers, sequencing.
8. **Open questions** — what still needs a decision.
9. **Traceability** — Trello IDs, source files, related PRDs.
