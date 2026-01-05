# PRD: Tone Curve

## Summary
Add a “Tone Curve” panel to the React image editor that provides precise tonal control using a Lightroom-inspired curve UI:
- A curve editor with point-based manipulation.
- Channel selection: RGB (master) plus individual Red, Green, Blue curves.
- A parametric “Region” section with four sliders: Highlights, Lights, Darks, Shadows.

This feature builds on the existing non-destructive edit pipeline (white balance, light, vibrance/saturation) and should be applied live in preview and export.

## Goals
- Enable fine-grained tonal adjustments beyond basic sliders.
- Support both:
  - **Point curve** editing (add/move/remove control points).
  - **Parametric curve** editing via region sliders (highlights/lights/darks/shadows).
- Support per-channel curves (RGB master + R/G/B channels).
- Keep edits non-destructive and serializable.
- Maintain smooth preview performance while dragging points/sliders.

## Non-Goals (for this PRD)
- Histogram/levels display and black/white point handles (separate Levels/Histogram PRD).
- Auto-levels / auto-contrast.
- Curves in alternate color spaces (LAB, HSV, HSL).
- Full color management / ICC profile pipeline.

## User Stories
- As a user, I can apply an S-curve to increase midtone contrast.
- As a user, I can lift shadows without changing highlights using the curve.
- As a user, I can adjust the red curve to add/remove red tint in shadows.
- As a user, I can reset the curve to a neutral diagonal.
- As a user, I can switch between RGB and individual channels.

## UX / UI Requirements

### Placement
- Add a new section labeled `Tone Curve` in the editor controls (alongside White Balance / Tone / Color).
- Use existing UI patterns (spacing, small labels, shadcn/ui buttons where applicable).

### Curve editor (Point Curve)
Inspired by the Lightroom panel:
- A square curve graph with a subtle grid background.
- A diagonal identity line when the curve is neutral.
- Click on the curve to add a control point.
- Drag a point to adjust it.
- Delete a point (Delete/Backspace or context action).
- Endpoints (0,0) and (1,1) are fixed and cannot be removed.
- Points are constrained:
  - X is strictly increasing (points cannot cross).
  - Y is clamped to [0..1].

### Channel selection
- Provide quick toggle buttons/icons for:
  - `RGB` (master)
  - `R`, `G`, `B`
- Selected channel is visually highlighted and matches curve color.
- Editing applies to the currently selected channel curve.

### Region sliders (Parametric)
- Provide four sliders labeled `Highlights`, `Lights`, `Darks`, `Shadows`.
- Slider range: `-100 … +100`, default `0`.
- These modify a parametric curve for the currently selected channel group:
  - Default: apply to `RGB` channel only (open question for per-channel region support).

### Reset
- `Reset` button for the Tone Curve section (required).
- Nice-to-have: reset per channel.

### Preview behavior
- Changes apply live to the rendered canvas.
- During drag (curve point or slider), preview remains smooth (aim ~30–60fps).

### Accessibility
- All controls have accessible labels.
- Keyboard support:
  - Tab to focus points (nice-to-have).
  - Arrow keys nudge selected point (nice-to-have).

## Definitions

### Point curve
A mapping function `f(x)` where `x` is input luminance/channel value in [0..1] and `f(x)` is output in [0..1].

### Channel curves
- `RGB` (master): applied to all channels equally.
- `R`, `G`, `B`: applied to each channel after master curve.

## Technical Requirements

### State model
Add tone curve settings to the editor state (Zustand) as a serializable object.

Suggested types:
- `ToneCurveChannel = "rgb" | "r" | "g" | "b"`
- `CurvePoint = { x: number; y: number }` (normalized 0..1)
- `PointCurve = { points: CurvePoint[] }`
- `ParametricCurve = { highlights: number; lights: number; darks: number; shadows: number }`
- `ToneCurveSettings = {
  mode: "point" | "parametric";
  activeChannel: ToneCurveChannel;
  point: Record<ToneCurveChannel, PointCurve>;
  parametric: {
    rgb: ParametricCurve;
  };
}`

Defaults:
- Point curves: two points only (endpoints), i.e. identity mapping.
- Parametric sliders: all `0`.

Store actions:
- `setToneCurveMode(mode)`
- `setToneCurveChannel(channel)`
- `setToneCurvePointCurve(channel, points)` (or point-level actions)
- `setToneCurveParametric(partial)`
- `resetToneCurve()`

### Rendering pipeline
- Tone curve must be applied in the shared non-destructive pixel pipeline (preview + export).
- To keep performance acceptable:
  - Generate 256-entry (or 1024-entry) lookup tables (LUTs) per channel when settings change.
  - Apply LUTs during pixel processing rather than evaluating splines per pixel.

Proposed ordering (adjustable):
1) White balance
2) Light adjustments
3) Tone curve (RGB master + per-channel)
4) Vibrance/saturation

### Algorithms (high-level)

#### Point curve interpolation
- Convert control points to a monotonic curve.
- Use a spline approach suitable for image curves:
  - Piecewise cubic spline (Catmull-Rom) with clamping, or
  - Monotone cubic interpolation (preferred to avoid overshoot).
- Sample the curve to create LUT.

#### Parametric region curve
- Interpret sliders as adjustments to ranges of tonal values (similar to Lightroom):
  - Shadows: affects lower tones
  - Darks: affects lower midtones
  - Lights: affects upper midtones
  - Highlights: affects upper tones
- Implement as a sum of smooth masks over x:
  - `f(x) = x + Σ (amount_i * mask_i(x))`
- Clamp and generate LUT.

#### Applying channel curves
- For each pixel channel (r,g,b):
  - Apply master `rgbLut` first.
  - Apply channel-specific LUT after (rLut/gLut/bLut).
- Preserve alpha.
- Clamp output to [0..255].

### Precision considerations
- Perform LUT math in float [0..1], then convert to bytes.
- Ensure the curve is continuous and clamped to avoid banding artifacts.

## Edge Cases
- Points crossing: disallow via constraints.
- Duplicate X coordinates: prevent or merge.
- Extreme curves: avoid overshoot and clamp output.
- Alpha images: preserve alpha.
- Very small images: UI still works and output matches expected.

## Acceptance Criteria
- Tone Curve panel renders with:
  - Curve grid and identity line by default.
  - Channel selector for RGB/R/G/B.
  - Region sliders for Highlights/Lights/Darks/Shadows.
  - Reset button.
- Dragging points updates preview live.
- Adjusting region sliders updates preview live.
- Neutral curve results in identical output.
- Export applies the same curve results as preview.

## Test Plan
- Unit tests:
  - LUT generation for identity curve equals identity mapping.
  - Adding a simple curve (e.g., lift shadows) changes LUT accordingly.
  - Per-channel curves affect only intended channels.
  - Parametric curve masks behave and clamp correctly.
- Component tests:
  - Panel renders with expected controls.
  - Channel switching updates active state.
  - Reset returns to defaults.
- Integration tests:
  - Apply tone curve to a tiny synthetic image buffer and verify expected pixel changes.

## Open Questions
- Should parametric region sliders apply only to RGB or also per channel?
- Should the UI expose a mode switch (Point vs Parametric) or allow both simultaneously?
- Should we provide a few presets (Linear, Medium Contrast, Strong Contrast) (nice-to-have)?
- Where does tone curve sit in the pipeline relative to light adjustments and saturation for best results?
