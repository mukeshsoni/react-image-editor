# PRD: Color Mixer (HSL + Point Color)

## Summary
Add a Lightroom-style **Color Mixer** panel with two tabs:
- **Mixer (HSL)**: adjust Hue / Saturation / Luminance per color range (e.g. Red, Orange, Yellow…).
- **Point Color**: pick a specific color from the image with an eyedropper and apply targeted Hue/Sat/Lum shifts with adjustable range.

This feature extends the current global color controls (Vibrance/Saturation) to selective, per-color editing while remaining **non-destructive** and consistent between preview and export.

## Goals
- Provide a familiar Lightroom-like Color Mixer experience.
- Enable selective color control without masks (global-by-color selection).
- Keep edits non-destructive (parameters applied at render/export time).
- Maintain smooth interaction while dragging sliders.
- Support Undo/Redo history labeling (per-adjustment change labels).

## Non-Goals (v1)
- Local adjustments / masking (brush, linear/radial gradient masks).
- HSL “targeted adjustment tool” (drag on image to adjust H/S/L) beyond the Point Color eyedropper.
- Camera profile / ICC / wide-gamut color management.
- LUT import/export.

## User Stories
- As a user, I can reduce the saturation of Reds to make a distracting object less prominent.
- As a user, I can shift Blue hue to change the look of a sky.
- As a user, I can brighten/darken a specific color range using Luminance.
- As a user, I can pick an exact color (Point Color) to adjust only that shade.
- As a user, I can tune how broad/narrow the Point Color selection is.
- As a user, I can reset the Color Mixer (and individual sections) back to defaults.

## UX / UI Requirements

### Placement
- Extend the existing **Color** panel to include a **Color Mixer** section.
- Keep current global sliders (Vibrance, Saturation) intact.

### Layout
- Add tabs within the Color panel:
  - **Basic** (existing Vibrance/Saturation)
  - **Mixer**
  - **Point Color**

### Mixer (HSL)
- Provide a row of **color chips** to select the active band:
  - Red, Orange, Yellow, Green, Aqua, Blue, Purple, Magenta.
- Show three sliders for the selected band:
  - **Hue**
  - **Saturation**
  - **Luminance**
- Include:
  - **Reset band** (resets the selected band only)
  - **Reset mixer** (resets all bands)

### Point Color
- Provide an **eyedropper** button to enter pick mode.
- When in pick mode:
  - Cursor indicates picking.
  - Clicking the image samples a color (small radius average).
  - Pick mode exits after a successful pick.
  - Escape cancels pick mode.
- Show controls for the active point selection:
  - **Hue Shift**
  - **Sat. Shift**
  - **Lum. Shift**
  - **Range** (broad ↔ narrow)
- Nice-to-have (v1 if easy):
  - **Visualize Range** toggle to preview affected pixels.

### Defaults
- All mixer and point settings default to neutral (no visual change).
- Reset returns values to defaults.

### Accessibility
- All sliders and buttons have accessible labels.
- Color chip selection is keyboard focusable and exposes selected state.

## Adjustments: Definitions + Ranges

### Mixer (HSL)
For each band (Red/Orange/…):
- Hue shift: `-100 … +100` (maps to degrees shift internally)
- Saturation: `-100 … +100`
- Luminance: `-100 … +100`

### Point Color
- Hue shift: `-100 … +100`
- Saturation shift: `-100 … +100`
- Luminance shift: `-100 … +100`
- Range: `0 … 100` (0 = very narrow, 100 = very broad)

## Technical Requirements

### State model
- Extend the existing serializable color adjustment state.
- Keep global sliders (vibrance/saturation) and add:
  - `mixerHsl`: per-band adjustments
  - `pointColor`: a small list of point selections (v1: single active point; optionally store multiple slots later)

Suggested types (illustrative):
- `HslBand = "red" | "orange" | "yellow" | "green" | "aqua" | "blue" | "purple" | "magenta"`
- `HslDelta = { hue: number; saturation: number; luminance: number }`
- `ColorMixerSettings = Record<HslBand, HslDelta>`
- `PointColorSelection = {
    id: string;
    centerHue: number; // 0..1
    range: number; // 0..100
    hueShift: number;
    saturationShift: number;
    luminanceShift: number;
  }`

Actions:
- Set/reset per band.
- Enter/exit pick mode (UI state may live outside store).
- Set/reset point color.

### Rendering pipeline
- Integrate with the existing pixel pipeline and color processor.
- Ensure export uses the same effective adjustments as preview.
- Keep processing single-pass over pixels.

### Mixer algorithm (high level)
- Convert RGB → HSL.
- Compute band weights from hue proximity (soft falloff so adjacent bands blend naturally).
- Apply weighted deltas to H/S/L.
- Convert back to RGB; preserve alpha.

### Point Color algorithm (high level)
- Eyedropper samples a target hue from the image.
- For each pixel, compute distance in hue space to the selected hue.
- Convert hue distance to a weight based on `Range`.
- Apply weighted H/S/L shifts.

### Visualize Range (optional)
- If enabled, render a mask-like preview:
  - either desaturate non-selected pixels or tint selected pixels.
- Must not affect export output; preview-only.

### History labels
- Add history labeling for:
  - Mixer band + channel changes (e.g. `Mixer Red Hue +12`)
  - Point Color changes (e.g. `Point Color Hue +8`, `Point Color Range +10`)

### Performance budget
- Slider drag remains responsive; target ~30–60fps on typical laptop for common resolutions.
- Avoid per-event allocations; reuse buffers.

## Edge Cases
- Alpha channel preserved.
- Grayscale pixels: hue may be undefined; treat as no-op for hue weighting (weight = 0 or based on saturation).
- Hue wrap-around at 0/1 boundary.
- Extremely broad ranges should behave similarly to a global adjustment (but not identical).
- Cross-origin canvas taint: eyedropper should fail gracefully with a clear error.

## Acceptance Criteria
- Color panel includes tabs for Basic / Mixer / Point Color.
- Mixer:
  - Selecting a band shows Hue/Sat/Lum sliders for that band.
  - Adjustments update preview live and are applied in export.
  - Reset band and reset mixer work.
- Point Color:
  - Eyedropper mode allows picking a color from the image.
  - Hue/Sat/Lum + Range sliders update preview live and are applied in export.
  - Escape cancels pick mode.
- Undo/Redo history labels reflect the change.

## Test Plan
- Unit tests:
  - Mixer math: neutral settings preserve pixels.
  - Mixer math: changing Red saturation affects a red-ish pixel more than a blue-ish pixel.
  - Point color math: narrow range affects fewer hues than broad range.
  - Alpha preserved for all operations.
- Component tests:
  - Tabs render.
  - Band selection changes which sliders are shown.
  - Slider changes call store actions.
  - Eyedropper flow triggers sampling and updates point settings (mock `getImageData`).

## Open Questions
- Should Point Color support multiple saved points (slots) in v1, or only a single active point?
- Should Point Color include a “Reset point” and “Clear point” distinction?
- Do we want a dedicated on-canvas indicator (swatch/crosshair) after picking?
