# Light Adjustment Panel — Task Checklist

Source PRD: `prds/tone-and-color-adjustments.md`

## 1) State + Types
- [x] Add `LightAdjustments` type (exposure/contrast/highlights/shadows/whites/blacks)
- [x] Define `DEFAULT_LIGHT_ADJUSTMENTS` (all neutral)
- [x] Add `lightAdjustments` to Zustand store state
- [x] Add action: `setLightAdjustment(name, value)`
- [x] Add action: `resetLightAdjustments()`
- [x] Add action: `resetLightAdjustment(name)`
- [x] Ensure adjustments persist across crop/zoom/pan interactions
- [x] Ensure state is serializable and easy to extend later
- [x] Add `getEdits()` snapshot export for all edits

## 2) Adjustment Math (non-destructive)
- [x] Create pure helper module for applying light adjustments
- [x] Implement exposure (stops) adjustment
- [x] Implement contrast adjustment (mid-gray pivot)
- [x] Implement highlights recovery/compression (simple curve)
- [x] Implement shadows lift (simple curve)
- [x] Implement whites adjustment (white point / endpoint curve)
- [x] Implement blacks adjustment (black point / endpoint curve)
- [x] Preserve alpha channel in all operations
- [x] Clamp output channels safely (avoid overflow/underflow)
- [x] Decide internal representation (0–255 vs 0–1 floats) and document in code

## 3) Rendering Integration
- [x] Identify the canonical “base image” source used for rendering
- [x] Apply light adjustments in the render pipeline (non-destructive)
- [x] Ensure neutral settings produce identical output
- [x] Add `requestAnimationFrame` (or similar) throttling for slider updates
- [x] Avoid re-allocating large buffers per tick (reuse buffers where possible)
- [x] Cache intermediate raster(s) to reduce repeated work during drag
- [x] Ensure zoom/pan remains smooth while adjustments are active
- [x] Handle images with alpha correctly (no halos / artifacts)

## 4) UI: Light Panel (Accordion)
- [x] Add an accordion item titled `Light`
- [x] Add six labeled rows: Exposure, Contrast, Highlights, Shadows, Whites, Blacks
- [x] Add slider component for each row
- [x] Show current numeric value on the right of each row
- [x] Define slider min/max/step per control (match PRD ranges)
- [x] Choose display formatting (e.g., exposure `+1.2`, others integer with sign)
- [x] Wire slider changes to `setLightAdjustment`
- [x] Add “Reset All” button for the Light panel
- [x] Disable/guard controls when no image is loaded
- [x] Add `aria-label`/`aria-labelledby` for each slider
- [x] Confirm keyboard operation (arrow keys adjust by step)

## 5) Behavior + UX Validation
- [ ] Verify adjustments update live while zoomed in (no lag spikes)
- [ ] Verify adjustments while panning (no flicker)
- [ ] Verify switching between modes/panels doesn’t reset values
- [ ] Confirm slider drag feels responsive on large images (target smooth drag)
- [ ] Validate extremes don’t clip badly (basic sanity check)
- [ ] Validate reset returns image to original appearance

## 6) Tests
- [x] Unit tests for math helper (known input/output cases)
- [x] Unit test: alpha preservation
- [x] Unit test: clamping behavior
- [x] Component test: Light accordion renders and contains all six controls
- [x] Component test: sliders start at defaults
- [x] Component test: slider change updates store state
- [x] Component test: “Reset All” restores defaults
- [x] Integration-ish test ensuring render path consumes adjustments

## 7) Follow-ups (out of scope, but next)
- [x] Wire light adjustments into export/download pipeline
- [ ] Add histogram / levels visualization
- [ ] Add color panel (temperature/tint/vibrance/saturation)
