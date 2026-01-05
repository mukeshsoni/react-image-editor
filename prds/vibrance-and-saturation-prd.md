# PRD: Vibrance and saturation

## Summary
Add a “Color” adjustment section to the React image editor with real-time controls for vibrance and saturation.

This extends the non-destructive adjustment pipeline beyond light and white balance to support creative color intensity edits.

## Goals
- Enable users to increase/decrease color intensity in real time.
- Keep edits non-destructive (parameters applied at render/export time).
- Maintain smooth interaction while zooming/panning/cropping and while dragging sliders.
- Establish a foundation for future color features (HSL, selective color, LUTs).

## Non-Goals (for this PRD)
- HSL (per-hue saturation/luminance shifts).
- Local color adjustments (brush/masks/gradients).
- Vibrance that is camera-profile aware / perceptual models requiring ICC profiles.
- Advanced gamut mapping / wide-gamut color management.

## User Stories
- As a user, I can increase vibrance to make muted colors pop without oversaturating skin tones.
- As a user, I can decrease vibrance to create a softer, more pastel look.
- As a user, I can increase saturation to make all colors more intense.
- As a user, I can reduce saturation to create a desaturated / near-monochrome look.
- As a user, I can reset vibrance and saturation to neutral defaults.

## UX / UI Requirements

### Placement
- Add a new panel/section labeled "Color" in the editor controls.
- Use existing shadcn/ui patterns for sliders/inputs, consistent spacing and typography.
- Ordering within the section: Vibrance first, Saturation second.

### Controls
For each adjustment:
- Slider control with a numeric value readout.
- Optional numeric input (nice-to-have) for precise entry.
- Reset per control (nice-to-have) and “Reset All” for the section (required).

### Defaults
- All adjustments default to neutral (no visual change).
- Reset returns to defaults.

### Preview Behavior
- Changes apply live to the rendered image (canvas) without requiring “Apply”.
- During active drag of a slider, preview should remain smooth (no jank).

### Accessibility
- All sliders have accessible labels.
- Keyboard operable slider adjustments (arrow keys).

## Adjustments: Definitions + Ranges
All values below are proposal defaults; final tuning should be guided by visual testing.

### Vibrance
- Purpose: selectively boost saturation of less-saturated colors more than already-saturated colors; aims to avoid unnatural clipping/skin oversaturation compared to saturation.
- UI range: `-100 … +100`
- Default: `0`

### Saturation
- Purpose: uniformly increase/decrease color intensity across the image.
- UI range: `-100 … +100`
- Default: `0`

## Technical Requirements

### State model
- Add color fields to the editor state (Zustand) under the existing “adjustments” object (or a dedicated `colorAdjustments` object if the codebase already split light/WB).
- All adjustments must be serializable.
- Provide store actions (reuse existing patterns from other adjustment PRDs):
  - `setAdjustment(name, value)` (or `setColorAdjustment(name, value)` if the store is split)
  - `resetAdjustments()` (or `resetColorAdjustments()`)
  - `resetAdjustment(name)` (nice-to-have)

### Rendering pipeline
- Vibrance and saturation must be applied in the same non-destructive render pass as other adjustments (light/WB) to avoid repeated rasterization and extra allocations.
- Continue to support the same implementation strategy as existing adjustments:
  - Canvas 2D + ImageData processing (initial), with throttling/requestAnimationFrame and caching of the base raster.
  - WebGL shader pipeline as a future enhancement if CPU processing becomes too slow.

### Performance budget
- Slider drag should feel responsive; aim for preview update cadence ~30–60fps on typical laptop.
- Avoid allocating new large buffers on every input event.

### Export interaction
- Export/download should incorporate vibrance/saturation using the same parameter set that drives preview.
- Store should expose current parameters so export can apply them later.

## Algorithm Notes (high-level)

### Color space guidance
- Prefer applying saturation/vibrance in a perceptual-ish space to reduce hue shifts.
- Practical approaches:
  - Convert RGB → HSL/HSV: adjust saturation channel, then convert back.
  - Convert RGB → luma/chroma (simple Y’ + chroma): scale chroma relative to luma.

### Saturation (uniform)
- Simple approach:
  - Convert RGB to HSL/HSV.
  - Apply saturation scale factor `s' = clamp(s * (1 + sat/100), 0..1)`.
  - Convert back to RGB.

### Vibrance (selective)
- Goal: affect low-saturation pixels more than high-saturation pixels.
- Simple approach (built on saturation math):
  - Convert RGB to HSL/HSV.
  - Compute a weight `w` that is higher when saturation is low, e.g. `w = 1 - s`.
  - Apply `s' = clamp(s + (vibrance/100) * w * k, 0..1)` where `k` is a tuning constant.
- Tuning guidance:
  - Choose `k` such that `vibrance=+100` is visually meaningful but not cartoonish.
  - Consider reducing effect in highlights to avoid neon skies (nice-to-have).

## Edge Cases
- Images with alpha channel: preserve alpha.
- Grayscale / very low chroma images: vibrance should still be able to introduce modest color intensity changes only if chroma exists (otherwise no visible change).
- Highly saturated pixels: vibrance should have diminishing effect and avoid pushing channels to hard clip where possible.
- Extreme values: clamp channels to `[0, 255]` (or `[0, 1]` in float pipeline).

## Telemetry / Debug (optional)
- Add a small dev-only perf readout (ms per update) behind a flag, consistent with other adjustments.

## Acceptance Criteria
- A “Color” panel exists with vibrance and saturation controls.
- Each control updates the canvas preview live.
- Reset All restores defaults and returns preview to original.
- Values persist while switching between crop/zoom interactions (no unintended resets).
- No noticeable performance regression in zoom/pan relative to baseline when adjustments are neutral.

## Test Plan
- Unit tests for vibrance/saturation math helpers with known inputs/outputs (including clamping and alpha preservation).
- Component tests:
  - sliders render with defaults
  - changing a slider updates state
  - reset restores defaults
- (If feasible) add a small set of “golden pixel” tests on a tiny synthetic image buffer (e.g., 2x2) to validate expected transformation behavior.

## Open Questions
- Should vibrance be implemented via HSL/HSV saturation weighting, or via a luma/chroma approach to reduce hue shifts?
- Should saturation/vibrance be applied before or after white balance and light adjustments for best perceptual results?
- Do we need to cap vibrance/saturation based on luminance to avoid clipping highlights?
