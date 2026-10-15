# React Image Editor: clean rebuild requirements

## 1. Goal and acceptance contract

Recreate the existing image editor from a blank application on
`rebuild-from-scratch`. This document was written before replacing the application,
from the current public API, working UI, source feature definitions, README, and
Chromium E2E scenarios on `redo-everything`. The original editor, E2E suite, and
related regression fixes were committed as `57cb7b2` before this implementation
started.

The product is a browser-based, non-destructive photo editor, distributed as a
React component and demonstrated in a standalone Vite app. A user can load a photo,
adjust it, revisit earlier decisions, and download a full-resolution result.

The existing `e2e/` directory, both Playwright configurations, and the Chromium CI
workflow are retained as the acceptance contract. Tests must continue to interact
through the public UI and `onEditsChange`; production code must not recognize test
images or contain test-only behavior. Pixel expectations must not be weakened to
make the new implementation pass.

## 2. Feature inventory

### F01 — Embedding, image loading, and lifecycle

- Export `ReactImageEditor`, `ImageEditorEdits`, and `ThemeMode` from the package.
- Props: required `imageSrc: string`; optional `onEditsChange`, `themeMode`
  (`light | dark | system`, default `dark`), and `themeScope` (`local | global`,
  default `local`). The editor fills a parent with an explicit height.
- Accept same-origin URLs, CORS-enabled remote URLs, data URLs, and object URLs.
  Support browser-decodable images, including PNG and JPEG.
- Load at natural resolution. Handle portrait, landscape, odd dimensions, tiny
  images, transparency, and large images without changing exported dimensions.
- Show loading/error states and disable image-dependent actions until ready.
  Loading a valid source after a failure must recover without a remount.
- Replacing the image resets all edits, healing operations, crop, camera, and
  history. Replacing an image with one of the same dimensions still replaces its
  preview and export pixels.
- Ignore success/failure callbacks from superseded requests. A slow earlier image
  must never overwrite a newer photo or clear its edits.
- Parent rerenders preserve work. Remounting starts from the original image.
- Cancel scheduled work, listeners, image callbacks, and public notifications on
  unmount. Release object URLs created by the demo or download workflow.

### F02 — Preview, zoom, and pan

- Render an actual Canvas 2D preview with transparent margins around the photo.
- Initially center and fit the photo, without upscaling small images above 100%.
- Wheel/trackpad zoom is anchored at the pointer. Enforce finite, positive limits
  even for extreme wheel input.
- Zoom in, zoom out, fit/reset, and a numeric zoom readout.
- Double-click or single-finger double-tap toggles fit and a closer view.
- Drag-to-pan, with bounded movement and a short inertial continuation after a
  deliberate drag. Interrupt inertia when a new interaction begins.
- Native two-finger pinch controls the photo, not page magnification. Releasing
  pinch fingers is never interpreted as a double tap.
- A committed crop supports the same view controls. Camera operations never
  change the dimensions or pixels of an export.

### F03 — Crop and straighten

- Enter/leave crop mode through the Crop tool. Show a shaded surround, visible
  selection, rule-of-thirds guides, and eight independently draggable handles:
  corners plus top, right, bottom, and left.
- Move a selection within the image; resize without negative or zero dimensions.
  Pointer capture keeps dragging reliable outside the initial handle.
- Ratios: Original, 1x1, 4x5/8x10, 8.5x11, 5x7, 2x3/4x6, 4x3, 16x9, 16x10,
  and Custom. Applying a ratio centers the largest valid selection.
- Custom ratio dialog: Width and Height inputs, Apply and Cancel. Require finite,
  positive values. Apply remains disabled for missing/invalid values. Escape
  cancels; focus stays inside the dialog and starts on Width.
- An aspect-lock toggle preserves the selected ratio during resizing.
- Straighten from -45° to +45°, with live preview and a rotation reset.
- Constrain Crop keeps the selected rectangle inside the rotated image so an
  opaque source produces opaque interior pixels in the exported crop.
- Auto-straighten estimates a dominant horizontal/vertical orientation from image
  edges; a low-confidence image produces a graceful no-op.
- Apply saves a crop descriptor, exits crop controls, and fits the cropped output.
  Reset restores the original crop. Re-cropping can recover pixels outside an
  earlier crop because the original image remains available.
- Export is disabled during crop editing. Applying and resetting are undoable.

### F04 — Basic light and color

All controls show their current numeric value, support native range keyboard input,
and reset to their default on double-click. Section resets restore only the
corresponding adjustments. Neutral settings must be pixel-identical to the baseline.

| Control | Range | Default |
| --- | --- | --- |
| Exposure | -2…+2 stops | 0 |
| Contrast, Highlights, Shadows, Whites, Blacks | -100…+100 | 0 |
| Vibrance, Saturation | -100…+100 | 0 |
| Temperature | 2000…10000 K, steps of 50 K | 6500 K |
| Tint | -100…+100 | 0 |

- Light adjustments change tonal response rather than accumulating canvas draws.
- Saturation affects overall colorfulness; vibrance preferentially boosts muted
  colors and protects already-saturated colors.
- White-balance presets: Custom, Daylight, Cloudy, Shade, Tungsten, Fluorescent,
  and Flash. Changing temperature/tint directly selects Custom.
- A white-balance eyedropper samples a small neighborhood of the original photo
  in image coordinates, estimates neutralizing temperature/tint, and exits.
  Show an in-context picking hint; Escape cancels picking.

### F05 — Color mixer and point color

- Mixer bands: red, orange, yellow, green, aqua, blue, purple, magenta.
- Each band has independent Hue, Saturation, and Luminance controls (-100…+100,
  default 0). Selecting another band preserves values; Reset band affects only
  the selected band. Provide a full mixer reset.
- Mixer and Point Color are accessible tabs.
- Point Color: pick a hue from the photo; store its normalized hue (0…1), or
  `null` before selection. Escape cancels the picker without choosing a color.
- Range is 0…100, default 50. Hue/saturation/luminance shifts are -100…+100.
  Apply a smooth hue-range mask; unrelated colors stay unchanged.

### F06 — Tone curve

- Point-curve editor with a grid, identity diagonal, visible control points,
  and RGB/red/green/blue channel selection.
- Click to insert an interior point, drag to move it, select and Delete/Backspace
  to remove it. Keep endpoints and points ordered, finite, and bounded to 0…1.
- Default curves are identity: (0,0) → (1,1). Reset restores identity output.
- Parametric mode provides Highlights, Lights, Darks, and Shadows (-100…+100,
  default 0), with a smooth tonal-region response.
- Curve editing is focusable and has an accessible name and keyboard alternatives.

### F07 — Presets

- Built-ins: None, Auto Enhance, Vibrant, Warm, Cool, Matte, B&W,
  B&W High Contrast, and Vintage Film.
- Strength 0…100, default 100. Apply a scaled preset into the visible manual
  white-balance/light/color values, clamping to each control's valid range.
- Applying a preset is one meaningful history entry named `<name> preset`.
  Subsequent manual editing remains possible; presets are not a hidden second
  filter that gets applied twice during export.
- Preserve the established preset recipes: Auto Enhance gently raises exposure,
  contrast, shadows, and color; Vibrant increases color; Warm/Cool shift white
  balance; Matte lifts blacks; B&W removes saturation; High Contrast adds a
  stronger monochrome tonal curve; Vintage Film warms, softens, and fades color.

### F08 — Details

| Control | Range | Default |
| --- | --- | --- |
| Sharpening amount | 0…150 | 0 |
| Sharpening radius | 0.5…3, steps of 0.1 | 1 |
| Sharpening detail | 0…100 | 25 |
| Sharpening masking | 0…100 | 0 |
| Denoise luminance | 0…100 | 0 |
| Denoise color | 0…100 | 0 |
| Denoise detail | 0…100 | 50 |

- Sharpen edges with controllable radius/detail and an edge mask that limits
  noise amplification. Amount 0 is an exact no-op.
- Reduce luminance and chroma noise independently, with detail preservation.
  Zero luminance/color amounts are an exact no-op.
- Separate sharpening and noise-reduction resets. Preview and full-resolution,
  cropped/uncropped exports all use the same settings.

### F09 — Geometry, lens corrections, and optics

- Transform: vertical perspective, horizontal perspective, and aspect correction
  (-100…+100, default 0), plus reset and automatic alignment actions.
- Lens: barrel/pincushion distortion (-100…+100, default 0) and Remove Chromatic
  Aberration (default off). Corrections use image-centered coordinates.
- Optics: vignette (-100…+100), grain (0…100), dehaze (-100…+100), default 0.
- Vignette darkens or lightens the image perimeter, independently of preview
  margins. Grain is deterministic so rerenders, history, preview, and export do
  not introduce different random patterns. Dehaze changes atmospheric contrast.
- Changes and resets are undoable; all effects are also present in downloaded files.

### F10 — Healing and cloning

- Modes: Spot, Heal, Clone. Default: Spot, brush size 30, feather 50.
- Adjustable brush diameter and feather, with a visible brush cursor.
- Spot removal creates a target and a source/sample position; automatically
  choose an initial valid source. Select a spot, drag its source pin, or delete it
  with Delete/Backspace. Show the selected target/source relationship.
- Heal paints a continuous blended repair. Clone paints from a selected source,
  preserving the source-to-stroke offset as the brush moves.
- Alt/Option-click selects a clone source. Space-drag pans while healing.
- Store strokes and sample positions in original-image coordinates. Samples
  outside the eventual crop must remain available through cropping and rotation.
- Clear healing strokes is reversible through Undo. Each gesture is one operation.

### F11 — History and reset

- Undo/redo buttons and Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z. Redo is disabled at the
  newest entry; a new edit after Undo discards the abandoned redo branch.
- Click an entry to time-travel. Restore all edit settings and the saved view.
- Camera changes can be recorded, but opening/closing panels must not pollute
  history or cause accumulated camera drift.
- Keep at most 50 entries, always preserving entry 0, labeled exactly `Original`.
  Dropping older edits must never discard the original baseline.
- Reset returns to the original image, including crop, geometry, color, and healing.
- Batch continuous input into useful history steps. Avoid duplicate no-op entries.

### F12 — Export

- Format selector labeled Export format: PNG (default) and JPEG.
- JPEG quality 10…100, default 92; quality changes the actual encoded file.
- Save real browser downloads named `edited-image.png` / `edited-image.jpg`.
- PNG preserves transparency. JPEG composites transparent pixels onto white.
- Use natural image dimensions or rounded, positive committed crop dimensions.
  Zoom, pan, panel sizes, and device pixel ratio never change the output file.
- Apply the complete non-destructive pipeline at full resolution, including
  healing, denoise, rotation, and source-relative effects.
- Disable Download during loading, crop editing, and encoding. If encoding fails,
  show `Failed to export image` next to export controls and allow a retry.

### F13 — Themes and standalone demo

- Light, dark, and system themes. Respond to prop and OS-preference changes.
- Local theming affects only this editor and its portals, not the embedding page.
  Global scope is an explicit opt-in; clean up owned global theme changes.
- The demo provides file upload, a sample image, and a persistent theme preference.
- Keep the image as the visual focus: neutral surfaces and a restrained green
  accent, consistent with the existing interface.

## 3. UI and UX requirements

### Desktop workspace

- Compact top toolbar with editing tools, undo/redo, reset, format, and Download.
- Three-pane workspace: collapsible/resizable History on the left, a flexible
  canvas in the center, and scrollable adjustment sections on the right.
- Sections: Basic, Presets, Color Mixer, Tone Curve, Details, Transform,
  Lens Corrections, Optics, Healing, History. Use meaningful headings and retain
  persisted accordion open/closed preferences.
- Keep tool state visible with pressed/selected styling. Crop and healing are
  mutually exclusive. Picking hints appear next to the image.
- Preserve canvas size during panel scrolling; resize/fitting must keep it visible.

### Mobile workspace (at or below 768 CSS px)

- A full-height canvas with an overlaid bottom tray and five tool buttons:
  Presets, Crop, Healing, Edit, History.
- Edit reveals Basic, Color, Tone, Details, and Geometry subtabs. Re-tapping a
  selected subtab closes its content. Opening Edit does not auto-open Basic.
- The tray scrolls independently. Switching content resets its scroll position.
- Opening/closing trays preserves the user's view, with a reversible presentation
  offset to keep useful image content clear of controls. Crop handles must remain
  visible and touchable above the tray.
- Fitting a newly applied crop establishes a new camera; closing its tray must
  preserve that fitted zoom. Repeated tray cycles must not accumulate movement.
- Support portrait/landscape changes and small-height layouts. Respect bottom
  safe-area insets; avoid page scroll/pinch conflicts with canvas gestures.
- Use comfortably sized touch controls (approximately 44 px targets), native range
  inputs, clear labels, and an always-discoverable Download action.

### Interaction and accessibility

- Retain the existing test-facing accessible names, slider IDs, and meaningful
  `data-testid` hooks. They identify real user controls, not a separate test UI.
- Use Radix primitives for selects/dialogs/tabs and native controls where suitable.
  Dialogs trap focus, support Escape, and restore focus. Icon buttons have labels.
- Show text and selected state, not color alone; use visible keyboard focus.
- Native slider Home/End/arrows, values with tabular numerals, and double-click
  reset. Draft input commits after 150 ms or immediately on release/key-up/blur;
  public edit/history notifications settle after a further 250 ms. At 399 ms a
  held-key update is not published; at 400 ms its latest value is published.
- Shortcuts: Cmd/Ctrl +/-/0 for zoom/fit; crop `[` / `]` for 1° rotation (Shift
  for 5°), R to reset; Escape for pickers; Space and Alt/Option for healing.
- Do not intercept text editing in host inputs, textareas, or contenteditable
  regions. Scope editing shortcuts to the active editor and allow Undo from sliders.
- Use concise inline loading/error feedback. Reversible editing actions remain
  immediate. No decorative animation or moving layout during interaction.

## 4. Public data and implementation boundaries

- Keep the serializable version-1 edit shape: crop rectangle/settings/commit,
  white balance, light, color (mixer + point color), tone curve, preset metadata,
  sharpening, denoise, geometry/optics, and version-1 healing operations.
- Use explicit original-image coordinates for crop geometry and healing. A crop
  commit records output dimensions, rotation, and `bakedOffset` so its relationship
  to the original image is unambiguous.
- Separate editable image data from the camera, active tool, selection, export
  preferences, and panel state. Keep an immutable original source.
- Create a per-instance Zustand store, with pure defaults/geometry and explicit
  actions. Do not recreate the old network of global, mutually dependent stores.
- Implement one image-space processing pipeline shared by preview and export.
  Cache by source identity and pixel-affecting edits; camera motion only redraws.
- Keep DOM/canvas resources in the rendering layer, with guarded Canvas 2D access,
  frame scheduling, and deterministic cleanup. React 18-compatible hooks and
  compiler output must work in React 18.2 and React 19 consumers.
- Suggested modules: `model/` (types/defaults/store/presets), `engine/` (geometry,
  pixel effects/render/export), `components/` (primitives/tools/layout), `hooks/`
  (loading/theme/viewport), and a small `ReactImageEditor.tsx` composition root.
- Package ESM, declarations, and a single scoped stylesheet. Keep Vite, TypeScript,
  ESLint, Vitest, the existing E2E harness, and Chromium-only CI usable.

## 5. Existing placeholders and future scope

The old README explicitly identifies standalone Auto/B&W/HDR, the disabled Profile
control, and Guided Upright as placeholders. They are not implemented photo-editing
features to claim as restored. The actual B&W presets and Auto Enhance preset are
working features and are required above. RAW decoding and export metadata/profiles
are roadmap items rather than current functionality.

## 6. Build and verification plan

1. Restore and commit the existing E2E work and related application fixes on
   `redo-everything` first. Then return to the empty `rebuild-from-scratch` orphan
   branch with this document, legal/project tooling, and the committed E2E harness.
   Start `src/` from scratch after that baseline has been committed.
2. Build the public types, instance store, defaults, history, and coordinate model.
3. Build shared image-space rendering/export, loading lifecycle, and camera input.
4. Build accessible primitives and all editing panels, crop/healing overlays,
   desktop/mobile layouts, themes, and the demo.
5. Run focused existing specs while implementing. Resolve failures in production
   code; do not weaken or skip retained scenarios.
6. Run the full desktop/mobile Chromium suite, including stress/seeded journeys,
   and the packed React 18/19 consumers. Run lint, source/E2E type checks, and builds.
   Add focused unit tests for new geometry/processing/history invariants where they
   cover behavior not otherwise established by the retained suite.
7. Inspect the actual desktop and mobile UI in Chromium, including both themes,
   scrolling, custom-ratio focus, crop handles, and error states. Record verified
   results and any remaining limitations in the delivery summary.

## 7. Execution record

The requested order was followed:

1. Preserve the previous uncommitted implementation at
   `refs/backups/rebuild-before-e2e-commit` (tree `480090a4`).
2. Restore the saved original work to `redo-everything`, verify it, and commit it as
   `57cb7b2` — `test: add Chromium E2E coverage and regression fixes`.
3. Return to the empty `rebuild-from-scratch` orphan branch. Restore the requirements,
   legal/project tooling, and E2E harness from that committed baseline. Verify that
   no application source has been brought over.
4. Write the current implementation from scratch, then run the retained acceptance
   tests against it and resolve the independent review findings.
5. For the pull request against `main`, use the saved `57cb7b2` baseline as the
   parent of the first rebuild commit. This connects the initially orphan working
   tree to the repository history while preserving the reviewed application files.

### Current implementation

- `src/model/session.ts`: isolated state, explicit actions, notifications, source
  resets, and camera/tool ownership. `history.ts` preserves Original at capacity.
- `src/engine/`: linear-light exposure, white balance, curves, color/mixer masks,
  sharpening, bilateral denoise, repair, perspective/lens mapping, optics, and
  automatic level estimation. `PhotoRenderer` shares image-space processing and
  caches between the preview and full-resolution export.
- `src/hooks/use-canvas-input.ts`: mouse/touch input, pinch, double tap, pan,
  source picking, and repair gestures with cleanup.
- `src/components/`: accessible primitives and every editing panel, crop handles,
  repair pins, resizable desktop panes, and reversible mobile tray positioning.
- `src/ReactImageEditor.tsx`: public component, theme scope, lifecycle, and shortcuts.
- `styles.css`: scoped Tailwind tokens shared by library consumers and the demo.

### Verification on 2026-10-13

| Check | Original baseline before commit | Current rebuild |
| --- | --- | --- |
| Desktop/mobile Chromium, including stress journeys | 203 passed | 203 passed |
| Packed React 18.2 / React 19 consumers | 4 passed | 4 passed |
| Unit tests | 177 passed | 15 passed |
| ESLint and source/E2E TypeScript | Passed | Passed |
| Library and declaration builds | Passed | Passed |
| Demo production build | — | Passed |

The E2E directory, Playwright configurations, E2E TypeScript configuration, and CI
workflow are identical to the committed baseline. Additional unit tests exercise
instance/snapshot isolation, cancellation, history retention, crop constraints,
perspective-aware picking, immutable pixels, linear exposure, deterministic grain,
denoise, and automatic level estimation. Browser review covered the actual demo,
theme switching, and an active crop crossing the desktop/mobile breakpoint with
all eight handles and crop controls accessible.

### Independent review follow-up

The implementation was subsequently reviewed by `azure/gpt-6-sol` with `max`
reasoning. All 13 reported failure paths and two follow-up transition issues were
fixed. The same reviewer verified the fixes. Current verification includes 203
retained E2E cases, 13 added browser regressions, 66 unit tests, 4 packed React
consumer cases, and CSS checks using React 18/19 consumers without Tailwind.

The public stylesheet is now generated from `styles.source.css`, fully compiled,
and scoped to editor/portal elements. A host-side Tailwind compiler is not required.
See [review findings and regression coverage](review-findings.md) for details.
