# Mobile Tray Overlay + Smart Canvas Nudge — Task Checklist

Source PRD: `prds/mobile-tray-overlay-prd.md`

## Scope (v1)
- Bottom tray becomes an overlay on top of the canvas on mobile.
- Canvas resizes correctly as the visible viewport changes.
- When tray opens/expands, gently nudge the image up only as much as possible (cap at 20px top margin).
- If overlap remains, tray background becomes translucent for the overlapped region (with blur).
- Tray panel content area becomes shorter with internal scroll.

## 0) Prep / discovery
- [ ] Capture current behavior video on iPhone Safari (baseline)
- [ ] Identify the current mobile tray container and the canvas viewport element in `src/ReactImageEditor.tsx`
- [ ] Identify where canvas width/height are currently set and why it does not update on tray open/close

## 1) Mobile layout: tray overlay conversion
- [ ] Update `src/editor/layouts/MobileEditorLayout.tsx` to support overlay tray positioning
- [ ] Move mobile tray panel to an overlay layer anchored to bottom (e.g. `position: absolute; bottom: 0; left: 0; right: 0;`)
- [ ] Ensure canvas viewport remains a single scrolling-free region (`overflow-hidden`)
- [ ] Ensure safe-area inset bottom is applied to the tray container
- [ ] Verify the top toolbar remains outside the overlay math (no double `100dvh` stacking)

## 2) Canvas sizing: keep backing buffer in sync
- [ ] Add a wrapper around `EditorCanvas` that defines the visible canvas viewport (mobile)
- [ ] Add a `ResizeObserver` for the viewport wrapper
- [ ] On resize, set `canvas.width`/`canvas.height` to wrapper `clientWidth`/`clientHeight`
- [ ] Ensure resize does NOT call `resetZoom()` (avoid disruptive camera resets)
- [ ] Clamp existing camera offset to new bounds after resizing
- [ ] QA: address bar collapse/expand, rotation, tray open/close all keep preview aligned

## 3) Smart nudge: non-aggressive push-up
- [ ] Create a pure helper (e.g. `src/editor/mobileTrayNudge.ts`) that computes:
- [ ] - `nextOffsetY` given: `offsetY`, `zoomLevel`, `imageHeight`, `viewportHeight`, `trayHeight`, `topMargin=20`
- [ ] - `overlapPx` given the updated offset
- [ ] Implement the algorithm:
- [ ] - `requiredShiftUp = max(0, imageBottom - trayTopY)`
- [ ] - `availableShiftUp = max(0, imageTop - topMargin)`
- [ ] - `appliedShiftUp = min(requiredShiftUp, availableShiftUp)`
- [ ] - `nextOffsetY = imageTop - appliedShiftUp`
- [ ] Clamp `nextOffsetY` using existing pan bounds logic
- [ ] Trigger nudge only on tray open/close, tray height change, or viewport height decrease
- [ ] Optional polish: animate the camera Y transition (150-200ms) behind a small helper

## 4) Tray translucency for overlap
- [ ] Add tray container ref and `ResizeObserver` to measure tray height
- [ ] Compute `overlapPx` after nudge and expose it as a CSS variable on the tray container
- [ ] Implement a background gradient that transitions from translucent (top) to opaque (below overlap boundary)
- [ ] Add `backdrop-filter: blur(...)` for the overlapped region (with fallback)
- [ ] Verify that only the background is translucent; controls remain fully opaque
- [ ] Tune alpha values to keep text/controls readable on both light and dark themes

## 5) Tray height + internal scroll (LR-like)
- [ ] Replace fixed `max-h-[250px]` with a responsive clamp on the panel content container
- [ ] Ensure panel content is the only scrollable region (not the entire page)
- [ ] Verify that sliders remain easy to use on touch (no accidental page scroll)

## 6) Mobile viewport height hygiene
- [ ] Audit `src/index.css` mobile `100dvh` rule for `.mobile-editor-layout`
- [ ] Ensure we are not applying `100dvh` to both outer wrapper and inner layout (can cause overflow)
- [ ] Validate the layout on iOS Safari with the bottom address bar shown/hidden

## 7) Testing
- [ ] Unit tests for the pure nudge/overlap helper:
- [ ] - case: enough headroom to clear tray
- [ ] - case: insufficient headroom; cap at 20px
- [ ] - case: no tray (height 0)
- [ ] - case: image taller than viewport (no nudge expected)
- [ ] Manual QA matrix:
- [ ] - iPhone Safari: 390x844, 428x926
- [ ] - Android Chrome: 360x800
- [ ] - portrait + landscape
- [ ] - with/without image loaded
- [ ] - with crop mode and healing mode enabled

## 8) Acceptance checklist
- [ ] Tray overlays image preview on mobile
- [ ] Opening tray nudges image up only as much as possible; never past 20px top margin
- [ ] If overlap remains, overlapped tray region is translucent so image is visible beneath
- [ ] Canvas backing size tracks viewport changes (no stale-height preview behind tray)
- [ ] No regressions on desktop layout
