# PRD — Casey integrations: discovery & strategy

**Trello card:** `69ccd59228ee67d8a35cf0e1` (short: `P9I9l8GL`) — [open in Trello](https://trello.com/c/P9I9l8GL)
**List:** Triage (`69ccca10312e55a8159be989`)
**Status (audit 2026-04-23):** Open
**Card title:** "Connect Caisey to other apps"
**Date:** 2026-04-23

---

## 1. Problem

The firm wants Casey to pull billable signal from the apps fee earners already use — Outlook (emails), Word (time spent editing, pages read), Adobe (PDF opens / reviews) — so that those touch points become suggested fee entries without fee earners having to capture them by hand.

Today none of these integrations exist: `rg -rn "outlook|adobe|msgraph|microsoft/graph" src/` returns 0 hits. There is no OAuth scaffold, no scheduled-job infrastructure, and no "suggested entry" concept in the schema or UI.

This card is intentionally broad. It **is a discovery card**, not a build card — it must produce a decision and a set of follow-up cards before any code ships.

## 2. Goals

- Produce a **written strategy** for Casey's external-app integrations, covering at minimum Microsoft Graph (Outlook + Word) and Adobe Document Cloud.
- Decide which integration ships first, which ships second, and which is deferred.
- Spawn a concrete follow-up card per chosen integration with scope, schema, and acceptance criteria.
- Put **POPIA and ethical considerations** on the record before any email-body ingestion begins.

## 3. Non-goals

- No production code shipped on this card.
- No user-facing integration UI on this card (those belong to follow-up cards).
- No decision on pricing, licensing, or Microsoft 365 procurement — that's operational, not product.

## 4. User story

> As a product owner, I want a written decision and a sequenced backlog for external-app integrations, so that the team can build them one at a time with clear scope instead of drifting into an ad-hoc Outlook plug-in.

## 5. Acceptance criteria

- [ ] `Documentation/integrations-strategy.md` exists and contains:
  - One section per candidate integration (Outlook email, Word editing time, Adobe PDF opens) describing: data types pullable, required OAuth scopes, pricing/licence implications, POPIA posture.
  - A named decision: integration A ships first, integration B second, integration C deferred.
  - A "suggested fee entry" data-model sketch — how ingested signal maps to an optional row shown to the fee earner *before* it hits the real `fee_entries` table.
- [ ] Follow-up Trello card exists for the chosen first integration with full scope AC (the existing card `Pp3lZ8B9` — Outlook agent — already covers this; link to its PRD).
- [ ] Follow-up Trello card exists or is queued for the chosen second integration.
- [ ] Card `P9I9l8GL` closes with its description updated to link to the strategy doc and the follow-up cards.

## 6. Design / Solution

This is a writing exercise, not a coding exercise. Rough structure for `Documentation/integrations-strategy.md`:

1. **Principles** — always-opt-in per user; no silent email reading; every ingested item is a *suggestion*, not a committed fee entry.
2. **Per-integration section:**
   - Data pullable (e.g. Graph `/me/messages`, `/me/drive/recent`, Adobe `events`)
   - Auth model (OAuth 2.0 code flow; token storage; refresh handling)
   - Matching rules to link signal → matter (ref number / surname / matter code)
   - Storage implications (new tables; POPIA retention)
   - Risk: spam, false positives, privilege-protected content
3. **Decision table** — name the order + the stakeholder who made the call.
4. **Follow-up cards** — one link per integration, using the board's short-link IDs.

## 7. Dependencies & risks

- **Legal/compliance:** POPIA requires a defensible purpose for processing personal data. Email bodies may contain third-party personal information. Before ingestion begins, a privacy review is non-negotiable.
- **Token security:** OAuth refresh tokens must be encrypted at rest. `prisma/schema.prisma` has no existing encrypted-column pattern — choose one here (envelope encryption via `EncryptedColumn` wrapper, or a managed secrets provider).
- Sequencing: the Outlook agent (`Pp3lZ8B9`) is already on the board as a concrete card; treat this umbrella card as setting the strategy *around* it, not as a parent epic.

## 8. Open questions

- Is Microsoft 365 (Graph API) already licensed for all users, or will licensing be per-user and a cost?
- Is Adobe Document Cloud in use at the firm, or is this aspirational?
- Who is the approved owner of the privacy review — internal counsel, or external?

## 9. Traceability

- **Trello card:** `69ccd59228ee67d8a35cf0e1` (short `P9I9l8GL`)
- **Attachments on card:** none
- **Relevant source files:** none yet — greenfield.
- **Related PRDs:**
  - [Pp3lZ8B9-outlook-email-agent.md](Pp3lZ8B9-outlook-email-agent.md) — first concrete slice
