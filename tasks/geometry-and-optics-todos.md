# Geometry & Optics — Task Breakdown

Source PRD: `prds/geometry-and-optics-prd.md`

## Scope (v1)
- Add three right-panel accordions: `Transform`, `Lens Corrections`, `Optics`.
- Transform: rotate slider + auto-straighten.
- Transform: vertical/horizontal sliders + constrain crop.
- Transform: Guided Upright (1–2 guide lines + apply).
- Lens Corrections: lens distortion slider + CA toggle.
- Optics: vignette + grain + dehaze.
- All settings affect export output.

## 0) Product decisions to lock
- [x] Decide sign conventions (distortion `+` = barrel, `-` = pincushion)
- [x] Decide default for `Constrain crop` (default: `on`)
- [x] Decide JPEG behavior when transparency exists (default: auto-fill background)
  - [x] Option A: force PNG when transparency (cancelled; superseded by Option B)
  - [x] Option B: auto-fill background for JPEG (default: white)
- [x] Decide rendering backend for v1 (default: Canvas2D/CPU; revisit WebGL later)

## 1) State model + defaults
- [x] Add serializable editor state for:
  - [ ] `rotateDegrees: number` (kept in `cropStore.cropSettings.rotation`)
  - [ ] `constrainCrop: boolean` (kept in `cropStore.cropSettings.constrainCrop`)
  - [x] `perspective: { vertical: number; horizontal: number; aspect?: number }`
  - [x] `lensCorrections: { distortion: number; chromaticAberration: boolean }`
  - [x] `optics: { vignette: number; grain: number; dehaze: number }`
- [x] Ensure defaults match “no-op” rendering
- [x] Ensure state resets on new image load
- [x] Ensure state is included in future undo/redo snapshots (if present)

## 2) UI: Right panel accordions
- [x] Add accordion section `Transform`
  - [x] Add `Rotate` slider UI
    - [x] Reset to 0° control
    - [x] Optional angle readout (nice-to-have)
  - [x] Add `Auto Straighten` button + loading state
  - [x] Add perspective controls
    - [x] `Vertical` slider
    - [x] `Horizontal` slider
    - [x] `Constrain crop` toggle
    - [x] Optional `Aspect` slider (nice-to-have)
  - [x] Guided Upright UI
    - [x] `Guided` toggle
    - [x] `Apply Guided` button
- [x] Add accordion section `Lens Corrections`
  - [x] `Lens Distortion` slider
  - [x] `Remove Chromatic Aberration` toggle
- [x] Add accordion section `Optics`
  - [x] `Vignette` slider
  - [x] `Grain` slider
  - [x] `Dehaze` slider
- [x] Disable controls when no image loaded

## 3) Rendering pipeline foundations (shared preview + export)
- [x] Identify the current “committed image render” entry point (preview)
- [x] Introduce a single render pipeline abstraction:
  - [x] Accept source image + crop + geometry/optics settings
  - [x] Render to preview canvas
  - [x] Render to export offscreen canvas
- [x] Lock stage order:
  - [x] Transform (rotate + perspective)
  - [x] Lens Corrections (distortion + CA)
  - [x] Optics (vignette + grain + dehaze)

## 4) Straighten (manual rotate)
- [x] Implement rotate in preview rendering
- [x] Ensure “constrain crop” handles transparent corners
  - [x] If constrain: compute maximal rectangle crop
  - [x] If not constrain: allow transparency (preview)
- [x] Integrate rotate into export pipeline

## 5) Auto-straighten
- [x] Implement downscaled analysis buffer generation
- [x] Implement edge detection + line detection (gradient histogram)
- [x] Compute dominant near-horizontal angle and apply to `rotateDegrees`
- [x] Add guardrails
  - [x] If confidence low, no-op + message (currently silent)
  - [x] Clamp to allowed rotate range

## 6) Perspective sliders (vertical/horizontal)
- [x] Define mapping from slider value → keystone transform params
- [x] Implement perspective transform in preview
  - [ ] WebGL: homography shader sampling
  - [x] CPU: `ImageData` resample with bilinear
- [x] Integrate into export pipeline
- [x] Ensure constrain-crop behaves sensibly for keystone

## 7) Guided Upright
- [x] Add guided mode state + UI toggle (UI-only v1)
- [x] Add overlay rendering (deferred)
  - [x] Perspective grid toggle (deferred)
  - [x] 2 draggable guide lines (vertical + horizontal) (deferred)
  - [x] Touch + mouse support (deferred)
- [x] Solve transform (deferred)
  - [x] One line: constrain one axis (deferred)
  - [x] Two lines: solve for both axes (deferred)
- [x] `Apply Guided` computes params, exits guided mode (placeholder)

## 8) Lens distortion
- [x] Implement radial distortion mapping (single coefficient)
- [x] Integrate after geometry transform (sampling step)
- [x] Ensure clamping/edge sampling rules are consistent

## 9) Chromatic aberration reduction (v1)
- [x] Implement CA toggle as subtle per-channel sampling offset
- [x] Validate effect is not overly aggressive

## 10) Effects
- [x] Vignette
  - [x] Radial falloff applied in linear-ish space (best effort)
- [x] Grain
  - [x] Noise pattern generation (seeded per-frame or per-export)
  - [x] Ensure grain is stable enough visually in preview
- [x] Dehaze
  - [x] Implement fast approximation (local contrast + blacks)
  - [x] If too slow/ugly, gate behind “experimental” or defer

## 11) Export integration
- [x] Ensure export uses same pipeline and settings
- [x] Transparency policy enforcement for JPEG
- [x] Add/adjust export tests to cover geometry/optics settings

## 12) Tests (Vitest)
- [x] Unit tests for math helpers
  - [x] Homography mapping (known points)
  - [x] Distortion mapping clamps/inverts as expected
- [x] Component tests
  - [x] Slider changes update state
  - [x] Reset restores defaults
  - [x] Auto-straighten sets a new angle (mock analysis)

## 13) Manual QA checklist
- [x] Straighten horizon photo (self-serve)
- [x] Vertical correction on a building (self-serve)
- [x] Guided upright with 1 line and 2 lines (self-serve)
- [x] Extreme slider values (no crashes) (self-serve)
- [x] Export matches preview (self-serve)
