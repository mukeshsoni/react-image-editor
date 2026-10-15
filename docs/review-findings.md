# Independent rebuild review

Reviewer: **`azure/gpt-6-sol`**, reasoning variant **`max`**.

The independent reviewer inspected the actual working-tree implementation and used
read-only browser/module probes. It reported 13 actionable findings. After the
fixes, a focused follow-up confirmed those failure paths were addressed and found
two related transition regressions. Both were fixed and verified by the same
reviewer in a final read-only code-and-test inspection.

## Findings and fixes

| Finding | Fix | Regression coverage |
| --- | --- | --- |
| Mobile tray cancels vertical panning | Stable presentation offsets and pan bounds based on the usable viewport | Session and mobile browser tests |
| Uncommitted rotation leaks into export after Undo | Draft rotation is restricted to crop preview; Apply is a single crop transaction | Native canvas/PNG and browser tests |
| Crop handles unreachable on short screens | Short mobile workspaces use side-by-side controls with unobscured canvas space | 390×400 browser handle drag |
| Auto straighten has no visible effect after an existing crop | Crop configuration explicitly opens an editable crop draft | Session regression |
| Source replacement leaves stale mobile tool selection | Source boundaries reset the workspace; inactive tool-specific tabs are cleared | Crop/healing replacement browser tests |
| Cancel publishes/records discarded crop changes | Cancellation restores the saved crop before publication and discards draft history | Debounce, history, and browser regressions |
| Automatic healing samples the blemish at an edge | Shared source selection chooses a valid, sufficiently separated sample | Pixel and gesture tests |
| Point Color misses a white-balanced color | Picker samples the same pre-color pipeline stage used by the mask | Pixel, coordinate, and gesture tests |
| Failed replacement retains old edits/history | Source boundaries clear dimensions, edits, and history; history is disabled while unavailable | Session regressions |
| Global-themed editors restore the host incorrectly | Coordinated, reference-counted theme ownership with final host restoration | Both unmount orders, mixed themes, and Strict Mode tests |
| Package CSS requires Tailwind and resets its host | Compiled, subject-scoped CSS; local reset; Tailwind is build-time-only | CSS selector tests and real packed consumers without Tailwind |
| Constrained crops include transparent warped pixels | Crop bounds account for the valid perspective/lens sample region and preserve framing intent | Native canvas/PNG, session, and browser alpha tests |
| Duplicate-X curve points can be ineffective | Insertions keep distinct X positions or select an existing point | Curve UI regressions |

## Follow-up corrections

- **Zoomed tray cycles:** save offsets for each covered height and retain that
  context through history and crop cancellation. Tests compare the visible view
  and actual preview pixel hashes after zooming, panning, cycling trays, and replay.
- **Reset crop:** restore the original crop as an undoable action, even if the user
  leaves crop mode without Apply. A browser regression verifies the full-size
  download after Reset and the previous cropped dimensions after Undo.

## Final verification

- 203 retained Chromium E2E tests passed.
- 13 additional review browser tests passed.
- 66 Vitest tests passed.
- 4 packed React 18.2 / React 19 consumer tests passed.
- 6 CSS scoping tests passed.
- Separate no-Tailwind packed consumers passed in React 18.2 and React 19, with
  light, dark, and mobile layouts, portal styling, and host-style isolation.
- ESLint, source/E2E/review TypeScript checks, demo/library builds, and declaration
  generation passed.

The retained E2E files, Playwright configurations, fixtures, driver, and assertions
remain identical to baseline commit `57cb7b2`. New browser regressions run separately
through `playwright.review.config.ts` on port 4177.

```sh
npm run test:review
npm run typecheck:review
npm run test:css
npm run test:css:package
```

The standalone CSS consumer check requires `agent-browser` with Chromium. It creates
temporary consumers and artifacts; `RIE_CSS_ARTIFACTS` can select their parent directory.
