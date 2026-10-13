# Browser E2E tests

The Chromium-only Playwright suite mounts the real `ReactImageEditor`, drives its UI, inspects
the public `onEditsChange` snapshots, and decodes actual browser downloads.
It complements the Vitest geometry, processor, and component tests.

## Run

```sh
npm ci
npm run test:e2e:install

# Desktop and mobile Chromium, including stress/seeded journeys
npm run test:e2e

# Fast local feedback
npm run test:e2e -- --project=chromium --grep-invert @stress

# A particular feature or reproduction
npm run test:e2e -- --project=mobile-chromium e2e/specs/crop.spec.ts
E2E_SEEDS=42 npm run test:e2e -- --project=chromium e2e/specs/journeys.spec.ts

# Interactive runner and saved reports
npm run test:e2e:ui
npx playwright show-report playwright-report/source

# Build, pack, install, type-check, and test React 18/19 consumers
npm run test:e2e:package
npx playwright show-report playwright-report/package

npm run typecheck:e2e
```

On Linux, install the browser system dependencies with
`npx playwright install --with-deps chromium`.
Playwright's standard `PLAYWRIGHT_BROWSERS_PATH` environment variable is supported.

The runner owns its Vite servers. Ports **4173** (source) and **4175/4176**
(package consumers) must be available. Existing servers are deliberately not reused,
so a test cannot accidentally target the demo or a stale application.

## Chromium projects

| Project | Browser/layout |
| --- | --- |
| `chromium` | Desktop Chromium, 1440 × 960 |
| `mobile-chromium` | Touch-enabled Pixel profile, 390 × 844, high DPR |
| `react-18-package` | Packed library, React 18.2, Tailwind 4, Chromium |
| `react-19-package` | Packed library, React 19, Tailwind 4, Chromium |

Desktop wheel/keyboard scenarios live in `*.desktop.spec.ts`. Native multi-touch
uses Chromium's input protocol and lives in `touch.spec.ts`. The remaining UI and
image scenarios run in both desktop and mobile Chromium projects.

These are browser/device emulations. Physical Android device testing, other
Tailwind versions, and animated/EXIF image compatibility require additional
projects and fixtures before they can be claimed as covered.

## Coverage

| Specs | Assertions |
| --- | --- |
| `loading` | Same-size replacement, PNG/JPEG uploads, data URLs, CORS, missing images, late requests, odd/tiny/portrait/large images |
| `crop` | Eight resize handles, move/clamp, eight aspect presets, custom validation, lock, re-crop, rotation, opacity, undo |
| `view`, `view.desktop` | Zoom, fit, pan, positive wheel limits, committed crop camera, export independence |
| `adjustments` | 24 slider bindings at min/max/default, keyboard input, double-click reset, section reset, white-balance preset/picker |
| `color-tone-presets` | Eight mixer bands, isolated resets, point-color range/picker, eight presets/history labels, curve points and region controls |
| `healing` | Clone source selection, samples outside the crop, rotation, spot source dragging/deletion, heal/clear/undo |
| `export` | Actual PNG/JPEG signatures, dimensions, alpha, white background, quality, denoise, vignette parity, encoding failure recovery |
| `history` | Pixel round trips through undo/redo, branch invalidation, original time travel, retention beyond 50 entries |
| `mobile` | Crop/tray camera restoration, scrolling, repeated open/close drift, orientation/viewport changes |
| `touch` | Native pinch and finger-release handling, native double tap |
| `keyboard.desktop` | Zoom/crop/history shortcuts and isolation from host text input |
| `lifecycle` | Parent rerenders, remount, cancellation after unmount, 150 ms slider / 250 ms notification boundaries |
| `accessibility-theme` | Accessible control names/ARIA, dialog keyboard focus, local theme updates, system theme changes |
| `journeys` | Reproducible mixed-action sequences and invariant checks after each action |
| `package` | Consumer React versions, distributed CSS, public declarations, image changes, editing, and cropped export |

The automated accessibility check explicitly covers naming, labeling, and ARIA
validity. It does not certify complete WCAG conformance. Contrast, screen-reader
interaction, and visual design still need dedicated coverage. The demo's documented
placeholder controls (Auto/B&W/HDR and Guided Upright) are not treated as implemented
editing features.

## Harness and fixtures

- `host/` is a small embedding app. It has file/URL inputs, mount/rerender controls,
  and a theme prop control. Hidden `<output>` elements expose **read-only public
  callback results** for assertions.
- `support/editor.ts` centralizes user-facing interactions. It never imports or
  modifies Zustand stores, calls editor actions directly, or replaces the renderer.
- `support/images.ts` generates deterministic PNG/JPEG inputs with `@napi-rs/canvas`:
  solid colors, ramps, palette bands, seeded noise, source/target patches, transparency,
  and unusual sizes. The fixture server serves them locally with explicit CORS behavior.
- The pixel helpers decode files saved by Playwright's real download event. Expected
  values use known fixture colors, dimensions, geometric ratios, monotonic changes,
  or earlier baseline exports. Production processor functions are not used as oracles.
- `scripts/prepare-consumers.mjs` uses `npm pack` and a content-addressed tarball.
  Generated consumers install that archive with their own React, React DOM, React
  typings, and Tailwind. Their CSS scanner targets the package's distributed code.
  Both consumers are independently type-checked before browser tests start.

## State and timing

Each test receives a fresh browser context, isolating storage, component state,
downloads, and event listeners. The helper waits for public committed edits and
stable preview pixels. Timing-boundary tests use Playwright's clock explicitly.

Camera changes are themselves history entries in this editor. Assertions about
undoing a crop account for the optional fit-camera entry. Mobile crop re-entry
also accounts for a tab remaining selected after Apply closes the crop controls.

`@stress` includes long history, large images, and seeded journeys. Seeds default
to `42,731,1337` and can be overridden with `E2E_SEEDS`. The executed command sequence
is attached to the report, allowing the exact journey to be reproduced.

## Diagnostics and CI

Failed tests retain screenshots, videos, traces, preview pixels, callback snapshots,
and the exported files used by assertions. Unexpected uncaught page errors fail the
test. Source and package results have separate output directories so both suites
can run concurrently.

```sh
npx playwright show-trace test-results/source/<failed-test>/trace.zip
```

`.github/workflows/e2e.yml` runs the two Chromium source projects and packed consumers.
Pull requests run the non-stress suite; main pushes, manual runs, and the nightly
schedule include stress journeys. Browser jobs are independent and upload their
reports even on failure.

## Adding scenarios

1. Pick a deterministic fixture whose pixels make the expected behavior observable.
2. Drive the UI with `EditorDriver`, roles, labels, and existing stable test IDs.
3. Assert the public edit snapshot and an independent visible/download result.
4. Include a relevant transition: undo, reset, source replacement, crop, resize, or unmount.
5. Use clock control or observable conditions for asynchronous behavior.
6. Keep desktop and native-touch input tests in their appropriate projects.
