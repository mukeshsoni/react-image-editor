# Color Mixer (HSL + Point Color) — Task Checklist

Source PRD: `prds/color-mixer-prd.md`

## 1) State + Types
- [x] Extend `ColorAdjustments` to include:
  - [x] `mixerHsl`: per-band `{ hue, saturation, luminance }`
  - [x] `pointColor`: selected hue + shifts + range
- [x] Define defaults for all new fields (neutral)
- [x] Add/extend Zustand actions:
  - [x] `setMixerBandAdjustment(band, channel, value)`
  - [x] `resetMixerBand(band)`
  - [x] `resetMixer()`
  - [x] `setPointColor({ ... })`
  - [x] `resetPointColor()`
- [x] Ensure state is serializable and included in `getImageEditorEdits()` snapshot
- [x] Ensure presets composition uses effective adjustments (already used by `EditorCanvas`)

## 2) Mixer (HSL) Pixel Math
- [ ] Implement band model (red/orange/yellow/green/aqua/blue/purple/magenta)
- [ ] Implement hue-distance weighting per band (soft overlap)
- [ ] Apply weighted Hue shift (wrap 0..1)
- [ ] Apply weighted Saturation adjustment (clamp 0..1)
- [ ] Apply weighted Luminance adjustment (clamp 0..1)
- [ ] Preserve alpha channel
- [ ] Ensure neutral mixer produces identical output

## 3) Point Color Pixel Math
- [ ] Define point color center hue and range semantics
- [ ] Implement hue-distance weighting based on Range
- [ ] Apply weighted Hue/Sat/Lum shifts
- [ ] Preserve alpha channel
- [ ] Ensure neutral point color produces identical output

## 4) Eyedropper Flow (Point Color)
- [ ] Add UI state for “pick point color” mode
- [ ] On canvas click, sample average RGB in small radius
- [ ] Convert sampled RGB → HSL hue; store as point center
- [ ] Exit pick mode after successful pick
- [ ] Escape cancels pick mode
- [ ] Graceful handling for tainted canvas / no image (disable + error)

## 5) UI: Color Panel Tabs + Controls
- [ ] Update `src/editor/ColorPanel.tsx`:
  - [ ] Tabs: Basic / Mixer / Point Color
  - [ ] Keep Basic (Vibrance/Saturation) unchanged
- [ ] Mixer tab:
  - [ ] Color chip row to select band
  - [ ] 3 sliders for selected band: Hue / Saturation / Luminance
  - [ ] Reset selected band
  - [ ] Reset mixer
- [ ] Point Color tab:
  - [ ] Eyedropper button (enter pick mode)
  - [ ] 3 sliders: Hue Shift / Sat Shift / Lum Shift
  - [ ] Range slider
  - [ ] Reset point color
  - [ ] (Optional) Visualize Range toggle
- [ ] Add `data-testid` hooks for stable tests

## 6) Pipeline + Export + History
- [ ] Update `hasNonNeutralColorAdjustments` to include mixer/point color
- [ ] Update `applyColorAdjustmentsToRgbaBytes` to apply:
  - [ ] Mixer (HSL)
  - [ ] Point Color
  - [ ] Existing vibrance/saturation (keep)
- [ ] Ensure `color` pixel processor enables/disables correctly
- [ ] Ensure export pipeline uses the same effective adjustments
- [ ] Extend `src/store/historyRecording.ts` labels/deltas:
  - [ ] Mixer band/channel labels (e.g. `Mixer Red Hue`)
  - [ ] Point color labels (e.g. `Point Color Range`)

## 7) Tests (Vitest)
- [ ] Unit tests for Mixer math:
  - [ ] Neutral preserves pixels
  - [ ] Red band affects red-ish pixel more than blue-ish
  - [ ] Alpha preserved
- [ ] Unit tests for Point Color math:
  - [ ] Narrow range affects fewer hues than broad range
  - [ ] Alpha preserved
- [ ] Component tests:
  - [ ] Tabs render
  - [ ] Band selection changes visible sliders
  - [ ] Slider change dispatches store updates
  - [ ] Eyedropper flow updates point color (mock `getImageData`)

## 8) Manual QA checklist
- [ ] Mixer sliders feel responsive on a large image
- [ ] Mixer behaves intuitively near hue boundaries (red ↔ magenta)
- [ ] Point Color pick selects expected hue on click
- [ ] Range control feels intuitive (narrow vs broad)
- [ ] Reset actions restore original appearance
- [ ] Export matches preview
