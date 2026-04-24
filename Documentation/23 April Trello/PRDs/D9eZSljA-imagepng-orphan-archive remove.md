# PRD — Archive the `image.png` orphan card

**Trello card:** `69df571ac99651d2fd561a45` (short: `D9eZSljA`) — [open in Trello](https://trello.com/c/D9eZSljA)
**List:** Triage (`69ccca10312e55a8159be989`)
**Status (audit 2026-04-23):** Unclear — **board hygiene, not a feature**
**Card title:** "image.png"
**Date:** 2026-04-23

---

## 1. Problem

This card is a board-hygiene artefact, not a feature. It has:

- Title: literally `image.png` (the default filename Trello assigns when you drag an image onto the board and miss the target card).
- Description: empty.
- No comments, no checklist, no members, no labels.
- One image attachment (`69df571ac99651d2fd561af1`, 226 KB, PNG).

Timeline points strongly at a drag-and-drop accident:
- Created **2026-04-15 at 09:15:06.893Z**.
- Adjacent card `d0vVGoP7` ("Add quick button for Add client & Add matter at the bottom") was created **two seconds later** at 09:15:08.972Z.

The attached image shows the dashboard "Today" widget with a prominent `RECORD TIME` CTA — exactly the UI context that card `d0vVGoP7` wants to add "Add client" / "Add matter" buttons alongside. In other words, this card's attachment is the visual evidence that should live on card `d0vVGoP7`.

## 2. Goals

- Preserve the image's context by moving it onto card `d0vVGoP7`.
- Archive card `D9eZSljA` to get it out of the Triage list.
- Keep the card's Trello ID in the record (archive, don't delete) so this audit's traceability holds.

## 3. Non-goals

- No code change.
- No deletion of the card (archive only, for audit traceability).
- No process change for how images are attached in future.

## 4. User story

_Not applicable — this is board hygiene._

## 5. Acceptance criteria

- [ ] Attachment `69df571ac99651d2fd561af1` (`image.png`, 226 KB) is copied to card `69df571c07a29f781c9812a1` (short `d0vVGoP7`) using Trello's built-in "Share → Copy attachments to…" flow.
- [ ] Card `D9eZSljA` is **archived** (not deleted) — `closed` flips to `true`; card remains retrievable for audit.
- [ ] Card `d0vVGoP7`'s description is updated with a one-line reference to the attachment now living on it: `Current state screenshot: attachment 69df571ac99651d2fd561af1-image.png.`
- [ ] The PRD for card `d0vVGoP7` ([d0vVGoP7-add-client-matter-quick-buttons-completed.md](d0vVGoP7-add-client-matter-quick-buttons-completed.md)) is updated to reference the now-present attachment in its Attachments section.

## 6. Design / Solution

Execute in Trello (or via MCP `mcp__trello__update_card_details` + `mcp__trello__attach_image_to_card`):

1. On card `d0vVGoP7`, attach the image from `D9eZSljA` (either via Trello UI or via download-and-reattach).
2. On card `D9eZSljA`, archive.

Optional follow-up: if drag-and-drop accidents are common, raise a board convention note — "drag images onto the target card, not onto the column".

## 7. Dependencies & risks

- Zero risk — no code, no data, no user-facing change.
- Low value if left alone, but keeping orphan cards in Triage pollutes the metrics and audit reports.

## 8. Open questions

- None.

## 9. Traceability

- **Trello card (to archive):** `69df571ac99651d2fd561a45` (short `D9eZSljA`)
- **Trello card (destination):** `69df571c07a29f781c9812a1` (short `d0vVGoP7`)
- **Attachment to migrate:** `69df571ac99651d2fd561af1` — `image.png` (226 KB, `image/png`). Cached at `.trello-audit-cache/69ccca063fec31d86ac34a38/69df571ac99651d2fd561a45/`.
- **Related PRDs:**
  - [d0vVGoP7-add-client-matter-quick-buttons-completed.md](d0vVGoP7-add-client-matter-quick-buttons-completed.md) — attachment's true home
