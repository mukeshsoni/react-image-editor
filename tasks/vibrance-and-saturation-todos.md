# Vibrance + Saturation — Task Checklist

Source PRD: `prds/vibrance-and-saturation-prd.md`

## 1) State + Types
- [x] Add `ColorAdjustments` type (`vibrance`, `saturation`)
- [x] Define `DEFAULT_COLOR_ADJUSTMENTS` (all neutral)
- [x] Add `colorAdjustments` to Zustand store state (or extend existing `adjustments`)
- [x] Add action: `setColorAdjustment(name, value)` (or reuse `setAdjustment`)
- [x] Add action: `resetColorAdjustments()` (or reuse `resetAdjustments`)
- [x] Add action: `resetColorAdjustment(name)` (nice-to-have)
- [x] Ensure adjustments persist across crop/zoom/pan interactions
- [x] Ensure edits snapshot export includes color adjustments (`getEdits()` or equivalent)

## 2) Adjustment Math (non-destructive)
- [x] Create pure helper module for applying vibrance/saturation
- [x] Pick internal math space (HSL/HSV vs luma/chroma) and keep it consistent (HSL)
- [x] Implement saturation adjustment (uniform)
- [x] Implement vibrance adjustment (diminishing effect at high saturation)
- [x] Preserve alpha channel in all operations
- [x] Clamp output channels safely (avoid overflow/underflow)

## 3) Rendering Integration
- [x] Identify canonical “base image” source used for rendering
- [x] Apply color adjustments in the same adjustment pipeline as WB/Light
- [x] Ensure neutral settings produce identical output
- [x] Add/extend `requestAnimationFrame` throttling for slider updates
- [x] Avoid re-allocating large buffers per tick (reuse buffers where possible)
- [x] Confirm ordering with other adjustments (WB/Light) is consistent

## 4) UI: Color Panel (Accordion)
- [x] Add an accordion item titled `Color`
- [x] Add two labeled rows: Vibrance, Saturation
- [x] Add slider component for each row
- [x] Show current numeric value on the right of each row
- [x] Define slider min/max/step per control (match PRD ranges)
- [x] Wire slider changes to store action
- [x] Add “Reset All” button for the Color panel
- [x] Disable/guard controls when no image is loaded
- [x] Add `aria-label`/`aria-labelledby` for each slider
- [x] Confirm keyboard operation (arrow keys adjust by step)

## 5) Behavior + UX Validation
- [ ] Verify adjustments update live while zoomed in (no lag spikes)
- [ ] Verify adjustments while panning (no flicker)
- [ ] Verify switching between modes/panels doesn’t reset values
- [ ] Confirm slider drag feels responsive on large images (target smooth drag)
- [ ] Validate extremes don’t look broken (clipping/banding sanity check)
- [ ] Validate reset returns image to original appearance

Note: these are manual QA checks.

## 6) Tests
- [x] Unit tests for saturation helper (known input/output cases)
- [x] Unit tests for vibrance helper (diminishing effect + clamping)
- [x] Unit test: alpha preservation
- [x] Component test: Color accordion renders and contains both controls
- [x] Component test: sliders start at defaults
- [x] Component test: slider change updates store state
- [x] Component test: “Reset All” restores defaults
- [ ] Integration-ish test ensuring render path consumes color adjustments

## 7) Follow-ups (out of scope, but next)
- [ ] Consider WebGL shader path if CPU performance is insufficient
- [ ] Add HSL panel (per-hue adjustments)
- [ ] Add LUT support / creative profiles
