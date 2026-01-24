# Mobile Support PRD

## Context
The editor UI is optimized for desktop with a horizontal three-panel layout (history, canvas, controls). On mobile widths, the panels compress and create an unusable experience. We need a dedicated mobile layout that prioritizes the canvas while providing accessible editing controls.

## Goal
Deliver a mobile-first editor layout that matches the target design: canvas on top, compact tool bar, and a scrollable control tray at the bottom.

## Key product decisions
- Mobile layout replaces the desktop resizable panels instead of squeezing them.
- Canvas gets the majority of vertical space; tools move into a bottom tray.
- History is hidden by default on mobile and accessed via a dedicated action.

## Non-goals (v1)
- Complete redesign of desktop UI
- New tools or editing capabilities
- Offline support or PWA work
- Gesture redesign beyond preventing accidental scrolling/zoom

## User stories
1. As a mobile user, I can view and edit the photo without UI panels covering the canvas.
2. As a mobile user, I can access common actions (undo/redo, crop, export) quickly.
3. As a mobile user, I can adjust editing sliders in a bottom tray without losing sight of the image.
4. As a mobile user, I can access edit groups (Basic, Color, Details, etc.) via tabs.

## UX requirements
### Layout
- Mobile breakpoint: `max-width: 768px`.
- Layout stack:
  1. Top bar (file upload + theme toggle) remains.
  2. Canvas area fills remaining space.
  3. Bottom tray holds tools and panels.

### Bottom tray
- Fixed height (or max height) with internal scroll; avoids scrolling the entire page.
- Includes a compact tool row (Undo, Redo, Crop, Healing, Export).
- Tabs for panel groups (e.g. Basic, Color, Details, Geometry, Presets).
- Active tab content uses existing panel components and styles.

### History access
- Hidden by default to preserve space.
- Accessible via a button that opens:
  - either a modal sheet, or
  - a tab entry labeled "History".

### Touch targets
- Ensure 44px minimum touch height for icon buttons.
- Keep zoom buttons visible but compact; avoid overlapping the canvas.

### Safe-area support
- Add bottom padding using `env(safe-area-inset-bottom)` for devices with notches.

## Functional requirements
- Mobile layout should not break desktop or tablet layouts.
- Editing actions should behave identically across layouts.
- Canvas gestures (pan/zoom/crop handles) must remain usable on touch screens.
- The layout switch must not reset editor state.

## Technical design
### Architecture
- Introduce `useIsMobile` hook (matchMedia) and render either:
  - `DesktopEditorLayout` (current resizable panel layout), or
  - `MobileEditorLayout` (new stacked layout).

### Reuse
- Reuse existing panel components for tab content.
- Reuse tool buttons (crop, healing, export) and undo/redo actions.

### Mobile layout sketch
- `div` container: `flex flex-col h-full min-h-0`.
- Canvas section: `flex-1 min-h-0`.
- Bottom tray: `border-t bg-muted` with its own `overflow-y-auto`.

### CSS additions
- Add safe-area padding utility for the bottom tray in `src/index.css` or `src/App.css`.
- Add mobile-only spacing overrides where needed (e.g., reduce panel padding).

## Testing plan
- Manual QA on mobile viewport sizes (360x640, 390x844, 428x926).
- Verify tool actions (undo/redo, crop apply/reset, export) work in mobile layout.
- Verify bottom tray scrolls independently and canvas remains visible.

## Acceptance criteria
- On screens <= 768px wide, the UI switches to the stacked mobile layout.
- Canvas remains the largest area and is not squeezed by side panels.
- Editing tools are accessible via bottom tray tabs.
- History is accessible without persistent side panels.
- No regressions to desktop layout or existing editor functionality.

## Implementation plan (engineering)
1. Add `useIsMobile` hook and layout split in `src/ReactImageEditor.tsx`.
2. Extract current layout to `DesktopEditorLayout` component.
3. Build `MobileEditorLayout` with bottom tray + tabs.
4. Add safe-area padding and mobile-specific spacing adjustments.
5. Manual QA and fixes for touch interactions.

## Open questions
- Should the mobile breakpoint be configurable or fixed at 768px?
- Should history live in a modal sheet or as a tab?
