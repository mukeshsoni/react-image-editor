# Roadmap

## Next (High Priority)

### Add Image Export/Download
- Currently users can crop but cannot save the result
- Add "Download" button to export edited image as PNG/JPEG
- Store edited image data and trigger download
- **Impact**: Completes the editor workflow

### Fix handleWheel Performance Issue
- `use-canvas-zoom-pan.ts` line 378: Function recreated on every zoomLevel/offset change
- Memoize with `useCallback` and optimize dependencies
- Code comment: "This is atrocious"
- **Impact**: Noticeable performance improvement on zoom interactions

### Zoom from Cursor Position (Not Canvas Center)
- Zoom In/Out buttons currently zoom from canvas center
- Should zoom around cursor like mouse wheel does
- Code TODO in `use-canvas-zoom-pan.ts` line 552
- **Impact**: Better UX consistency

### Undo/Redo Functionality
- Add a left panel (Lightroom-style) with a **History** accordion listing all edits
- Track operation history (zoom, pan, crop, and future adjustments) and limit to last N operations (e.g., 50)
- Add **Undo** and **Redo** buttons on the right side of the right panel header
- Add a **Revert** button at the bottom of the right panel to restore the original image state
- Keyboard shortcuts: Cmd+Z (undo), Shift+Cmd+Z (redo)
- **Impact**: Essential for non-destructive editing workflow

## In Progress

- Vitest browser test setup (recent commit)

## Backlog (Medium Priority)

### RAW File Support
- Add support for common RAW formats (CR2, NEF, DNG, ARW, etc.)
- Use libraries like `libraw-js` or `raw.js` for parsing
- Extract embedded preview or demosaic RAW data
- Allow non-destructive editing of RAW files
- **Impact**: Essential for professional photographers

### Basic Tone & Color Adjustments
- **Exposure**: Brighten/darken image
- **Contrast**: Increase/decrease tonal separation
- **Highlights**: Recover blown-out highlights
- **Shadows**: Lift dark areas
- **Temperature**: Warm/cool color cast
- **Tint**: Green/magenta color shift
- **Vibrance**: Selective saturation boost (less aggressive than saturation)
- **Saturation**: Overall color intensity
- **Clarity**: Midtone contrast for detail enhancement
- Use Canvas filters or WebGL for real-time adjustments

### White Balance & Color Grading
- Color picker tool for white balance correction
- Auto white balance detection
- HSL panel: Adjust Hue, Saturation, Luminance per color range
- Split toning: Different colors for shadows vs highlights
- Color wheel for intuitive color adjustments
- Preset white balance (Daylight, Cloudy, Tungsten, etc.)

### Curves & Levels
- Tone curve editor for precise tonal control
- Separate RGB and Luminance curves
- Levels histogram display
- Auto-levels button
- Point-based curve manipulation

### Straighten & Perspective Correction
- Rotation slider for straightening horizons
- Perspective grid overlay
- Perspective correction tool
- Auto-straighten with edge detection

### Healing & Spot Removal
- Spot removal/clone tool
- Healing brush for seamless removal
- Content-aware fill for object removal
- Undo history for brush strokes

### Advanced Filtering
- Black & white conversion
- Sepia and vintage filters
- Blur effects (Gaussian, motion, radial)
- Sharpen/unsharp mask
- Vignette (edge darkening)
- Lens distortion correction
- Chromatic aberration correction

### Batch Processing & Presets
- Save editing presets/styles
- Apply presets to multiple images
- Batch edit with same adjustments
- Before/after comparison view
- History panel with all adjustments

### Local Adjustments
- Graduated filter (for sky/foreground)
- Radial filter (vignette-style local adjustments)
- Adjustment brush (paint adjustments locally)
- Masking capability for selective edits

### Expand Test Coverage
- Add tests for zoom/pan interactions (currently minimal)
- Test touch gestures on mobile
- Test crop with various aspect ratios and edge cases
- Test panel resizing edge cases
- Verify image scaling with various dimensions

### Fix Remaining Edge Cases
- Test on various image sizes and orientations
- Verify mobile touch interactions work reliably
- Test responsive behavior on different screen sizes
- Validate crop bounds with extreme zoom levels

### Accessibility Improvements
- Add ARIA labels to interactive elements
- Improve keyboard navigation beyond zoom shortcuts
- Better focus management in crop mode
- Keyboard shortcuts for crop operations (move, resize)

## Nice-to-Have

### Publish as NPM Package
- Clean up build configuration
- Export component for reuse in other projects
- Add comprehensive storybook documentation
- Setup GitHub Pages for live demo

### UI/UX Polish
- Show image dimensions and zoom percentage
- Add history/thumbnails panel
- Drag-and-drop file upload
- Preview of crop before applying
- Theme support (light/dark mode)
