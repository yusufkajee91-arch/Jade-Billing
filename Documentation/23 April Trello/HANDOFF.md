# Handoff — Casey board audit + PRDs (2026-04-23)

This doc is a pickup brief for whoever continues this work — whether that's a future Claude session or a teammate. It says what was done, what was *not* done, what was actively being done at the moment of interrupt, and what is blocked on someone else's input.

**Scope:** audit of the Casey Trello board (`69ccca063fec31d86ac34a38`) against the `dcco-billing` codebase, followed by per-card PRDs.

---

## 1. What was done (fully complete)

### 1.1 Trello ↔ Claude Code plumbing
- `.mcp.json` at the project root wires the `@delorenj/mcp-server-trello` MCP server (pinned to the Casey board via `TRELLO_BOARD_ID` env).
- `.gitignore` updated to exclude `.mcp.json` and `.trello-audit-cache/` so the plaintext Trello creds and attachment cache do **not** get committed.
- Stale `.claude/mcp.json` config left alone but is **not** read by Claude Code — documented in memory; do not resurrect it.

### 1.2 New skill
- Global user-invocable skill at `~/.claude/skills/trello-audit/SKILL.md`. Project-agnostic, board-agnostic, MCP-or-curl, image-first, full Trello-ID traceability. Report output is fixed to `./Documentation/trello-audit-<YYYY-MM-DD>.md`.

### 1.3 Audit report
- `Documentation/23 April Trello/trello-audit-2026-04-23.md` — 664-line full audit of the 13 Triage cards.
- All 5 image attachments + the Permission-Audit markdown downloaded and cached at `.trello-audit-cache/69ccca063fec31d86ac34a38/`.
- Each of the 5 images visually analysed; each card carries its Trello ID end-to-end (cards, lists, labels, members, checklists, comments, attachments).

### 1.4 PRDs — one per Trello card
All 13 PRDs + an index are written under `Documentation/23 April Trello/PRDs/`:

| Short | File | Status |
|---|---|---|
| `pOpH18E4` | [pOpH18E4-casey-colour-scheme.md](PRDs/pOpH18E4-casey-colour-scheme.md) | written |
| `C9idroZH` | [C9idroZH-permission-audit.md](PRDs/C9idroZH-permission-audit.md) | written |
| `P9I9l8GL` | [P9I9l8GL-caisey-integrations-umbrella.md](PRDs/P9I9l8GL-caisey-integrations-umbrella.md) | written |
| `kD5wROeu` | [kD5wROeu-role-decisions-and-sidebar.md](PRDs/kD5wROeu-role-decisions-and-sidebar.md) | written |
| `alDSFwxA` | [alDSFwxA-fee-allocation-graph.md](PRDs/alDSFwxA-fee-allocation-graph.md) | written (discovery-only; blocked) |
| `3rVH53Mv` | [3rVH53Mv-fees-chart-toggle.md](PRDs/3rVH53Mv-fees-chart-toggle.md) | written |
| `Pp3lZ8B9` | [Pp3lZ8B9-outlook-email-agent.md](PRDs/Pp3lZ8B9-outlook-email-agent.md) | written |
| `D9eZSljA` | [D9eZSljA-imagepng-orphan-archive.md](PRDs/D9eZSljA-imagepng-orphan-archive.md) | written (board-hygiene, no code) |
| `d0vVGoP7` | [d0vVGoP7-add-client-matter-quick-buttons.md](PRDs/d0vVGoP7-add-client-matter-quick-buttons.md) | written |
| `ShXkgfbm` | [ShXkgfbm-reconcile-trust-business-transfers.md](PRDs/ShXkgfbm-reconcile-trust-business-transfers.md) | written |
| `BQXnfIe0` | [BQXnfIe0-forbidden-on-disbursement.md](PRDs/BQXnfIe0-forbidden-on-disbursement.md) | written |
| `IdZL8Dwn` | [IdZL8Dwn-remove-tu-indicators-completed.md](PRDs/IdZL8Dwn-remove-tu-indicators-completed.md) | completed |
| `TW7bWpnD` | [TW7bWpnD-posting-code-dropdown-truncation-completed.md](PRDs/TW7bWpnD-posting-code-dropdown-truncation-completed.md) | completed |

All 14 files exist on disk (13 PRDs + README index). Filenames are prefixed with the Trello short-link ID for unambiguous traceability.

---

## 2. What was not done (deliberately out of scope)

**No code was written for any PRD.** The deliverable was specifications, not implementation. Every PRD is a spec with file:line references ready to be picked up.

No Trello board mutations beyond read calls:
- No cards moved out of Triage.
- No cards archived (not even the orphan `D9eZSljA` — PRD covers this but it needs a call).
- No labels applied (the board has 6 unnamed colour labels and uses none).
- No comments posted to Trello linking back to PRDs.

No PR or branch:
- `git status` at handoff shows three pre-existing, unrelated modifications (`.gitignore`, `e2e/tests/13-invoicing.spec.ts`, `prisma/seed.ts`). `.gitignore` was edited by me to add `.mcp.json` + `.trello-audit-cache/`; leave that, discard anything else you don't recognise.
- No commits made.

---

## 3. What I was doing at the moment of interrupt

My internal todo list claimed I was "in_progress" on `d0vVGoP7` with four PRDs pending. **That was stale state** — I had already written all four before you interrupted. The interrupt arrived after the `TW7bWpnD` file was written (file exists at 7.0 KB, timestamped 16:52).

Net-effect of the interrupt: **nothing was mid-flight.** Every file on disk is complete and self-contained. The todo list lag was my bookkeeping error, not a truncated file.

If you want to verify: `ls -la "Documentation/23 April Trello/PRDs/"` should show 14 files, none of them zero-byte or weirdly small. `wc -l` each file; any below ~80 lines means something was truncated — none of mine are.

---

## 4. What is blocked on someone else (not on another agent)

These are **product / stakeholder decisions**, not work a future agent can unblock by itself:

| Card / PRD | Blocked on | Who | Why it matters |
|---|---|---|---|
| `alDSFwxA` — Fix Fee Allocation / Graph | Card author needs to add a description | Yusuf Kajee (last editor 2026-04-13) | Five plausible interpretations; guessing will waste cycles. |
| `ShXkgfbm` — Reconcile trust/business transfers | Naming the specific clients whose statements are wrong | Firm admin | Scoping without the list risks over-engineering. |
| `C9idroZH` — Permission Audit (PA-009/010/011) | Product decisions on `assistant` role scope, bank-matches gating, trust/business gating | Product owner + legal | Three Unclear items can't resolve from code alone. |
| `kD5wROeu` — Role decisions + sidebar | The same six product questions embedded in the card description | Jessica / Yusuf | Decisions doc is the prerequisite for the sidebar refactor. |
| `pOpH18E4` — Casey colour scheme | Design — palette definition | Design stakeholder | Card marked "TBD" explicitly for this. |
| `P9I9l8GL` — Integrations strategy | Privacy review + Microsoft 365 procurement decision | Legal + ops | Greenfield; no code until strategy + privacy sign-off. |

---

## 5. What a pickup agent can do next (ordered by value)

Quick wins — remaining small, independent cards with concrete ACs in their PRDs:

1. **`C9idroZH`** — remaining permission-audit decisions/changes. Use the PRD as source of truth because several sub-items are already shipped.

Completed quick wins:

- **`IdZL8Dwn`** — T/U/D indicators removed and PRD completed.
- **`BQXnfIe0`** — fee-earner disbursement flow verified and PRD completed.
- **`d0vVGoP7`** — quick actions shipped and PRD completed.
- **`3rVH53Mv`** — fees-chart toggle shipped and PRD completed.
- **`TW7bWpnD`** — posting-code dropdown wrapping fixed and PRD completed.

Medium work — ready when product unblocks:

3. **`kD5wROeu`** — once the decisions doc is written, sidebar refactor is mechanical.

Greenfield (large, plan before build):

7. **`pOpH18E4`** — needs palette design first.
8. **`Pp3lZ8B9`** / **`P9I9l8GL`** — needs integrations strategy + privacy review first.
9. **`ShXkgfbm`** — needs the client list, then can start the diagnostic script.

Board hygiene (10 minutes in Trello, zero code):

10. **`D9eZSljA`** — copy the attachment to `d0vVGoP7` and archive the orphan. PRD has the exact Trello steps.

---

## 6. Known context a pickup agent will need

### 6.1 Tools
- **Trello MCP is live** (`mcp__trello__*`). Default board is Casey. No restart required.
- **Supabase** — `mcp__claude_ai_Supabase__*` (Anthropic-managed) is the one that actually works. The `.claude/mcp.json` supabase entry never loaded — ignore it.

### 6.2 Codebase conventions (from `CLAUDE.md` + `AGENTS.md`)
- Next.js 16, React 19, Prisma 7 — **not the Next.js you know**; check `node_modules/next/dist/docs/` before writing code.
- Monetary values are integer cents (`*Cents`), VAT rate in basis points (`vatRateBps`).
- Prisma client generates to `src/generated/prisma/` (not default). After `prisma generate`, bump `PRISMA_SCHEMA_VERSION` in `src/lib/prisma.ts`.
- No `middleware.ts`. Auth is checked server-side in layouts and API routes. Path alias `@/` → `src/`.

### 6.3 Audit cache
- All 6 downloaded attachments live at `.trello-audit-cache/69ccca063fec31d86ac34a38/<card-id>/`. Gitignored. Still useful as reference — any PRD that cites an image filename maps directly to a file there.
- If you re-run the audit today, the skill's date-based filename appends `-2`, `-3`, …; it never overwrites.

### 6.4 Saved memories (this project's `memory/`)
- `trello_casey_board.md` — full Casey board context, MCP wiring details.
- `feedback_verify_before_alarming.md` — earlier feedback rule; respect it.

---

## 7. How to verify this handoff is accurate

```bash
cd "/Users/yusufkajee/Desktop/App Development/Development/dcco-billing"
ls -la "Documentation/23 April Trello/PRDs/" | wc -l              # ~16 lines (14 files + total + ..)
wc -l "Documentation/23 April Trello/PRDs/"*.md | tail -1          # expect ~1800 total lines
wc -l "Documentation/23 April Trello/trello-audit-2026-04-23.md"   # 664
ls .trello-audit-cache/69ccca063fec31d86ac34a38/*/ | wc -l          # 6 attachments cached
git status --short                                                  # three pre-existing mods + new .gitignore
```

If any of those drift, this handoff is stale — re-run the audit via `/trello-audit`.

---

## 8. One-line summary

**Posting-code dropdown is now complete. Remaining pickup priority is `C9idroZH`, then the product-blocked cards.**
