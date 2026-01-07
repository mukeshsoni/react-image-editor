# PRD: Detail panel — Sharpening

## Summary
Add a new editor accordion/panel labeled "Details" with a "Sharpening" section that provides real-time, non-destructive sharpening controls.

This PRD covers sharpening only. Denoising / noise reduction will be specified separately.

## Goals
- Let users increase perceived image crispness with predictable controls.
- Keep sharpening non-destructive (parameter-based; applied at render/export time).
- Maintain smooth interactions while dragging sliders (zoom/pan/crop still responsive).
- Provide a foundation for a future "Details" panel that also includes denoising.

## Non-Goals (for this PRD)
- Denoising / noise reduction (separate PRD).
- Local sharpening (brush, radial/linear gradients, subject masks).
- Frequency separation / advanced deconvolution sharpening.
- RAW-specific sharpening stages (capture vs creative vs output sharpening).

## User Stories
- As a user, I can increase sharpening to make the image look crisper.
- As a user, I can adjust radius to control how wide edges are sharpened.
- As a user, I can adjust detail to affect fine texture vs broad edges.
- As a user, I can use masking to reduce sharpening in smooth areas (skin/sky).
- As a user, I can reset sharpening back to neutral defaults.

## UX / UI Requirements

### Placement
- Add a new accordion/panel labeled "Details" in the editor control sidebar.
- Inside "Details", add a section labeled "Sharpening".
- "Sharpening" contains 4 sliders in this order:
  1. Amount
  2. Radius
  3. Detail
  4. Masking
- Use existing shadcn/ui patterns for sliders and typography; match spacing used in other adjustment panels.

### Controls
- Each control is a slider with a numeric readout.
- A "Reset" control resets sharpening to defaults (either per-section reset or a single reset for the entire Details panel; required at least for Sharpening).
- Changes apply immediately to the preview (no Apply button).

### Accessibility
- Each slider has an accessible label (e.g., `aria-label` or `<label for>`).
- Keyboard operable sliders (arrow keys) consistent with existing slider behavior.

## Sharpening Controls: Definitions + Ranges
All values below are proposed defaults and should be tuned via visual testing on a range of images.

### Amount
- Purpose: overall sharpening strength (edge contrast boost).
- UI range: `0 … 150`
- Default: `0`

### Radius
- Purpose: size of edges affected (blur radius used in unsharp mask).
- UI range: `0.5 … 3.0` (step `0.1`)
- Default: `1.0`

### Detail
- Purpose: bias sharpening toward fine texture vs broader edges.
- UI range: `0 … 100`
- Default: `25`

### Masking
- Purpose: protect smooth/low-texture areas from sharpening.
- UI range: `0 … 100`
- Default: `0`

## Preview & Export Behavior
- Preview and export use the same parameter set.
- Sharpening defaults to neutral (`Amount=0`) so existing renders remain unchanged.
- When sliders change, the canvas preview updates in real time.

## Technical Requirements

### State model
- Add a serializable sharpening state to the editor store (Zustand) under the existing adjustments structure (follow patterns used by other adjustment PRDs).
- Proposed shape (names are suggestions; match repo conventions):
  - `sharpening.amount: number`
  - `sharpening.radius: number`
  - `sharpening.detail: number`
  - `sharpening.masking: number`
- Provide actions:
  - `setSharpening(partial)` or `setAdjustment("sharpening.amount", value)` depending on existing patterns.
  - `resetSharpening()`.

### Rendering pipeline
- Sharpening must be applied in the same non-destructive render pass as other adjustments when feasible.
- Implementation should avoid repeated rasterization and unnecessary allocations.
- For v1, Canvas 2D + ImageData processing is acceptable; WebGL is a future optimization.

### Performance budget
- Slider drag should remain responsive; target preview refresh ~30–60fps on typical laptops for moderate image sizes.
- Prefer throttling via `requestAnimationFrame` and caching of the base raster.
- Avoid allocating new large intermediate buffers on every input event.

## Algorithm Notes (high-level)

### Baseline algorithm: Unsharp mask
- Compute a blurred version of the image using a separable Gaussian blur (or a close approximation).
- Compute high-frequency detail: `detail = original - blurred`.
- Add scaled detail back: `sharpened = original + amount * detail`.

### Radius
- Drives the blur kernel size/sigma.
- The UI `radius` maps to a sigma value; use a consistent mapping so that `radius=1.0` is visually meaningful.

### Detail (texture vs edges)
A simple, implementation-friendly approach:
- Compute an edge/texture weighting from the high-frequency signal (e.g., magnitude of detail per pixel).
- Use `detail` to bias weighting:
  - Low `detail` emphasizes larger edges (suppress very fine texture).
  - High `detail` preserves/increases fine texture sharpening.

### Masking (protect smooth areas)
A simple, implementation-friendly approach:
- Compute an edge mask from the high-frequency magnitude (or image gradient magnitude).
- Use `masking` to increase the threshold/steepness:
  - `masking=0` applies sharpening everywhere.
  - `masking=100` applies sharpening primarily to strong edges.

### Color handling
- Prefer sharpening luminance rather than RGB channels to reduce color halos.
  - Example: compute luma (e.g., Rec.709) from RGB, sharpen luma, then recombine by scaling RGB toward the sharpened luma while preserving chroma.
- Preserve alpha channel.

## Edge Cases
- Very small images: radius should clamp to a safe effective kernel.
- Images with alpha: preserve alpha; do not introduce dark fringes around transparent edges.
- High amount + small radius can introduce noise/halos; clamp to avoid extreme overshoot.
- Ensure values are clamped to valid channel ranges (`0..255` or `0..1`).

## Acceptance Criteria
- A new "Details" accordion exists with a "Sharpening" section.
- Four sharpening sliders render with the specified labels and defaults.
- Adjusting any slider updates the preview immediately.
- Reset returns all sharpening controls to defaults and restores the preview.
- Sharpening settings persist across other interactions (zoom/pan/crop) without unintended resets.
- Export/download incorporates sharpening exactly as previewed.

## Test Plan
- Unit tests for sharpening math helpers:
  - Amount=0 produces identical output.
  - Clamping behavior for extreme values.
  - Alpha preservation.
- (If feasible) "golden pixel" tests on small synthetic buffers (e.g., 3x3, 5x5) to validate unsharp mask behavior deterministically.
- Component tests:
  - Sliders render with default values.
  - Slider interaction updates store state.
  - Reset restores defaults.

## Open Questions
- Should we implement blur via separable Gaussian, box blur approximation, or an existing utility already in the repo?
- Exact mapping from UI `radius` to blur sigma/kernel size.
- Best approach for Detail/Masking that is both visually pleasing and performant on CPU.
- Where sharpening should be applied in the adjustment order (before/after tone/color/WB) for best results.
