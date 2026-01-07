# PRD: Detail panel — Denoise (Noise Reduction)

## Summary
Add a new “Noise Reduction” section under the existing “Details” panel, providing real-time, non-destructive denoising controls.

This PRD covers denoising only and is intended to complement the existing sharpening feature.

## Goals
- Reduce visible noise (especially in shadows/flat areas) with predictable controls.
- Keep denoising non-destructive (parameter-based; applied at render/export time).
- Maintain smooth interactions while dragging sliders (zoom/pan/crop remain responsive).
- Provide a scalable foundation for additional detail tools (e.g., manual luminance/color noise controls).

## Non-Goals (for this PRD)
- AI “enhance” / super-resolution / face-aware denoise.
- Local denoise (brush/masks/subject selection).
- RAW-specific noise reduction or camera profile behavior.
- Chromatic aberration correction.
- A full Lightroom-style split between “Denoise…” modal and “Manual Noise Reduction” (v1 will ship a compact control set).

## User Stories
- As a user, I can reduce noise/grain to make photos look cleaner.
- As a user, I can preserve details while denoising (avoid plastic look).
- As a user, I can reduce color speckles separately from luminance noise.
- As a user, I can reset denoise back to neutral defaults.

## UX / UI Requirements

### Placement
- Inside the existing “Details” panel/accordion, add a new section labeled “Noise Reduction”.
- The section is shown below “Sharpening”.

### Controls (v1)
Provide 3 sliders (ordered):
1. Luminance
2. Color
3. Detail

Notes:
- These names align with common photo editors while keeping the set small.
- “Detail” is shared and affects preservation of texture/edges.

### Interaction
- Changes apply immediately to preview (no Apply button).
- Include a “Reset” control to restore denoise defaults (per-section reset is required).

### Accessibility
- Each slider has an accessible label (`aria-label` or `<label>` association).
- Sliders are keyboard operable consistent with existing slider behavior.

## Denoise Controls: Definitions + Ranges
All ranges are proposals; final tuning should be guided by visual testing.

### Luminance
- Purpose: reduce intensity noise (grain) in brightness.
- UI range: `0 … 100`
- Default: `0`

### Color
- Purpose: reduce chroma noise (colored speckles).
- UI range: `0 … 100`
- Default: `0`

### Detail
- Purpose: preserve edges/texture while denoising (higher detail = less smoothing around edges).
- UI range: `0 … 100`
- Default: `50`

## Preview & Export Behavior
- Preview and export use the same denoise parameter set.
- Defaults are neutral so existing renders remain unchanged.
- Denoise is applied as part of the non-destructive render pipeline.

## Adjustment Order (recommended)
Apply denoise before sharpening:
- Denoise reduces noise that would otherwise be amplified by sharpening.
- Sharpening then restores perceived crispness.

If the codebase already has an established order, denoise should be inserted accordingly but should remain before sharpening in the “detail” portion of the pipeline.

## Technical Requirements

### State model
- Add serializable denoise state to the same store area used for other adjustments.
- Proposed shape (names are suggestions; match repo conventions):
  - `denoise.luminance: number`
  - `denoise.color: number`
  - `denoise.detail: number`
- Provide actions:
  - `setDenoise(partial)` or `setAdjustment("denoise.luminance", value)` following existing patterns.
  - `resetDenoise()`.

### Rendering pipeline
- Denoise must run in the same render path as other adjustments.
- For v1, CPU processing via Canvas 2D + ImageData is acceptable.
- Must avoid large allocations on every pointer move; prefer:
  - `requestAnimationFrame` throttling.
  - Reuse of intermediate buffers when possible.
  - Caching base raster at the working resolution.

### Color space and channels
- Preserve alpha channel.
- Prefer operating on luminance for luminance noise reduction.
- Prefer operating on chroma for color noise reduction to avoid unwanted desaturation.

## Algorithm Notes (high-level)
The initial implementation should be simple, deterministic, and fast enough for interactive use.

### Baseline approach: edge-aware smoothing (CPU)
- Convert RGB to a luminance/chroma representation (e.g., YCbCr-like):
  - Luma (Y) for luminance denoise.
  - Chroma channels (Cb/Cr) for color denoise.
- Apply an edge-aware filter where smoothing is reduced across edges:
  - A pragmatic option for v1 is a guided/edge-aware blur approximation:
    - Compute local differences vs neighbors.
    - Weight neighbor contributions by similarity to center pixel.

### Mapping controls to behavior
- `luminance` increases smoothing strength on Y.
- `color` increases smoothing strength on chroma channels.
- `detail` increases edge preservation:
  - Higher detail -> stricter similarity threshold / sharper weights -> less smoothing at edges.
  - Lower detail -> more permissive weights -> smoother result.

### Kernel / neighborhood
- Use a small fixed neighborhood (e.g., radius 1–2) for interactive preview.
- If performance is insufficient, prefer lowering working resolution during active drag (optional) and re-render at full quality on pointer-up.

### Performance considerations
- A naive bilateral filter can be expensive; v1 should aim for a simplified, low-tap, edge-aware approximation.
- Implementation should clamp output to valid ranges and avoid banding.

## Edge Cases
- Small images: filtering should not introduce halos; clamp neighborhood bounds.
- Transparent images: preserve alpha; avoid color bleed into transparent regions.
- Strong denoise can remove texture; keep default neutral and clamp extremes.
- Ensure channel values are clamped to `[0..255]` (or `[0..1]` if using float pipeline).

## Acceptance Criteria
- “Noise Reduction” section exists under “Details”, below “Sharpening”.
- Sliders render with labels and defaults: `Luminance=0`, `Color=0`, `Detail=50`.
- Adjusting any slider updates preview immediately.
- Reset returns denoise controls to defaults and restores preview.
- Denoise settings persist across zoom/pan/crop interactions without unintended resets.
- Export/download incorporates denoise exactly as previewed.
- Denoise is applied before sharpening in the pipeline.

## Test Plan
- Unit tests for denoise helpers:
  - Neutral params (`luminance=0`, `color=0`) produce identical output.
  - Alpha preservation.
  - Output clamping.
- Small deterministic buffers (e.g., 5x5) to validate that:
  - Luminance smoothing reduces variance in flat areas.
  - Edge-aware behavior preserves a hard edge better at higher `detail`.
- Component tests:
  - Sliders render with defaults.
  - Slider interaction updates store state.
  - Reset restores defaults.

## Open Questions
- Should v1 ship as 3 sliders (recommended) or mirror Lightroom’s “Manual Noise Reduction” with additional controls (contrast/smoothness)?
- Should we add a simple “Preview: 1:1” toggle / zoom shortcut to evaluate noise changes (nice-to-have)?
- If CPU performance is insufficient, do we:
  - reduce resolution during drag, or
  - prioritize a WebGL shader implementation?
