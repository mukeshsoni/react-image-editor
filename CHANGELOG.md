# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog:
https://keepachangelog.com/en/1.1.0/

## [0.2.0] - 2026-01-30

### Added
- Mobile editor layout (<=768px) with bottom tray navigation: Presets / Crop / Healing / Edit / History (PR #20).
- Edit sub-tabs on mobile: Basic / Color / Tone / Details / Geometry.
- "Smart nudge" camera behavior to keep the image visible as the mobile tray opens/resizes.
- `useIsMobile` hook to switch between desktop and mobile layouts.
- Unit tests for mobile tray nudge behavior.

### Changed
- Refactored the desktop resizable layout into a standalone layout component.
- Presets UI moved into its own accordion in the desktop layout.
- Mobile tray overlays the canvas (tray scrolls internally; the page doesn't).
- Mobile CSS improvements for safe-area padding and touch ergonomics.

### Fixed
- Camera clamping on viewport resize.
- Multiple mobile tray sizing/scroll/click issues across panels and tool rows.

## [0.1.2] - 2026-01-22

### Added
- Initial npm release of `@mukeshsoni/react-image-editor`.
- Library build + publish setup (Vite library build, TypeScript declarations, and `prepack` pipeline).
- MIT license.
- GitHub Pages demo deployment workflow.

### Changed
- Updated package metadata (repository/homepage/bugs) and improved README usage docs.

[0.2.0]: https://github.com/mukeshsoni/react-image-editor/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/mukeshsoni/react-image-editor/releases/tag/v0.1.2
