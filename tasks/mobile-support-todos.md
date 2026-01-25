# Mobile Support — Task Checklist

Source PRD: `prds/mobile-support-prd.md`

## Scope (v1)
- Dedicated mobile layout for widths <= 768px.
- Canvas-first vertical layout with bottom control tray.
- Tool row (undo/redo, crop, healing, export) and tabs for panel groups.
- History access via tab or modal sheet.
- Safe-area padding and touch-friendly targets.

## 1) Layout architecture
- [x] Add `useIsMobile` hook (matchMedia) for layout switching
- [x] Extract current layout to `DesktopEditorLayout`
- [x] Build `MobileEditorLayout` skeleton (canvas + bottom tray)

## 2) Mobile tool row
- [x] Reuse undo/redo buttons with mobile sizing
- [x] Reuse crop/healing/export controls in compact row
- [x] Ensure tool buttons have 44px minimum touch size

## 3) Bottom tray tabs
- [ ] Define tab registry for panel groups (Basic, Color, Details, Geometry, Presets)
- [ ] Render existing panel components within tab content
- [ ] Add History entry as tab or modal trigger

## 4) History access
- [ ] Decide tab vs modal sheet approach
- [ ] Implement history UI for mobile layout
- [ ] Confirm history list styling and scroll behavior

## 5) Mobile-specific styling
- [ ] Add safe-area bottom padding utilities
- [ ] Adjust spacing/padding for panels and sliders on small screens
- [ ] Ensure canvas controls do not overlap critical UI

## 6) Touch interaction QA
- [ ] Verify pan/zoom gestures do not scroll the page
- [ ] Confirm crop handles and sliders are usable on touch
- [ ] Check for accidental double-tap zoom issues

## 7) Manual QA checklist
- [ ] 360x640 viewport (Android baseline)
- [ ] 390x844 viewport (iPhone 12/13)
- [ ] 428x926 viewport (iPhone Pro Max)
- [ ] Landscape mobile (ensure tray is still usable)
