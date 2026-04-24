# PRD — Casey colour scheme + per-user palette

**Trello card:** `69ccca4d25587fc3a17ab6be` (short: `pOpH18E4`) — [open in Trello](https://trello.com/c/pOpH18E4)
**List:** Triage (`69ccca10312e55a8159be989`)
**Status (audit 2026-04-23):** Open
**Card title:** "Casey Color scheme to change (TBD)"
**Date:** 2026-04-23

---

## 1. Problem

The current Casey theme is whatever Tailwind + `next-themes` hands out by default — a single palette shared by every user with only light/dark/system switching. The card requests two related but distinct things:

1. Replace the current colour scheme with a new, approved palette for the firm.
2. Let each user choose their own colour scheme from the available palettes.

The card marks itself as "TBD" because the prerequisite palette has not been designed or documented ("Require Pallet for Color scheme"). No schema, no picker UI, and no per-user preference storage exists today.

## 2. Goals

- Define a **documented palette** (tokens → HSL/hex) as the single source of truth for Casey's colours, in both light and dark modes.
- Persist a **per-user colour scheme preference** in the database.
- Expose a **user-facing picker** in settings for choosing among the approved palettes.
- Apply the chosen palette **without a page reload** and carry it across sessions.

## 3. Non-goals

- No bespoke colour-picker (user enters arbitrary hex values) — choice is constrained to the firm-approved palette set.
- No per-matter or per-client theming.
- No removal of `next-themes` light/dark switching — colour scheme is orthogonal to light/dark.

## 4. User story

> As a firm user (admin or fee earner), I want to choose my own Casey colour scheme from a defined palette, so that the UI reflects my preference and improves readability without affecting anyone else's view.

## 5. Acceptance criteria

- [ ] A palette document at `Documentation/color-palette.md` lists the approved schemes by token (primary, secondary, accent, destructive, success, warning, muted, background, foreground) with exact values for light and dark modes.
- [ ] `prisma/schema.prisma` adds a `User.colorScheme` column (enum or FK to a `color_schemes` table) with default `"default"`. Migration applied and `PRISMA_SCHEMA_VERSION` in `src/lib/prisma.ts` bumped.
- [ ] NextAuth JWT + session include `colorScheme` (update `src/lib/auth.ts` callbacks and `src/types/next-auth.d.ts`).
- [ ] Settings has a new Profile page with a scheme picker. Selecting a swatch calls `PATCH /api/users/me` (or equivalent) and updates the UI within the same session, no reload.
- [ ] A thin `PaletteApplier` mounted inside `src/app/(app)/layout.tsx` reads the session's `colorScheme` and applies the matching CSS custom properties on `<html>` or `<body>`.
- [ ] `src/app/globals.css` tokens (e.g. `--primary`, `--background`) consume the custom properties, so switching scheme updates everywhere.
- [ ] Admin-only "Reset to default" button restores the firm default scheme.
- [ ] Manual regression: open dashboard, matters, invoice preview, timesheet in each palette and confirm no hardcoded colours break (spot-check `src/components/bookkeeping/`, `src/components/reports/`).

## 6. Design / Solution

1. **Palette doc first.** Write `Documentation/color-palette.md` before any code. Include at least `default`, `midnight`, `paper` schemes. Each scheme maps every Tailwind CSS variable currently declared in `src/app/globals.css`.
2. **Schema.**
   ```prisma
   model User {
     // ... existing fields
     colorScheme String @default("default") @map("color_scheme")
   }
   ```
   Bump `PRISMA_SCHEMA_VERSION` per `CLAUDE.md`.
3. **Auth.** Extend JWT callback to include `colorScheme`; session callback mirrors it. Update `src/types/next-auth.d.ts`.
4. **Applier.** New client component `src/components/providers/palette-applier.tsx`:
   ```tsx
   useEffect(() => {
     const scheme = PALETTES[session.user.colorScheme] ?? PALETTES.default
     Object.entries(scheme.vars).forEach(([k, v]) =>
       document.documentElement.style.setProperty(k, v),
     )
   }, [session.user.colorScheme])
   ```
   Mount it in `src/app/(app)/layout.tsx` under `ThemeProvider`.
5. **Picker UI.** New page `src/app/(app)/settings/profile/page.tsx` with `RadioGroup` of swatches; on change, PATCH `/api/users/me`.

## 7. Dependencies & risks

- **Blocked on design.** No palette exists yet — this PRD cannot move to build until the palette doc is authored and signed off.
- Colour tokens in `src/app/globals.css` must all use CSS custom properties; any hardcoded hex in downstream components breaks switching. Grep `rg -nE '#[0-9a-fA-F]{3,6}' src/components/` will find offenders.
- Light/dark parity: each palette must exist in both light and dark variants, or the scheme picker must be disabled in the unsupported mode.

## 8. Open questions

- Are admins allowed to upload a firm-custom palette, or is the palette set fixed at build time?
- Does the scheme preference persist for unauthenticated login / auth pages, or only inside the `(app)` shell?

## 9. Traceability

- **Trello card:** `69ccca4d25587fc3a17ab6be` (short `pOpH18E4`)
- **Attachments on card:** none
- **Relevant source files:**
  - [src/app/layout.tsx](../../../src/app/layout.tsx) — existing `ThemeProvider` wrap
  - [src/components/providers/theme-provider.tsx](../../../src/components/providers/theme-provider.tsx)
  - [src/app/globals.css](../../../src/app/globals.css) — token definitions
  - [src/lib/auth.ts](../../../src/lib/auth.ts) — JWT/session callbacks
  - [src/types/next-auth.d.ts](../../../src/types/next-auth.d.ts)
  - [prisma/schema.prisma](../../../prisma/schema.prisma)
- **Related PRDs:** independent of the other PRDs in this set.
