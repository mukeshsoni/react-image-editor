# Presets — Task Checklist

Source PRD: `prds/presets-prd.md`

## Scope (v1)
- Built-in curated presets (~8–10) + `None`.
- Non-destructive application via existing adjustments pipeline.
- Global **Intensity** slider (`0–100`).
- Export/download output matches preview.

## 1) Data model
- [x] Define `PresetId` union and `PresetDefinition` type
  - `PresetId` (v1):
    - `"none" | "auto-enhance" | "vibrant" | "warm" | "cool" | "matte" | "bw" | "bw-high-contrast" | "vintage-film"`
  - `PresetDefinition` (v1):
    - `{ id: PresetId; name: string; deltas: PresetDeltas }`
  - `PresetDeltas` (v1)
    - `light?: Partial<LightAdjustments>`
    - `color?: Partial<ColorAdjustments>`
    - `whiteBalance?: { temperatureKelvin?: number; tint?: number }` (treated as deltas)

- [x] Create built-in preset list (ids, names, adjustment deltas)
  - `none` — None (no deltas)
  - `auto-enhance` — Auto Enhance
    - light: `{ exposure: 5, contrast: 10, highlights: -5, shadows: 5 }`
    - color: `{ vibrance: 10, saturation: 5 }`
  - `vibrant` — Vibrant
    - light: `{ contrast: 10 }`
    - color: `{ vibrance: 30, saturation: 15 }`
  - `warm` — Warm
    - whiteBalance: `{ temperatureKelvin: 400, tint: 2 }`
    - color: `{ saturation: 5 }`
  - `cool` — Cool
    - whiteBalance: `{ temperatureKelvin: -400, tint: -2 }`
    - light: `{ contrast: 5 }`
  - `matte` — Matte
    - light: `{ contrast: -15, highlights: -5, shadows: 10, blacks: 20 }`
    - color: `{ saturation: -5 }`
  - `bw` — B&W
    - color: `{ saturation: -100 }`
    - light: `{ contrast: 10 }`
  - `bw-high-contrast` — B&W High Contrast
    - color: `{ saturation: -100 }`
    - light: `{ contrast: 30, blacks: -10, whites: 5 }`
  - `vintage-film` — Vintage Film
    - whiteBalance: `{ temperatureKelvin: 300, tint: 2 }`
    - light: `{ contrast: -10, highlights: -5, shadows: 10, blacks: 15 }`
    - color: `{ saturation: -15, vibrance: -5 }`

- [x] Decide how presets map to available adjustments (skip unsupported fields)
  - v1 presets only use `light`, `color`, and `whiteBalance` numeric deltas.
  - Ignore other edit domains (tone curve, geometry/optics, denoise, sharpening, healing) until they have defined combine rules.

## 2) Store + serialization
- [ ] Add preset state store (recommended: `src/store/presetStore.ts`)
  - [ ] `activePresetId` (default: `"none"`)
  - [ ] `presetIntensity` (default: `100`)
  - [ ] actions: `setActivePreset`, `setPresetIntensity`, `clearPreset`
- [ ] Extend `src/store/edits.ts` to include preset state in `ImageEditorEdits`
- [ ] Extend `src/store/selectEdits.ts` to include preset state
- [ ] Extend `src/store/applyEditsSnapshot.ts` to restore preset state

## 3) Effective adjustments composition
- [ ] Implement pure helpers:
  - [ ] `scalePresetAdjustments(presetAdjustments, intensity)`
  - [ ] `combineAdjustments(manual, presetScaled)`
- [ ] Define per-field combination rules (additive by default)
- [ ] Clamp combined values to legal ranges
- [ ] Ensure `None` preset produces no changes

## 4) Rendering + export integration
- [ ] Identify the single “effective edits” entrypoint used by render/export
- [ ] Update render pipeline to consume effective adjustments (manual + preset layer)
- [ ] Ensure export uses the same effective adjustments as preview
- [ ] Performance sanity:
  - [ ] preset switch should not trigger extra passes
  - [ ] intensity drag stays responsive

## 5) UI — Presets panel
- [ ] Add a right-side panel section labeled `Presets`
- [ ] Render preset tiles (grid or horizontal list)
  - [ ] include `None` tile
  - [ ] highlight selected tile
  - [ ] keyboard focus + `aria-selected`/`aria-pressed`
- [ ] Wire clicks to `setActivePreset(...)`
- [ ] Show `Intensity` slider only when preset != `none`
  - [ ] wire to `setPresetIntensity(...)`
- [ ] Ensure clearing preset preserves manual adjustments

## 6) Tests (Vitest)
- [ ] Unit tests for composition helpers:
  - [ ] scaling at 0/50/100
  - [ ] clamping behavior
  - [ ] manual-only unchanged when preset is `none`
- [ ] Component tests:
  - [ ] selecting a preset updates store state
  - [ ] intensity slider changes update effective output
  - [ ] clearing preset keeps manual adjustments
- [ ] (Optional) minimal render integration test proving render path uses effective adjustments

## 7) Manual QA checklist
- [ ] Apply preset, adjust intensity, clear preset
- [ ] Apply manual sliders, then apply/clear presets (manual edits persist)
- [ ] Export with preset active matches preview
- [ ] Check performance on large image (no jank on intensity drag)

## Follow-ups (out of scope)
- [ ] Preset preview thumbnails + caching
- [ ] Remember per-preset intensity
- [ ] Hover-to-preview (desktop)
- [ ] Undo/Redo history entries for preset changes
