# PRD: White balance (Temp/Tint + Presets + Picker)

## Summary
Add a “White Balance” control to the editor with two sliders (Temperature and Tint), Lightroom-like preset options, and an eyedropper color picker to set WB by clicking a neutral area in the photo.

This enables a core color workflow to complement the existing Light adjustments.

## Goals
- Provide intuitive white balance correction via **Temp** and **Tint**.
- Provide quick-start **preset options** similar to Lightroom.
- Provide an **eyedropper** (color picker) that computes WB from the image itself.
- Keep the pipeline **non-destructive** (WB is parameters until export).
- Maintain smooth interaction while zooming/panning and adjusting sliders.

## Non-Goals (v1)
- Local white balance adjustments (brush/masks).
- Full color grading (HSL, curves, LUTs, split toning).
- Camera “As Shot” WB based on EXIF/RAW metadata.
- Auto WB (one-click analysis) beyond the eyedropper.

## User Stories
- As a user, I can warm/cool an image using a Temperature slider.
- As a user, I can correct green/magenta casts using a Tint slider.
- As a user, I can choose a preset (e.g., Daylight) to get a quick baseline.
- As a user, I can click an eyedropper and then click a neutral surface in the image to set WB.
- As a user, I can reset WB back to neutral defaults.

## UX / UI Requirements
### Placement
- Add a new panel/section labeled **“White Balance”** in the editor controls.
- Place it **above the existing “Light” options** (the UI already lives inside the Basic accordion).
- Use existing shadcn/ui patterns for sliders/select and keep styling consistent with other panels.

### Controls
- **Temperature** slider (Kelvin)
- **Tint** slider
- **Preset** selector (dropdown/select)
- **Eyedropper** button (color picker)
- **Reset** action (Reset WB)

### Interaction details
- Double-clicking **Temperature** resets it to the default.
- Double-clicking **Tint** resets it to the default.

### Preview behavior
- Changes apply live to the rendered image (canvas) without requiring “Apply”.
- Slider drags should remain smooth (throttle to rAF if needed).

### Defaults
- Default values represent “no change” WB (neutral).
- Reset returns Temperature and Tint to defaults and sets Preset to “Custom” (or “Default”).

### Accessibility
- Sliders and select must have accessible labels.
- Eyedropper button is keyboard focusable and has an accessible name (e.g., “Pick white balance from image”).

## White Balance: Definitions + Ranges
Note: final tuning should be guided by visual testing and consistency with the Light panel.

### Temperature
- Purpose: shift image along **blue ↔ yellow** axis.
- UI range (proposal): `2000K … 10000K`.
- Default: `6500K`

### Tint
- Purpose: shift image along **green ↔ magenta** axis.
- UI range (proposal): `-100 … +100`
- Default: `0`

### Units + internal representation
- Temperature is displayed and stored as **Kelvin**.
- Tint is stored as a unitless scalar.
- Keep state serializable.
## Presets (Lightroom-like)
### Required presets (v1)
- **Daylight**
- **Cloudy**
- **Shade**
- **Tungsten**
- **Fluorescent**
- **Flash**
- **Custom** (selected when user manually changes Temp/Tint)

### Behavior
- Selecting a preset sets Temperature/Tint to predefined values.
- If the user adjusts sliders after selecting a preset, preset switches to **Custom**.
- Preset values should be implemented as a simple mapping object for easy tuning.

## Eyedropper (Color Picker)
### User flow
1. User clicks the **Eyedropper** button.
2. Cursor changes to indicate pick mode.
3. User clicks the image to sample a pixel/region.
4. Editor computes Temperature (Kelvin) / Tint adjustments that neutralize the sampled color.
5. Temperature/Tint update immediately; preset becomes **Custom**.

### Sampling rules
- Sample from the source image displayed on the canvas.
- Use an average over a small radius (e.g., 5x5 or 9x9) for stability.
- Clamp sampling to image bounds.

### UX details
- While pick mode is active:
  - Escape key cancels pick mode.
  - Clicking outside the image cancels (no change).
- Optional nice-to-have: show a small sampled swatch and/or crosshair.

### Error/edge handling
- If no image loaded: disable eyedropper.
- If canvas is tainted (cross-origin) and pixel reading fails: show a clear message and disable eyedropper.

## Technical Requirements
### State model
- Add a `whiteBalance` object in editor state (Zustand) with:
  - `temperatureKelvin: number`
  - `tint: number`
  - `preset: "custom" | "daylight" | ...`
  - `isPicking: boolean` (UI state; optional to keep outside store if preferred)
- Provide actions:
  - `setWhiteBalance({ temperatureKelvin?, tint?, preset? })`
  - `resetWhiteBalance()`
  - `setWhiteBalancePreset(preset)`

### Rendering pipeline
- White balance must be applied as part of the non-destructive adjustment pipeline.
- If the existing implementation uses Canvas 2D + ImageData processing:
  - Apply WB early in the pipeline (before or alongside other color transforms).
  - Avoid reallocating large buffers on every small change (reuse arrays where possible).
- If/when a WebGL pipeline exists:
  - WB becomes a lightweight shader uniform.

### Eyedropper implementation notes
- Use `ctx.getImageData(x, y, w, h)` to sample pixels.
- Convert sampled RGB to a neutral target by estimating required temperature/tint deltas.
- Keep implementation simple and tunable; correctness and UX matter more than physical accuracy in v1.

## Algorithm Notes (high-level)
White balance can be approximated by:
- Applying a per-channel gain derived from temperature/tint (e.g., warm increases R, decreases B; tint adjusts G relative to R/B), with clamps.
- Prefer a luma-preserving approach (avoid changing overall brightness drastically) where possible.

Eyedropper can be approximated by:
- Assuming the sampled point should become neutral (R≈G≈B) after WB.
- Computing channel gains to equalize channels, then mapping those gains back to the slider domain.

## Export interaction
- Export/download should incorporate Temperature/Tint settings.
- WB state must be serializable so it can be applied consistently during export.

## Performance budget
- Live preview should feel responsive while dragging sliders; target ~30–60fps on typical laptop.
- Eyedropper sampling should be instant (single `getImageData` call).

## Acceptance Criteria
- A “White Balance” panel exists with Temperature, Tint, Preset select, Eyedropper, and Reset.
- Temperature/Tint changes update the canvas preview live.
- Selecting a preset applies its values; subsequent manual edits set preset to Custom.
- Eyedropper mode allows clicking the image to set WB and exits pick mode after selection.
- Eyedropper gracefully handles tainted canvas/no image.

## Test Plan
- Unit tests for WB math helpers (apply temperature/tint to known RGB inputs).
- Component tests:
  - sliders render with defaults
  - selecting a preset updates state
  - manual slider change switches preset to Custom
  - eyedropper click calls sampling and updates WB (mock `getImageData`)

## Open Questions
- Exact preset Kelvin/Tint values (we should tune visually).
- Should the Temperature slider step be 50K, 100K, or variable by range?
- Do we want separate “Reset Temp/Tint” vs “Reset WB section”?
