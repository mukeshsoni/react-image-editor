# Tone Curve — Task Checklist

Source PRD: `prds/tone-curve-prd.md`

## 1) State + Types
- [ ] Add `ToneCurveChannel` union (`rgb` | `r` | `g` | `b`)
- [ ] Add `CurvePoint` type (`{ x, y }` in 0..1)
- [ ] Add `ToneCurveSettings` type (mode, activeChannel, point curves, parametric sliders)
- [ ] Define `DEFAULT_TONE_CURVE` (identity curves + zero sliders)
- [ ] Add `toneCurve` to Zustand store state
- [ ] Add store actions:
  - [ ] `setToneCurveMode(mode)`
  - [ ] `setToneCurveChannel(channel)`
  - [ ] `setToneCurvePoints(channel, points)`
  - [ ] `setToneCurveParametricRgb(partial)`
  - [ ] `resetToneCurve()`
- [ ] Include tone curve in edits snapshot export (`getEdits()`)

## 2) Curve Math + LUTs (Pure helpers)
- [ ] Create `src/lib/tone-curve.ts` pure module
- [ ] Implement point-curve validation:
  - [ ] clamp to 0..1
  - [ ] enforce endpoints
  - [ ] enforce increasing X
- [ ] Implement interpolation strategy (monotone cubic preferred)
- [ ] Generate LUT (256 or 1024 entries) for point curves
- [ ] Implement parametric curve LUT from region sliders (highlights/lights/darks/shadows)
- [ ] Combine LUTs: RGB master then per-channel
- [ ] Apply LUTs to RGBA bytes (preserve alpha, clamp)

## 3) Rendering Integration
- [ ] Integrate tone curve into preview pipeline (`src/ReactImageEditor.tsx`)
- [ ] Ensure neutral settings produce identical output
- [ ] Cache LUTs and recompute only when tone curve changes
- [ ] Ensure render throttle remains smooth during drag (requestAnimationFrame)

## 4) Export Integration
- [ ] Integrate tone curve into `src/export-download.ts` committed render path
- [ ] Ensure export matches preview output

## 5) UI: Tone Curve Panel
- [ ] Add `Tone Curve` section in controls
- [ ] Add channel selector (RGB / R / G / B) with active styling
- [ ] Add curve editor canvas/SVG:
  - [ ] draw grid + identity line
  - [ ] draw curve for active channel
  - [ ] draw control points
  - [ ] click to add point
  - [ ] drag to move point
  - [ ] delete point (except endpoints)
- [ ] Add Region sliders: Highlights/Lights/Darks/Shadows
- [ ] Add Reset button (and nice-to-have per-channel reset)
- [ ] Add accessibility labels and keyboard basics

## 6) Behavior + UX Validation (Manual)
- [ ] Dragging points updates preview live (no lag spikes)
- [ ] Sliders update preview live (no flicker)
- [ ] Channel switching feels intuitive and preserves edits
- [ ] Reset returns to identity
- [ ] Extreme curves don’t look broken (banding/clipping sanity check)

## 7) Tests
- [ ] Unit tests:
  - [ ] identity LUT
  - [ ] simple curve changes mapping
  - [ ] per-channel application
  - [ ] parametric curve mask behavior
  - [ ] alpha preservation + clamping
- [ ] Component tests:
  - [ ] panel renders controls
  - [ ] channel toggle updates active state
  - [ ] reset restores defaults
- [ ] Integration-ish test:
  - [ ] tiny synthetic image buffer produces expected pixel changes

## 8) Follow-ups (out of scope, but next)
- [ ] Add histogram + levels UI
- [ ] Add curve presets (medium/strong contrast)
- [ ] Add point nudge via keyboard and better focus UX
