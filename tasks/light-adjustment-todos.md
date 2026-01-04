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
- [ ] Create pure helper module for applying light adjustments
- [ ] Implement exposure (stops) adjustment
- [ ] Implement contrast adjustment (mid-gray pivot)
- [ ] Implement highlights recovery/compression (simple curve)
- [ ] Implement shadows lift (simple curve)
- [ ] Implement whites adjustment (white point / endpoint curve)
- [ ] Implement blacks adjustment (black point / endpoint curve)
- [ ] Preserve alpha channel in all operations
- [ ] Clamp output channels safely (avoid overflow/underflow)
- [ ] Decide internal representation (0–255 vs 0–1 floats) and document in code

## 3) Rendering Integration
- [ ] Identify the canonical “base image” source used for rendering
- [ ] Apply light adjustments in the render pipeline (non-destructive)
- [ ] Ensure neutral settings produce identical output
- [ ] Add `requestAnimationFrame` (or similar) throttling for slider updates
- [ ] Avoid re-allocating large buffers per tick (reuse buffers where possible)
- [ ] Cache intermediate raster(s) to reduce repeated work during drag
- [ ] Ensure zoom/pan remains smooth while adjustments are active
- [ ] Handle images with alpha correctly (no halos / artifacts)

## 4) UI: Light Panel (Accordion)
- [ ] Add an accordion item titled `Light`
- [ ] Add six labeled rows: Exposure, Contrast, Highlights, Shadows, Whites, Blacks
- [ ] Add slider component for each row
- [ ] Show current numeric value on the right of each row
- [ ] Define slider min/max/step per control (match PRD ranges)
- [ ] Choose display formatting (e.g., exposure `+1.2`, others integer with sign)
- [ ] Wire slider changes to `setLightAdjustment`
- [ ] Add “Reset All” button for the Light panel
- [ ] Disable/guard controls when no image is loaded
- [ ] Add `aria-label`/`aria-labelledby` for each slider
- [ ] Confirm keyboard operation (arrow keys adjust by step)

## 5) Behavior + UX Validation
- [ ] Verify adjustments update live while zoomed in (no lag spikes)
- [ ] Verify adjustments while panning (no flicker)
- [ ] Verify switching between modes/panels doesn’t reset values
- [ ] Confirm slider drag feels responsive on large images (target smooth drag)
- [ ] Validate extremes don’t clip badly (basic sanity check)
- [ ] Validate reset returns image to original appearance

## 6) Tests
- [ ] Unit tests for math helper (known input/output cases)
- [ ] Unit test: alpha preservation
- [ ] Unit test: clamping behavior
- [ ] Component test: Light accordion renders and contains all six controls
- [ ] Component test: sliders start at defaults
- [ ] Component test: slider change updates store state
- [ ] Component test: “Reset All” restores defaults
- [ ] (If feasible) integration-ish test ensuring render path consumes adjustments

## 7) Follow-ups (out of scope, but next)
- [ ] Wire light adjustments into export/download pipeline
- [ ] Add histogram / levels visualization
- [ ] Add color panel (temperature/tint/vibrance/saturation)
