# Mobile Tray Overlay + Smart Canvas Nudge PRD

## Context
On mobile, opening an edit tab (e.g. Basic) shows a controls pane that can cover the image preview. This makes the editor feel cramped and prevents users from judging edits while adjusting sliders.

Lightroom Mobile solves this by:
- Using a shorter bottom controls pane (internal scroll).
- Keeping the image visible by nudging it upward when there is available space.
- Allowing overlap when the image can no longer be moved up, while making the overlapping portion of the controls pane translucent so the image remains visible underneath.

## Goal
Improve the mobile editing experience by implementing a Lightroom-like bottom overlay tray:
- Controls tray overlays the image preview (not pushing layout).
- When the tray opens/expands, gently nudge the image upward only as much as needed to keep the image bottom above the tray top.
- If nudging can't fully clear the tray, allow overlap and make the overlapped part of the tray translucent (with blur) so the image remains visible beneath.

## Non-goals (v1)
- Redesign of desktop layout.
- Changing edit algorithms (Light/Color/etc.).
- New editing tools or new panel content.
- Reworking zoom/pan behavior beyond clamping/nudging in response to layout changes.
- Pixel density (retina) canvas refactor (keep current 1:1 CSS px to canvas px unless already handled elsewhere).

## User stories
1. As a mobile user, I can open the Basic/Light/Color controls without the controls fully hiding the photo.
2. As a mobile user, I can still see the photo under the tray when overlap is unavoidable.
3. As a mobile user, I can scroll controls in the tray without scrolling the entire page.
4. As a mobile user, opening/closing controls does not reset my zoom/pan/crop state.

## UX requirements

### Layout behavior (mobile)
- Breakpoint: `max-width: 768px` (consistent with existing mobile layout).
- Canvas preview occupies the full available viewport height behind the tray.
- Bottom tray is a persistent overlay anchored to the bottom with safe-area padding.

### Bottom tray height
- Tray has a compact tabs/tools row always visible.
- Panel content area uses a responsive max height and internal scrolling:
  - Suggested: `max-height: clamp(160px, 34svh, 260px)` for panel content.
- Tray expansion/collapse should feel stable (no layout jumps).

### Smart nudge behavior (non-aggressive)
When the tray opens or its height increases:
- Try to move the image upward just enough so that image bottom sits above the tray top (no overlap), if possible.
- If not possible, stop nudging when the image top is ~20px from the top of its container (do not push beyond this).
- Nudging must not reset zoom; only adjust camera offset (primarily Y).

### Overlap + translucency
If overlap remains after nudging:
- The overlapping portion of the tray background becomes translucent (not the controls themselves).
- The tray background transitions from translucent (top) to opaque (below overlap boundary).
- Use backdrop blur in the overlapped region to maintain legibility while revealing the image.

### Accessibility
- Controls remain readable against the translucent background:
  - Maintain sufficient contrast for text and icons.
  - Avoid making the entire tray too transparent.
- Touch targets remain >= 44px where applicable.

## Functional requirements
- Works on iOS Safari and Android Chrome.
- Does not break gestures: pinch zoom, pan, crop handles, healing interactions.
- Does not reset editor state when tray opens/closes.
- Handles dynamic viewport changes:
  - address bar collapse/expand
  - orientation changes
  - accordion sections expanding within a panel
  - safe-area inset changes

## Technical design

### Overview
Implement a bottom overlay tray that measures its own height and the canvas viewport height, then:
1. Keeps the canvas sized to the viewport.
2. Computes overlap between image bounds and tray top.
3. Applies a gentle camera Y-offset adjustment, limited by a top margin.
4. Computes remaining overlap and drives tray translucency via CSS variables.

### Key implementation components
- Canvas viewport container ref (mobile): the DOM element representing the visible canvas area.
- Tray container ref (mobile): the overlay element anchored to bottom.
- ResizeObservers:
  - Observe canvas viewport size (for canvas resizing, viewport height changes).
  - Observe tray size (for panel expansion/collapse and safe-area padding effects).

### Canvas resizing (mobile)
Current issue: canvas sizing is initialized once; when layout changes, the canvas backing buffer can remain stale.
- On viewport resize:
  - Set `canvas.width` and `canvas.height` to match the viewport container's `clientWidth/clientHeight`.
- Avoid calling `resetZoom()` on these resizes.
- Clamp camera offset to new pan bounds.

### Smart nudge algorithm (Y only)
Definitions:
- `imageTop = offset.y`
- `imageBottom = offset.y + imageHeight * zoomLevel`
- `trayTopY = viewportHeight - trayHeight`
- `requiredShiftUp = max(0, imageBottom - trayTopY)`
- `availableShiftUp = max(0, imageTop - 20)` (20px top margin cap)
- `appliedShiftUp = min(requiredShiftUp, availableShiftUp)`
- `nextOffsetY = imageTop - appliedShiftUp`

Then:
- Clamp `nextOffsetY` to pan bounds for the given zoomLevel.
- Apply via `setCamera(zoomLevel, { x: offset.x, y: nextOffsetY })`.

Notes:
- Only run nudging on:
  - tray open/close
  - tray height changes
  - viewport height changes that reduce available space
- Do not continuously fight user panning; treat as a one-shot adjustment per layout change.

### Remaining overlap computation (for tray translucency)
After applying the nudge:
- `overlapPx = max(0, imageBottom - trayTopY)`

Use `overlapPx` to drive styling.

### Tray translucency styling (gradient + blur)
- Apply a CSS variable: `--tray-overlap-px: ${overlapPx}px`
- Tray background uses a gradient such that:
  - From tray top down to `--tray-overlap-px`, background is translucent (and blurred).
  - Below that, background becomes mostly opaque for legibility.

Example intent (exact tokens tuned to theme system):

`linear-gradient(to bottom,
  hsl(var(--muted) / 0.55) 0px,
  hsl(var(--muted) / 0.92) var(--tray-overlap-px),
  hsl(var(--muted) / 0.98) 100%
)`

Add `backdrop-filter: blur(10px)` with graceful fallback if unsupported.

### Mobile viewport height hygiene
Ensure the mobile layout uses `100dvh/100svh` in a way that includes the toolbar correctly and avoids double-counting height.

## Acceptance criteria
- Opening any mobile edit tab does not fully hide the image preview behind opaque UI.
- If the image can be nudged upward, it moves just enough to place its bottom above the tray top.
- If nudging is insufficient, the tray overlaps the image and the overlapped region is translucent so the image remains visible underneath.
- Image top never moves above ~20px from the top of its container due to this behavior.
- Canvas remains correctly sized to the visible viewport through tray open/close, address bar changes, and rotation.
- No regressions on desktop layout.

## Testing plan
- Manual QA (primary):
  - iPhone Safari (390x844, 428x926), Android Chrome (360x800).
  - Test with:
    - landscape + portrait
    - address bar expanded/collapsed
    - each mobile panel group (Basic/Color/Tone/Details/Geometry)
    - accordion expansion inside a panel (tray height changes)
    - zoomed in (image larger than viewport) and zoomed out (letterboxed)
- Automated tests (optional in v1):
  - Unit test pure helper for nudge/overlap calculations with representative cases.

## Open questions
- Exact translucency levels and blur strength (theme-dependent tuning).
- Should nudging animate (e.g. 150-200ms ease-out) or apply instantly for v1?
- Should nudging consider rotation/crop bounds explicitly (v1 can treat the drawn image bounds as current zoomLevel * image dimensions, consistent with existing camera model).
