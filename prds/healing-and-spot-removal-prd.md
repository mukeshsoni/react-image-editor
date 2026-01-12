# PRD: Healing & Spot Removal

## Summary
Add a “Healing” tool to the React image editor that lets users remove small blemishes/dust spots by painting strokes on the image.

Initial scope focuses on spot removal and a basic healing brush (clone + blend). A future enhancement can add content-aware fill for larger object removal.

## Goals
- Enable spot removal via an interactive brush tool.
- Provide a healing brush mode that blends seamlessly with surrounding texture.
- Keep the editor workflow non-destructive: store stroke operations/parameters and re-render from the original image.
- Ensure performance is smooth while brushing, zooming, and panning.
- Integrate with Undo/Redo (at least per-stroke) to support iterative retouching.

## Non-Goals (for this PRD)
- Full content-aware fill / inpainting for large object removal (v2).
- Frequency separation, advanced texture synthesis, or ML-based healing.
- Layer system, masks, or local adjustment stacks beyond the healing strokes.
- Pressure-sensitive brush dynamics (Apple Pencil / stylus) (nice-to-have later).

## User Stories
- As a user, I can click a dust spot to remove it.
- As a user, I can select a spot after creating it and adjust the sampled/source area.
- As a user, I can paint over a blemish and have it blend into surrounding pixels.
- As a user, I can adjust brush size and hardness/feather.
- As a user, I can switch between Spot, Clone, and Heal modes.
- As a user, I can undo/redo a stroke.
- As a user, I can reset/clear all healing strokes.

## UX / UI Requirements

### Tool placement
- Add a new tool in the main controls labeled `Healing`.
- When active, show a tool subpanel with:
  - Mode selector: `Spot`, `Heal`, `Clone`.
  - Brush controls: size (required), feather/hardness (required), opacity (nice-to-have).
  - Actions: `Undo`, `Redo` (if available), `Clear` (remove all strokes).

### Cursor + interaction
- Show a circular brush cursor over the canvas when Healing is active.
- Brush cursor size reflects the current brush size (in screen pixels, scaled with zoom).
- Pan/zoom behavior:
  - When Healing tool is active, primary drag paints.
  - Provide a modifier for pan (e.g., Space + drag) or a dedicated “hand” toggle to pan while Healing.

### Stroke visualization
- While painting, show a live overlay preview of the stroke mask/area.
- After completion, optionally show a subtle outline on hover/selection (nice-to-have).

### Pins (Lightroom-style)
- Each spot creates a target pin and a sampled/source pin connected by a line.
- Users can click a target pin to select that spot.
- When selected, users can drag the sampled/source pin to change the sampled area.
- Pins should be hidden when Healing tool is inactive.

### Accessibility
- Controls are keyboard accessible.
- Provide clear ARIA labels for sliders and mode selector.

## Tool Modes

### Spot removal (tap)
- User taps/clicks a point; editor applies a circular heal/clone patch with feathering.
- Intended for dust spots and small blemishes.
- A spot operation stores both:
  - target center
  - sampled/source point (auto-picked initially, user-adjustable via pin drag)

### Healing brush (stroke)
- User paints a stroke; the editor fills the stroke region using sampled source pixels plus blending.
- Should reduce seams vs simple cloning.

### Clone stamp (stroke)
- User picks a source point, then paints to copy from source to destination.
- Useful when healing fails (e.g., edges, repeated patterns).

## Parameters + Ranges
- Brush size: `5 … 200` px (UI can clamp; allow future scaling)
- Feather (hardness inverse): `0 … 100` (0 = hard edge, 100 = very soft)
- Opacity (nice-to-have): `0 … 100` (default 100)

## Technical Requirements

### State model
- Add a new non-destructive edits model:
  - `healing`: array of operations (strokes and spots)
  - Each operation should be serializable and versioned.

Suggested types:
- `HealingMode = "spot" | "heal" | "clone"`
- `HealingBrushSettings = { size: number; feather: number; opacity: number }`
- `HealingOp = SpotOp | StrokeOp`
  - `SpotOp`: `{ id, mode: "spot" | "heal"; center: {x,y}; radius; feather; opacity; source?: {x,y} }`
  - `StrokeOp`: `{ id, mode: "heal" | "clone"; points: Point[]; radius; feather; opacity; source?: {x,y} }`

Actions:
- `addHealingOp(op)`
- `removeHealingOp(id)` / `clearHealingOps()`
- `setHealingBrushSettings(partial)`
- `setHealingMode(mode)`

### Coordinate system
- Store stroke points in image space (not canvas space), so edits remain stable across zoom/pan.
- Convert pointer events (canvas coords) → image coords using existing zoom/pan/rotation mappings.

### Rendering pipeline
- Healing must be applied as part of the non-destructive render pipeline.
- For preview performance:
  - Maintain an offscreen working canvas at the current preview resolution.
  - Apply incremental updates while painting (don’t re-run the entire pipeline on every point).
  - Consider simplifying stroke points during drag (e.g., distance threshold) to reduce work.

### Algorithms (high-level)
Initial implementation can be pragmatic and iterative.

- **Clone**:
  - Sample pixels from a source region offset from destination.
  - Composite into destination with feathered mask and opacity.

- **Heal** (v1 approximation):
  - Clone from source region, then blend with destination luminance to reduce seams.
  - A simple approach is to blend in RGB with a feather mask plus luma matching.

- **Spot**:
  - Auto-pick a source region around the spot (e.g., sample from a ring around the radius).
  - Apply heal/clone patch with feather.

### Undo/Redo integration
- Treat each completed stroke as a single history entry.
- Undo should remove the last healing op.
- Redo should restore it.

### Export interaction
- Export must apply healing operations to the committed image along with crop/rotation and adjustments.
- Ensure deterministic output between preview and export.

## Edge Cases
- Very large images: ensure tooling remains usable; consider downscaled preview with full-res export.
- Alpha channel images: preserve alpha when sampling/compositing.
- Rotated images: ensure pointer mapping is correct.
- Tainted canvas (cross-origin without CORS): disable healing with a clear message.

## Acceptance Criteria
- Healing tool can be activated and deactivated.
- User can perform a spot removal action and see live preview.
- User can paint a healing stroke and see the effect applied.
- Brush size + feather controls work and affect output.
- Undo removes the most recent stroke; redo restores it (at least per-stroke).
- Clearing operations returns image to original state.
- No major performance regression when Healing is inactive.

## Test Plan
- Unit tests:
  - image-space coordinate mapping (canvas → image) for pointer points
  - feather mask generation and compositing clamping
- Component tests:
  - Healing panel renders and controls update store
  - stroke creation dispatches `addHealingOp`
  - undo/clear actions update state
- Integration tests (lightweight):
  - given a tiny synthetic ImageData (e.g., 3x3 or 5x5), applying a clone/heal op changes expected pixels

## Open Questions
- Do we require a dedicated pan modifier (Space) for Healing mode?
- What is the v1 heuristic for choosing source pixels for Spot removal?
- Should strokes be selectable/editable after creation (move/resize/delete), or is v1 append-only?
- Should healing apply before or after color/light adjustments (best perceptual results)?
- Should spot pins support “auto re-sample” (like Lightroom’s `/`) in v1?
