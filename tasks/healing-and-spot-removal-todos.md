# Healing & Spot Removal — Task Breakdown

Source PRD: `prds/healing-and-spot-removal-prd.md`

## Scope

### v1 (Healing + Spot)
- New `Healing` tool with modes: `Spot`, `Heal`, `Clone`.
- Brush controls: size + feather (hardness inverse). Opacity is optional.
- Non-destructive: store serializable ops in state; re-render from original.
- Undo/redo integration at least per-stroke (via global history if present).
- Smooth performance while brushing, zooming, and panning.

### v2 (Object Removal)
- Content-aware fill / inpainting for larger object removal.
- More advanced texture synthesis and edge-aware blending.
- Select/paint + expand/shrink selection + feather controls.

## 0) Product decisions to lock

### v1 decisions
- [x] Spot pins and selection
  - [x] Click target pin selects that spot
  - [x] Drag source pin changes sampling
- [x] Confirm behavior when Healing tool active
  - [x] Primary drag paints
  - [x] Pan modifier: `Space + drag`
- [x] Confirm healing stage order vs adjustments
  - [x] Healing before tone/color adjustments
- [x] Confirm default brush ranges
  - [x] Size: `5…200`
  - [x] Feather: `0…100`
  - [x] Opacity: fixed at `100%` (no v1 control)
- [x] Clone source selection (v1)
  - [x] `Alt/Option + click` sets clone source
  - [x] Source persists until changed (or cleared)
  - [x] Painting is disabled until a source is set

### v2 decisions
- [ ] Define UX for object removal
  - [ ] Brush vs lasso vs both
  - [ ] Progressive preview vs apply-only
  - [ ] Max selection size / quality controls

## 1) State model + store
- [x] Add healing state to the editor store(s) (Zustand)
  - [x] `healingMode: "spot" | "heal" | "clone"`
  - [x] `healingBrush: { size: number; feather: number }`
  - [x] `healingOps: HealingOp[]`
- [x] Define serializable types (versioned)
  - [x] `SpotOp` (`center`, `radius`, `feather`, `opacity`, `mode`)
  - [x] `StrokeOp` (`points[]`, `radius`, `feather`, `opacity`, `mode`, optional `source`)
- [x] Store actions
  - [x] `setHealingMode(mode)`
  - [x] `setHealingBrushSettings(partial)`
  - [x] `addHealingOp(op)`
  - [x] `removeHealingOp(id)` / `clearHealingOps()`
- [x] Ensure reset flows clear healing ops
  - [x] New image load (via `useResetAll` on load)
  - [x] Revert/Reset (via `useResetAll`)

## 2) UI: tool entry + subpanel
- [x] Add `Healing` tool entry in main controls (where other tools live)
- [x] Add Healing subpanel in right panel
  - [x] Mode selector: `Spot`, `Heal`, `Clone`
  - [x] Slider: `Brush size`
  - [x] Slider: `Feather`
  - [x] Button: `Clear` (remove all healing ops)
  - [x] Undo/Redo buttons (use global header controls; no tool-local UI)
- [x] A11y
  - [x] ARIA labels for selectors/sliders/buttons
  - [x] Keyboard-accessible controls

## 3) Pointer handling + coordinate mapping
- [x] Render a circular brush cursor overlay when Healing active
  - [x] Cursor scales correctly with zoom (screen px)
  - [x] Cursor hides when pointer leaves canvas
- [x] Convert pointer events from canvas space → image space
  - [x] Use same transform path as crop/zoom/pan
  - [x] Store points in image space (stable across zoom/pan)
- [x] Input behaviors
  - [x] `pointerdown` begins stroke (or spot)
  - [x] `pointermove` appends points (throttle / distance threshold)
  - [x] `pointerup/cancel` commits op
  - [x] `Space + drag` pans without painting

## 4) Preview pipeline support (non-destructive)
- [x] Add a healing stage to the render pipeline
  - [x] Preview: apply ops when drawing to main canvas
  - [x] Export: apply same ops deterministically
- [ ] Maintain an offscreen working canvas for incremental updates while painting
  - [ ] Avoid recomputing the full pipeline per pointer move
  - [ ] Simplify points during drag (distance threshold)

## 5) Algorithms

### v1 (pragmatic)
- [ ] Mask generation
  - [ ] Feathered circular mask function
  - [ ] Clamp compositing to image bounds
- [ ] Clone (stroke)
  - [ ] Source selection UX
    - [ ] Option A: `Alt/Option + click` to set source
    - [ ] Option B: auto-source offset from stroke start (fallback)
  - [ ] Persist source across strokes
  - [ ] Composite with feather + opacity
- [ ] Heal (stroke)
  - [ ] Implement clone + basic luma matching / blend
  - [ ] Validate seams are reduced vs pure clone
- [ ] Spot (tap)
  - [x] Auto-source heuristic (initial source point)
  - [x] Show target + source pins + connecting line
  - [x] Click target pin to select spot
  - [x] Drag source pin to change sampled area
  - [ ] Apply patch with feather

### v2 (object removal)
- [ ] Selection/mask model
  - [ ] Store mask in image-space (vector or raster)
  - [ ] Add feather + expand/shrink operations
- [ ] Fill algorithm options
  - [ ] PatchMatch-style fill (CPU; likely slow)
  - [ ] WebGL-based iterative fill (experimental)
  - [ ] Model-backed inpainting (future; requires backend or WASM model)
- [ ] Seam blending
  - [ ] Edge-aware blending / Poisson-like approximation (future)

## 6) Undo/Redo integration
- [ ] Ensure each completed stroke/spot becomes one history entry
  - [ ] If global history exists: push snapshot after op commit
  - [ ] Otherwise (fallback): local undo stack for healing ops only
- [ ] `Clear` action is undoable (one history entry)

## 7) Edge cases + guards
- [ ] Large images
  - [ ] Downscaled preview path if needed
  - [ ] Full-res export remains correct
- [ ] Alpha channel handling
  - [ ] Preserve alpha during sampling/compositing
- [ ] Rotation / transforms
  - [ ] Verify pointer mapping matches rendered pixels
- [ ] CORS/tainted canvas
  - [ ] Detect export failures and surface message
  - [ ] Disable healing if canvas is tainted (or fail gracefully)

## 8) Tests (Vitest)

### v1 tests
- [ ] Unit tests
  - [ ] Canvas→image coord mapping math (known cases)
  - [ ] Feather mask generation (basic shape + falloff)
  - [ ] Clone compositing clamping (bounds)
- [ ] Integration/unit-ish image tests (tiny ImageData)
  - [ ] Applying clone op changes expected pixels
  - [ ] Spot op changes expected pixels
- [ ] Component tests
  - [ ] Healing panel renders + controls update store
  - [ ] Painting commits `addHealingOp`
  - [ ] Clear removes ops

### v2 tests
- [ ] Unit tests
  - [ ] Mask rasterization + feather/expand/shrink
  - [ ] Determinism of fill algorithm for fixed seed
- [ ] Visual-ish regression (optional)
  - [ ] Snapshot exported pixel hashes for small fixtures

## 9) Manual QA checklist
- [ ] Spot remove small dust (tap)
- [ ] Heal brush over blemish (stroke)
- [ ] Clone with explicit source set
- [ ] Zoom/pan while in Healing tool (modifier)
- [ ] Undo/redo after a few strokes
- [ ] Export matches preview after healing
