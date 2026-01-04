# PRD: Light adjustment panel

## Summary
Add a “Light” adjustment panel to the React image editor with real-time controls for exposure, contrast, highlights, shadows, whites, and blacks.

This is the first step toward a non-destructive editing pipeline beyond crop/zoom/rotate.

## Goals
- Enable users to make basic global image adjustments in real time.
- Keep edits non-destructive (adjustments are parameters, not permanent pixel mutations until export).
- Preserve interactive performance while zooming/panning/cropping.
- Establish an extensible adjustment pipeline for future features (curves/HSL/local adjustments).

## Non-Goals (for this PRD)
- RAW file decoding or demosaic.
- Local adjustments (brush/masks/gradients).
- Color controls (temperature/tint/vibrance/saturation) and clarity.
- Curves/levels, HSL, split toning, LUTs.
- Auto white balance / WB picker (covered by a separate roadmap item).

## User Stories
- As a user, I can adjust exposure/contrast to quickly improve a photo.
- As a user, I can recover highlights and lift shadows.
- As a user, I can fine-tune whites and blacks to set the endpoints.
- As a user, I can reset all adjustments to defaults.
- As a user, I can see changes immediately while zoomed in.

## UX / UI Requirements
### Placement
- Add a new panel/section labeled "Light" in the editor controls.
- Use existing shadcn/ui patterns for controls (sliders/inputs), consistent spacing and typography.

### Controls
For each adjustment:
- Slider control with a numeric value readout.
- Optional numeric input (nice-to-have) for precise entry.
- Reset button per control (nice-to-have) and “Reset All” for the section (required).

### Defaults
- All adjustments default to neutral (no visual change).
- Reset returns to defaults.

### Preview Behavior
- Changes apply live to the rendered image (canvas) without requiring “Apply”.
- During active drag of a slider, the preview should remain smooth (no jank).

### Accessibility
- All sliders have accessible labels.
- Keyboard operable slider adjustments (arrow keys).

## Adjustments: Definitions + Ranges
All values below are proposal defaults; final tuning should be guided by visual testing.

### Exposure
- Purpose: brighten/darken image overall.
- UI range: `-2.0 … +2.0` stops
- Default: `0.0`

### Contrast
- Purpose: increase/decrease tonal separation.
- UI range: `-100 … +100`
- Default: `0`

### Highlights
- Purpose: recover bright areas.
- UI range: `-100 … +100`
- Default: `0`

### Shadows
- Purpose: lift dark areas.
- UI range: `-100 … +100`
- Default: `0`

### Whites
- Purpose: set/adjust the white point (brightest tones).
- UI range: `-100 … +100`
- Default: `0`

### Blacks
- Purpose: set/adjust the black point (darkest tones).
- UI range: `-100 … +100`
- Default: `0`

## Technical Requirements
### State model
- Add a single “adjustments” object in the editor state (Zustand) with all fields and defaults.
- All adjustments must be serializable.
- Provide store actions:
  - `setAdjustment(name, value)`
  - `resetAdjustments()`
  - `resetAdjustment(name)` (nice-to-have)

### Rendering pipeline
Support two implementation paths; choose one for the first implementation and keep the other as a future enhancement.

#### Option A (Initial): Canvas 2D + ImageData processing
- Pros: no new dependencies, simple to reason about.
- Cons: pixel processing can be expensive for large images.

Requirements:
- Process pixels off the main interaction loop (throttle / requestAnimationFrame).
- Cache the “base” image raster at current zoom/output resolution to avoid recomputing from original on every slider tick.

#### Option B (Future): WebGL shader pipeline
- Pros: fast per-frame, scales better.
- Cons: more complexity, testing overhead.

Decision driver:
- If Option A cannot maintain smooth updates on typical images (e.g., 2000–4000px) while dragging sliders, prioritize WebGL.

### Performance budget
- Slider drag should feel responsive; aim for preview update cadence ~30–60fps on typical laptop.
- Avoid re-decoding images or reallocating large buffers on every input event.

### Export interaction
- Export/download (separate roadmap item) should incorporate these adjustments.
- For now, store should expose current adjustment parameters so export can apply them later.

## Algorithm Notes (high-level)
- Exposure: multiply RGB by `2^exposure`.
- Contrast: apply slope around mid-gray (e.g., 0.5) with clamp.
- Highlights/Shadows: apply tone curve / luma-based lift/compress (simple approach acceptable initially).
- Whites/Blacks: adjust endpoints (white/black point) with a gentle curve + clamp.

## Edge Cases
- Images with alpha channel: preserve alpha.
- Extreme values: clamp channels to `[0, 255]` (or `[0, 1]` in float pipeline).
- Very small images: controls still function.

## Telemetry / Debug (optional)
- Add a small dev-only perf readout (ms per update) behind a flag.

## Acceptance Criteria
- A “Light” panel exists with exposure/contrast/highlights/shadows/whites/blacks controls.
- Each control updates the canvas preview live.
- Reset All restores defaults and returns preview to original.
- Values persist while switching between crop/zoom interactions (no unintended resets).
- No noticeable performance regression in zoom/pan relative to baseline when adjustments are neutral.

## Test Plan
- Unit tests for adjustment math helpers with known inputs/outputs.
- Component tests:
  - sliders render with defaults
  - changing a slider updates state
  - reset restores defaults
- (If feasible) a visual regression snapshot approach may be added later.

## Open Questions
- Where should the panel live relative to crop controls?
- Should temperature/tint use a more physically-based model (Kelvin) or keep unitless sliders?
- Do we want “Auto” buttons for exposure/WB later?
- Should clarity ship in v1 or be gated behind a feature flag?
