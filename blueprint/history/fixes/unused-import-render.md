# Fix: Drop the unused import in render.tsx

**Type:** Fix
**Quick:** yes - `app/features/blocks/render.tsx` only; a fix, one file, no
data, contract, dependency or variable, Behaviour changes "None", no runtime
change on any path `quality-bar.md` names (an unused named import is dropped
from a module that stays imported), reproduced by one command.
**Verified:** not yet
**Reviewed:** not yet

## Goal

`npm run lint` reports `lint/correctness/noUnusedImports` at
`app/features/blocks/render.tsx:11`, the one warning every `verify` prints.
Remove it, so a new warning is visible rather than lost beside a known one.
Repairs F-129 and F-132 (both in `blueprint/findings/backlog.md`).

## In scope

- Remove `isPlainSection` from the import at `render.tsx:11`.

## Out of scope

- `nonEmptySections` on the same line - it **is** used (`render.tsx:84`).
  F-132's entry says both names are unused; only `isPlainSection` is, which is
  what F-129 says. F-132's Resolution records the correction.
- Making Biome fail on warnings - `coding-standards.md` says lint "fails on any
  issue", but a warning exits 0. A config change, not this fix.

## Build steps

- [x] **Step 1 - Remove the unused import** - delete `isPlainSection` from the
  `./sections.ts` import at `render.tsx:11`, leaving `nonEmptySections`.
  *Done when:* before the change, `npx biome lint app/features/blocks/render.tsx`
  reports `render.tsx:11:10 lint/correctness/noUnusedImports` and
  "Found 1 warning" (the reproduction); after it, the same command reports no
  warning, `npm run lint` reports no warning, and `npm run verify` exits 0 with
  296 unit tests passing.

## Files and areas

- `app/features/blocks/render.tsx:11`.

## Data and contracts

None.

## Testing

- The reproduction is the lint command above, run before and after - no new
  unit test: an unused import has no behaviour a test can observe.
- `npm run verify` (typecheck, lint, unit tests, build).

## Decisions

None.

## Production needs

None.

## Behaviour changes

None - removing an unused import changes no observable behaviour.

## Notes

- Never stage `blueprint/rescope-research-2026-10-01.md` - modified, not ours.

## Findings

### unused-import-render/F-129 [P3] closed - `render.tsx` keeps an import this item made unused
File: app/features/blocks/render.tsx:4

**Found:** 2026-10-01 by review (scope: current; lens: quality)
**Why it matters:** `renderSections` now narrows on `section.type`, so `isPlainSection` is no longer used there; `biome lint` reports `noUnusedImports` (the warning `npm run verify` prints, which does not fail the run).
**Suggested fix:** drop `isPlainSection` from the import at `render.tsx:4` (`npx biome check --write`).
**Resolution:** 2026-10-02, build (quick fix `fix/unused-import-render`): `isPlainSection` removed from the `./sections.ts` import at `render.tsx:11`. Red: `npx biome lint app/features/blocks/render.tsx` reported `render.tsx:11:10 lint/correctness/noUnusedImports`, "Found 1 warning". Green: the same command and `npm run lint` (179 files) report nothing; `npm run verify` exit 0, 296/296. Closed by build.

### unused-import-render/F-132 [P3] closed - `render.tsx` has an unused import, so lint reports a warning
File: app/features/blocks/render.tsx:11

**Found:** 2026-10-01 by review (scope: current; lens: all) - not part of this branch's diff
**Why it matters:** `npm run lint` reports `lint/correctness/noUnusedImports` as a warning, so the "lint fails on any issue" rule in `coding-standards.md` is quietly not holding.
**Suggested fix:** Run `npm run format` (Biome marks it FIXABLE), or delete the two names from the import.
**Resolution:** 2026-10-02, build (quick fix `fix/unused-import-render`): corrected - `nonEmptySections` is used (`render.tsx:84`); only `isPlainSection` was unused, as F-129 says. Repaired with F-129: same red and green runs. Closed by build.
