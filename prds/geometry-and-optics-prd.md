# PRD: Straighten, Perspective, Geometry & Optics

## Summary
Add Lightroom-style **Straighten & Perspective Correction** plus a first-pass **Geometry & Optics** panel.

This feature set focuses on:
- Straightening horizons (manual + auto)
- Correcting vertical/horizontal perspective (guided + sliders)
- Basic lens/optics corrections (distortion, chromatic aberration)
- Common finishing effects (vignette, grain, dehaze)

## Goals
- Make common “fix my photo” geometry tasks fast and approachable.
- Keep edits **non-destructive** and compatible with future history/undo.
- Provide real-time preview that remains usable at typical image sizes.

## Non-goals (v1)
- Lens profile database (camera/lens EXIF-based auto profiles)
- Advanced per-channel defringe / purple fringing
- Automatic subject-aware perspective correction
- Batch apply to multiple images
- Presets

## User stories
1. As a user, I can straighten a tilted horizon with a slider.
2. As a user, I can auto-straighten and get a reasonable result.
3. As a user, I can fix “building leaning” (vertical keystone) quickly.
4. As a user, I can do guided perspective by drawing 2 lines.
5. As a user, I can reduce lens barrel/pincushion distortion.
6. As a user, I can reduce chromatic aberration on high-contrast edges.
7. As a user, I can add/remove vignette, grain, and haze.

## UX / UI requirements

### Placement
- Add a new right-panel accordion section: `Geometry & Optics`.

### Straighten
- `Rotate` slider:
  - Range: `-45° … +45°` (configurable)
  - Step: `0.1°` (with Shift = `0.01°`)
  - Double-click / reset icon restores `0°`
- `Auto Straighten` button:
  - Computes suggested rotation and applies it.
- Optional (nice-to-have v1): `Angle` readout with text input.

### Perspective / Transform
Provide both simple sliders and guided correction.

- `Vertical` slider (keystone): `-100 … +100`
- `Horizontal` slider: `-100 … +100`
- `Rotate` uses the same control as Straighten (avoid duplicate).
- `Aspect` slider (nice-to-have): `-100 … +100`
- `Constrain Crop` toggle:
  - When on, automatically expands/crops so the output fills the canvas without transparent corners.

#### Guided Upright
- `Guided` mode toggle.
- Overlay:
  - Perspective grid overlay toggle.
  - Two draggable guide lines:
    - `Vertical guide` (aligns to a building edge)
    - `Horizontal guide` (aligns to horizon)
- Button `Apply Guided` computes the transform and exits guided mode.

### Optics
- `Lens Distortion` slider:
  - `-100` = pincushion, `+100` = barrel (or vice versa; decide in implementation)
- `Remove Chromatic Aberration` toggle:
  - v1: simple CA reduction (see Technical)

### Effects (Geometry & Optics group)
- `Vignette` slider: `-100 … +100`
- `Grain` slider: `0 … 100`
- `Dehaze` slider: `-100 … +100`

### Interaction states
- Controls disabled when no image is loaded.
- While a heavy operation is running (auto-straighten analysis), show a small spinner + disable the triggering button.

## Functional requirements

### Rendering semantics
- All geometry/optics operations affect the **exported** output (not just viewport).
- Zoom/pan remain view-only.
- “Constrain crop” determines how transparent corners are handled after transforms.

### Auto-straighten behavior
- Use edge detection / Hough-line style approach to find dominant near-horizontal lines.
- Returns a suggested rotation angle; user can still fine-tune.

### Guided perspective behavior
- With 1 line: apply correction for that axis only.
- With 2 lines: solve for a transform that makes both lines axis-aligned.

## Technical design (high level)

### State model
Add a serializable set of settings to editor state:
- `rotateDegrees: number`
- `perspective: { vertical: number; horizontal: number; aspect?: number; guided?: { verticalLine?: Line; horizontalLine?: Line } }`
- `optics: { distortion: number; chromaticAberration: boolean; vignette: number; grain: number; dehaze: number }`

### Rendering pipeline
Prefer a single “bake/render committed image” pipeline shared by:
- On-canvas preview rendering
- Export/download
- Crop apply (future integration)

Proposed stages (order matters):
1. **Geometry transform** (rotate + perspective)
2. **Optics correction** (distortion, CA)
3. **Effects** (vignette, grain, dehaze)

### Implementation approach options
- **v1 recommended**: WebGL/WebGPU shader-based pipeline for perspective + distortion at interactive FPS.
- Fallback (if staying Canvas2D-only): CPU resampling using `ImageData` + bilinear sampling.
  - Gate with “preview quality” (draft vs full) if needed.

### Perspective transform math
- For full perspective correction: apply a 3×3 homography mapping output pixels → source pixels.
- For “Vertical/Horizontal” sliders (non-guided): derive a homography from keystone parameters.

### Lens distortion (v1)
- Use a simple radial model (single coefficient) mapping between undistorted/distorted coordinates.
- Apply as a post-warp sampling step.

### Chromatic aberration reduction (v1)
- Simple channel edge shift:
  - Sample R/G/B from slightly different radii from center (counter-distort channels)
  - Keep it subtle; expose as toggle only in v1

### Dehaze (v1)
- Implement a fast approximation (local contrast + blacks) for preview.
- If quality is insufficient, ship as “experimental” or defer.

## Edge cases
- Very large images: auto-straighten should run on a downscaled analysis buffer.
- Transparent corners after transforms:
  - Constrain crop on: auto-crop to maximal rectangle.
  - Constrain crop off: keep transparency (export as PNG only; JPEG should warn or auto-fill).
- Mobile: guided line manipulation must be touch-friendly.

## Acceptance criteria
- Straighten slider rotates the image with smooth preview.
- Auto-straighten computes and applies a reasonable rotation for a typical horizon photo.
- Vertical/horizontal perspective sliders visibly correct keystone distortion.
- Guided mode allows placing at least one guide line and applying a correction.
- Lens distortion slider visibly changes barrel/pincushion.
- Vignette/grain sliders apply predictable effects.
- All enabled settings are reflected in export output.

## Testing plan
- Unit tests:
  - Homography/perspective math helpers (deterministic inputs/outputs)
  - Distortion mapping helper clamps to bounds
- Component tests:
  - Slider changes update state
  - Reset returns defaults
  - Auto-straighten triggers async flow and sets angle
- Visual QA checklist (manual):
  - Horizon photo straighten
  - Building vertical correction
  - Extreme transforms (ensure no crashes)

## Implementation plan (engineering)
1. Add serializable state for geometry/optics settings.
2. Implement rotate-only pipeline end-to-end (preview + export).
3. Add vertical/horizontal perspective sliders (transform only).
4. Add guided mode overlay and transform solve.
5. Add optics/effects one by one (distortion → vignette → grain → CA → dehaze).

## Open questions
- Should `Constrain crop` be default on or off?
- Do we allow JPEG export when transparency exists (auto-fill black/white), or force PNG?
- Should the initial v1 ship with WebGL-only, or provide a CPU fallback?
