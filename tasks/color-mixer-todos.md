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
- [x] Implement band model (red/orange/yellow/green/aqua/blue/purple/magenta)
- [x] Implement hue-distance weighting per band (soft overlap)
- [x] Apply weighted Hue shift (wrap 0..1)
- [x] Apply weighted Saturation adjustment (clamp 0..1)
- [x] Apply weighted Luminance adjustment (clamp 0..1)
- [x] Preserve alpha channel
- [x] Ensure neutral mixer produces identical output

## 3) Point Color Pixel Math
- [x] Define point color center hue and range semantics
- [x] Implement hue-distance weighting based on Range
- [x] Apply weighted Hue/Sat/Lum shifts
- [x] Preserve alpha channel
- [x] Ensure neutral point color produces identical output

## 4) Eyedropper Flow (Point Color)
- [x] Add UI state for “pick point color” mode
- [x] On canvas click, sample average RGB in small radius
- [x] Convert sampled RGB → HSL hue; store as point center
- [x] Exit pick mode after successful pick
- [x] Escape cancels pick mode
- [x] Graceful handling for tainted canvas / no image (disable + error)

## 5) UI: Color Panel Tabs + Controls
- [x] Update `src/editor/ColorPanel.tsx`:
  - [x] Tabs: Basic / Mixer / Point Color
  - [x] Keep Basic (Vibrance/Saturation) unchanged
- [x] Mixer tab:
  - [x] Color chip row to select band
  - [x] 3 sliders for selected band: Hue / Saturation / Luminance
  - [x] Reset selected band
  - [x] Reset mixer
- [x] Point Color tab:
  - [x] Eyedropper button (enter pick mode)
  - [x] 3 sliders: Hue Shift / Sat Shift / Lum Shift
  - [x] Range slider
  - [x] Reset point color
  - [ ] (Optional) Visualize Range toggle
- [x] Add `data-testid` hooks for stable tests

## 6) Pipeline + Export + History
- [x] Update `hasNonNeutralColorAdjustments` to include mixer/point color
- [x] Update `applyColorAdjustmentsToRgbaBytes` to apply:
  - [x] Mixer (HSL)
  - [x] Point Color
  - [x] Existing vibrance/saturation (keep)
- [x] Ensure `color` pixel processor enables/disables correctly
- [x] Ensure export pipeline uses the same effective adjustments
- [x] Extend `src/store/historyRecording.ts` labels/deltas:
  - [x] Mixer band/channel labels (e.g. `Mixer Red Hue`)
  - [x] Point color labels (e.g. `Point Color Range`)

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
