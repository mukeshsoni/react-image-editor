# Details — Denoise (Noise Reduction) — Task Checklist

Source PRD: `prds/details-denoise-prd.md`

## 1) State + Types
- [x] Add `DenoiseSettings` type (`luminance`, `color`, `detail`)
- [x] Define `DEFAULT_DENOISE_SETTINGS` (neutral defaults)
- [x] Add `denoise` to Zustand store state (or extend existing `adjustments`)
- [x] Add action: `setDenoise(partial)` (or reuse existing `setAdjustment` pattern)
- [x] Add action: `resetDenoise()`
- [x] Ensure settings persist across crop/zoom/pan interactions
- [x] Ensure export snapshot includes denoise parameters (`getEdits()` or equivalent)

## 2) Denoise Math (non-destructive)
- [x] Create pure helper module for denoise math
- [x] Decide internal representation (0–255 vs 0–1 floats); keep consistent with other adjustments
- [x] Add RGB <-> luma/chroma conversion helpers (preserve alpha)
- [x] Implement luminance denoise:
  - [x] Edge-aware smoothing approximation (small kernel / low taps)
  - [x] Map `luminance` slider to smoothing strength
- [x] Implement color denoise:
  - [x] Smooth chroma channels separately
  - [x] Map `color` slider to smoothing strength
- [x] Implement `detail` control:
  - [x] Increase edge preservation at higher values
  - [x] Ensure low detail increases smoothing in flat areas
- [x] Preserve alpha channel in all operations
- [x] Clamp output channels safely (avoid overflow/underflow)
- [x] Ensure neutral settings (`luminance=0`, `color=0`) produce identical output

## 3) Rendering Integration
- [x] Identify canonical “base image” source used for rendering
- [x] Insert denoise into the render pipeline
- [x] Ensure denoise runs before sharpening (recommended order)
- [x] Ensure neutral denoise produces identical output
- [x] Add/extend `requestAnimationFrame` throttling for slider updates
- [x] Avoid re-allocating large buffers per tick (reuse buffers where possible)
- [x] Cache intermediate raster(s) to reduce repeated work during drag
- [ ] Optional: reduce resolution during active drag; re-render full quality on pointer-up
- [x] Confirm ordering with other adjustments is consistent (document chosen order)

## 4) UI: Details Panel — Noise Reduction Section
- [ ] Add a section titled `Noise Reduction` under `Details`, below `Sharpening`
- [ ] Add three labeled rows: Luminance, Color, Detail
- [ ] Add slider component for each row
- [ ] Show current numeric value on the right of each row
- [ ] Define slider min/max/step per control (match PRD ranges)
- [ ] Wire slider changes to store action
- [ ] Add “Reset” control to restore defaults (section-level required)
- [ ] Disable/guard controls when no image is loaded
- [ ] Add `aria-label`/`aria-labelledby` for each slider
- [ ] Confirm keyboard operation (arrow keys adjust by step)

## 5) Behavior + UX Validation (Manual QA)
- [ ] Verify denoise updates live while zoomed in (no lag spikes)
- [ ] Verify denoise while panning (no flicker)
- [ ] Verify denoise + sharpening interaction (denoise first; sharpening doesn’t amplify noise)
- [ ] Verify switching between modes/panels doesn’t reset values
- [ ] Confirm slider drag feels responsive on large images (target smooth drag)
- [ ] Validate extremes don’t look broken (smearing, banding, color shifts)
- [ ] Validate reset returns image to original appearance

## 6) Tests
- [ ] Unit test: neutral params produce identical output
- [ ] Unit test: alpha preservation
- [ ] Unit test: clamping behavior at extreme values
- [ ] Deterministic buffer tests (e.g., 5x5):
  - [ ] Luminance smoothing reduces variance in flat areas
  - [ ] Edge-aware behavior preserves a hard edge better at higher `detail`
  - [ ] Color denoise reduces chroma speckle without large luma shift
- [ ] Component test: Details accordion contains Noise Reduction controls
- [ ] Component test: sliders start at defaults
- [ ] Component test: slider change updates store state
- [ ] Component test: Reset restores defaults
- [ ] Integration-ish test ensuring render path consumes denoise settings and runs before sharpening

## 7) Follow-ups (out of scope, but next)
- [ ] Add expanded “Manual Noise Reduction” controls (contrast/smoothness) if needed
- [ ] Add a “Denoise…” modal flow (if product wants Lightroom parity)
- [ ] Consider WebGL shader path if CPU performance is insufficient
