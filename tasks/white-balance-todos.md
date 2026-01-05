# White Balance — Task Checklist

Source PRD: `prds/white-balance-prd.md`

## 1) State + Types
- [x] Add `WhiteBalancePreset` union type (daylight/cloudy/shade/tungsten/fluorescent/flash/custom)
- [x] Add `WhiteBalanceSettings` type (`temperatureKelvin`, `tint`, `preset`)
- [x] Define `DEFAULT_WHITE_BALANCE` (e.g., `6500K`, `0`, `custom`)
- [x] Add `whiteBalance` to Zustand store state
- [x] Add actions:
  - [x] `setWhiteBalance({ temperatureKelvin?, tint?, preset? })`
  - [x] `setWhiteBalancePreset(preset)`
  - [x] `resetWhiteBalance()`
- [x] Ensure state is serializable and included in any “get edits snapshot” helper

## 2) Preset mapping
- [x] Add a constant mapping `WHITE_BALANCE_PRESETS` → `{ temperatureKelvin, tint }`
- [ ] Decide initial values for each preset (tune visually)
- [ ] Behavior: selecting preset updates temp/tint; manual slider change switches to `custom`

## 3) White balance math (non-destructive)
- [x] Create pure helper(s) for applying WB to RGB(A) pixel data
- [x] Apply Kelvin temperature as a channel gain transform (approximation acceptable v1)
- [x] Apply tint (green ↔ magenta) adjustment
- [x] Preserve alpha channel
- [x] Clamp output channels safely
- [x] Add a minimal set of unit tests for helper(s)

## 4) Rendering integration
- [x] Integrate WB into the existing adjustment pipeline (before/alongside Light adjustments)
- [x] Ensure neutral WB produces identical output
- [x] Throttle updates with `requestAnimationFrame` (match Light behavior)
- [x] Avoid repeated large allocations per tick (reuse buffers where possible)

## 5) UI: White Balance panel (Basic accordion)
- [x] Add a section titled `White Balance` above `Light`
- [x] Add Temperature (Kelvin) slider + value readout
- [x] Add Tint slider + value readout
- [x] Add Preset select/dropdown
- [x] Add Eyedropper button (pick-from-image mode)
- [x] Add “Reset WB” action
- [x] Disable/guard controls when no image is loaded
- [x] Add `aria-label`/`aria-labelledby` for sliders and picker
- [x] Implement slider UX: double-click Temperature/Tint resets to defaults

## 6) Eyedropper implementation
- [x] Implement “pick mode” UI state (cursor/active indicator)
- [x] On click, sample a small region from the rendered image (`getImageData`)
- [x] Compute `temperatureKelvin` + `tint` that neutralize the sampled color
- [x] Apply values and exit pick mode; set preset to `custom`
- [x] Escape cancels pick mode; click outside image cancels (no change)
- [ ] Handle tainted canvas/no image with clear message or disabled picker
- [ ] Add an icon to the Pick button
- [ ] Use an eyedropper icon for picker mode

## 7) Tests
- [x] Unit tests for WB helper math (basic known cases)
- [ ] Component test: panel renders with defaults
- [ ] Component test: selecting preset updates state
- [ ] Component test: slider change switches preset to `custom`
- [ ] Component test: double-click slider resets to default
- [x] Component test: eyedropper updates WB (mock `getImageData`)

## 8) Manual QA checklist
- [ ] Presets feel sensible across a few sample photos
- [ ] Slider drag remains smooth while zoomed in
- [ ] Eyedropper works on neutral targets (paper/gray card)
- [ ] Reset returns image to original appearance
