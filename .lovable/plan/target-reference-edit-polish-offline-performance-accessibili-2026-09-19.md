# Target Reference edit polish, offline, performance, accessibility

Four pieces of work, none of which changes any existing rule, computation, lock behaviour, or save process. Everything below is presentation, caching, and rendering only.

## 1. Daily list on the Edit screen (match the Details screen)

The circled list in image 1 is the small-screen daily list on the edit form. It currently uses separated rounded cards, a plain total with no decimals, and text arrows. It will be rebuilt to look exactly like the Details screen in image 2:

- A period header strip above the list showing month + year on the left and the month total on the right.
- Flat rows separated by thin lines instead of floating cards.
- The same green/amber open-and-closed padlock indicator at the start of each row.
- A grey "NO RECORD" chip on days with nothing entered.
- Totals shown with two decimals, in the same weight and colour.
- Proper up/down chevron icons for expand/collapse.

Kept as-is: the revision-request buttons, the locked-day rules, the editable number inputs inside the expanded row, validation, and saving. Only the row's look changes — the edit fields stay editable exactly as today.

## 2. Offline support for field inspectors

The app already installs and caches its own screens and assets. Strengthening it:

- Cache successful reference lookups (stations, provinces, sectors, and similar option lists) so the forms still open and their dropdowns still fill in with no signal. Short lifetime, and never for anything that carries a sign-in token.
- Add a small offline page so opening a screen that was never visited shows a clear "you are offline" message instead of a blank screen.
- Make the existing offline pill clearer about what is and is not possible while disconnected (records cannot be saved without a connection).

Not included: queuing entries made offline and sending them later. That needs server-side duplicate and lock checks and would change the save process, which you asked to leave untouched. It can be a separate piece of work if you want it.

## 3. Performance on the heavy screens

- Move the pattern file at the repo root into a docs folder as documentation only (it is sample code, currently sitting where the build looks for real code).
- On the compliance and target-reference editors: memoise the per-row derived values so typing in one day's field no longer re-computes every other row, and split the two big dialogs so their heavy parts only load when opened.
- Keep every number, total, and rule identical — this is purely about how often the screen recalculates.

## 4. Accessibility and mobile pass

- Give every icon-only button a spoken label (7 files currently have unlabelled ones).
- Make expandable day rows announce whether they are open or closed, and reachable by keyboard.
- Replace full-height screen sizing with the mobile-safe equivalent so nothing gets cut off behind phone browser bars (5 places).
- Ensure tap targets on the day rows and small action buttons reach the minimum comfortable size.
- Check heading order and the single main-content landmark per page.

## Technical notes

- Item 1 edits the small-screen branch of `editBody` in `src/pages/06_target-reference/components/TargetReferenceNew.tsx` (the component the page imports as `TargetReferenceEdit`), reusing `DayLockIcon` and the row markup from `TargetReferenceDetails.tsx`. No changes to `dayTotal`, `cells`, `rowRevisionLock`, `hasPstLockActivated`, or `handleSave`.
- Item 2 adds a `NetworkFirst` runtime-caching rule scoped to reference/lookup GET endpoints in `vite.config.ts`, plus `offline.html` in `public/` wired as `navigateFallback` denylist companion. `src/lib/pwa.ts` guards stay exactly as they are.
- Item 3 moves `MEMORY_OPTIMIZATION_PATTERNS.tsx` to `docs/memory-optimization-patterns.md`, and applies `React.memo` / `useMemo` to the day-row rendering in the two editors.
- No database, API, permission, or validation code is touched anywhere in this plan.
