# PRD: Presets (Popular Looks)

## Summary
Add a **Presets** feature that applies curated, one-click “looks” (e.g. Vibrant, B&W, Vintage) to the current image **non-destructively**, with an **Intensity** slider.

Presets should:
- Be fast and discoverable.
- Work with the same rendering/export pipeline as other adjustments.
- Provide a good default set of “popular” edits for new users.

## Goals
- Provide a small, high-quality set of built-in presets (v1: ~8–10).
- Apply presets non-destructively (no permanent rasterization).
- Allow blending via an Intensity slider (`0–100`).
- Ensure export/download includes the active preset.
- Establish a structure that can later support:
  - user-defined presets
  - preset import/export (LUTs later)
  - preset preview thumbnails

## Non-goals (v1)
- User-created presets and preset sharing.
- LUT (.cube) support.
- Per-preset adaptive “AI” looks.
- Per-image auto tuning / auto tone curves.
- Batch processing.

## User stories
1. As a user, I can apply a preset in one click.
2. As a user, I can dial the preset strength up/down.
3. As a user, I can remove the preset and return to my manual edits.
4. As a user, I can still fine-tune individual adjustments after applying a preset.

## UX / UI requirements

### Placement
- Add a new section/panel: **Presets** in the right-side controls.

### Preset list UI
- Display presets as a grid or horizontal list of tiles.
- Each tile includes:
  - Preset name
  - (Nice-to-have) small preview thumbnail
- Include a **None** option (clears active preset).

### Selection + state
- Selecting a preset:
  - sets it as active
  - defaults intensity to `100`
  - visually highlights the selected tile
- Selecting **None** clears the active preset.

### Intensity slider
- Show only when a preset is active.
- Range: `0–100` (default `100`).
- Changing intensity updates the preview live.

### Reset behavior
- Clearing the preset should not wipe manual adjustments.
- “Reset All” for adjustments (if/when present) should also clear preset state.

### Accessibility
- Preset tiles are keyboard focusable.
- Selected state is exposed (aria-pressed / aria-selected).
- Intensity slider has an accessible label.

## Preset set (v1 proposal)
These should be tuned visually on a representative sample set of images.

### Core
- **Auto Enhance**: subtle contrast + slight vibrance/saturation lift
- **Vibrant**: higher saturation/vibrance + mild contrast
- **Warm**: warmer WB + slight saturation
- **Cool**: cooler WB + mild contrast
- **Matte**: reduced contrast + lifted blacks (true matte requires curves; approximate initially)

### Classic
- **B&W**: neutral monochrome
- **B&W High Contrast**: punchier monochrome
- **Vintage Film**: mild fade + warmth + reduced saturation (optional vignette/grain later)

Notes:
- If the editor’s adjustment set is still limited, presets should only use available parameters (e.g. brightness/contrast/saturation/temperature) and expand automatically as new adjustments ship.

## Functional requirements

### Presets are parameter sets
A preset is a named bundle of adjustment deltas.

- Presets must be applied through the same “adjustments state” used by sliders.
- Presets must be serializable.

### Presets must not destroy manual edits
Presets should behave like a separate “layer” on top of manual adjustments:
- Manual adjustments remain editable and persist when switching presets.
- Clearing the preset returns the image to “manual-only” state.

## Technical requirements

### State model (suggested)
Add preset state to the editor store (Zustand), separate from manual adjustments.

Suggested types:
- `PresetId = "none" | "auto-enhance" | "vibrant" | "warm" | "cool" | "matte" | "bw" | "bw-high-contrast" | "vintage-film"`
- `PresetDefinition = { id: PresetId; name: string; adjustments: Partial<EditorAdjustments> }`

Suggested store fields:
- `activePresetId: PresetId` (default: `"none"`)
- `presetIntensity: number` (0–100, default: `100`)

Suggested actions:
- `setActivePreset(presetId: PresetId)`
- `setPresetIntensity(value: number)`
- `clearPreset()`

### Composition model
Render/export should use **effective adjustments** computed as:

- `effective = combine(manualAdjustments, scale(preset.adjustments, presetIntensity))`

Combination rules (proposal):
- “Additive” controls (exposure, contrast, temperature, tint, vibrance, saturation, clarity, etc.) combine via addition: `manual + presetScaled`.
- Values are clamped to their legal UI ranges.

If/when the codebase uses different semantics (multiplicative contrast, etc.), define per-field combine behavior in a single helper.

### Rendering pipeline
- Presets must be applied non-destructively in the same pass as other adjustments.
- Avoid extra rasterization passes: do not bake presets into a new image for preview.

### Export interaction
- Export/download must use `effective` adjustments so the downloaded image matches preview.

### Performance
- Preset switching should feel instantaneous.
- If thumbnail previews are implemented:
  - Generate thumbnails at low resolution (e.g. 96px wide) and cache per `(imageId, presetId)`.
  - Prefer generating asynchronously (idle time / rAF) to avoid blocking interactions.

## Acceptance criteria
- Presets panel is visible in the right-side controls.
- User can select a preset and see the image update.
- Intensity slider blends the preset from 0–100.
- Clearing the preset returns to manual-only adjustments (manual edits preserved).
- Export/download output matches the preview when a preset is active.

## Test plan (Vitest)
- Unit tests:
  - `scalePresetAdjustments(intensity)` scales correctly.
  - `combineAdjustments(manual, presetScaled)` clamps to valid ranges.
- Component tests:
  - Selecting a preset updates store state.
  - Adjusting intensity updates effective adjustments.
  - Clearing preset preserves manual adjustments.

## Open questions
- Should preset selection create a history entry immediately (requires Undo/Redo feature), or only once history exists?
- Should preset intensity be remembered per preset, or global?
- Should presets apply as deltas (layered) or override manual values (destructive)? (Recommended: layered)
- Do we want a “hover to preview” interaction (desktop) in v1?
