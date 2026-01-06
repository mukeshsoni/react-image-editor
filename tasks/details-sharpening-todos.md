# Details — Sharpening — Task Checklist

Source PRD: `prds/details-sharpening-prd.md`

## 1) State + Types
- [ ] Add `SharpeningSettings` type (`amount`, `radius`, `detail`, `masking`)
- [ ] Define `DEFAULT_SHARPENING_SETTINGS` (neutral defaults)
- [ ] Add `sharpening` to Zustand store state (or extend existing `adjustments`)
- [ ] Add action: `setSharpening(partial)` (or reuse existing `setAdjustment` pattern)
- [ ] Add action: `resetSharpening()`
- [ ] Ensure settings persist across crop/zoom/pan interactions
- [ ] Ensure export snapshot includes sharpening parameters (`getEdits()` or equivalent)

## 2) Sharpening Math (non-destructive)
- [ ] Create pure helper module for sharpening math
- [ ] Implement blur (separable Gaussian or approximation)
- [ ] Implement unsharp mask: `out = original + amount * (original - blurred)`
- [ ] Implement luminance-first sharpening to reduce color halos
- [ ] Implement `detail` control weighting (texture vs edges)
- [ ] Implement `masking` control (edge mask / threshold)
- [ ] Preserve alpha channel in all operations
- [ ] Clamp output channels safely (avoid overflow/underflow)

## 3) Rendering Integration
- [ ] Identify canonical “base image” source used for rendering
- [ ] Apply sharpening in the same adjustment pipeline as WB/Light/Color
- [ ] Ensure neutral settings produce identical output
- [ ] Add/extend `requestAnimationFrame` throttling for slider updates
- [ ] Avoid re-allocating large buffers per tick (reuse buffers where possible)
- [ ] Confirm ordering with other adjustments is consistent (document chosen order)

## 4) UI: Details Accordion + Sharpening Section
- [ ] Add an accordion item titled `Details`
- [ ] Add a section titled `Sharpening`
- [ ] Add four labeled rows: Amount, Radius, Detail, Masking
- [ ] Add slider component for each row
- [ ] Show current numeric value on the right of each row
- [ ] Define slider min/max/step per control (match PRD ranges)
- [ ] Wire slider changes to store action
- [ ] Add “Reset” control to restore defaults (section-level or Details-level)
- [ ] Disable/guard controls when no image is loaded
- [ ] Add `aria-label`/`aria-labelledby` for each slider
- [ ] Confirm keyboard operation (arrow keys adjust by step)

## 5) Behavior + UX Validation (Manual QA)
- [ ] Verify sharpening updates live while zoomed in (no lag spikes)
- [ ] Verify sharpening while panning (no flicker)
- [ ] Verify switching between modes/panels doesn’t reset values
- [ ] Confirm slider drag feels responsive on large images (target smooth drag)
- [ ] Validate extremes don’t look broken (halos/noise/clipping sanity check)
- [ ] Validate reset returns image to original appearance

## 6) Tests
- [ ] Unit test: amount=0 produces identical output
- [ ] Unit test: clamping behavior at extreme values
- [ ] Unit test: alpha preservation
- [ ] Golden pixel tests on small synthetic buffers (e.g., 5x5) for unsharp mask
- [ ] Component test: Details accordion renders and contains Sharpening controls
- [ ] Component test: sliders start at defaults
- [ ] Component test: slider change updates store state
- [ ] Component test: Reset restores defaults
- [ ] Integration-ish test ensuring render path consumes sharpening settings

## 7) Follow-ups (out of scope, but next)
- [ ] Add denoising section + PRD alignment
- [ ] Consider WebGL shader path if CPU performance is insufficient
- [ ] Add output sharpening (resize-aware) for export
