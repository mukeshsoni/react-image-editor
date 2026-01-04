# Export/Download - Task Breakdown

## Scope (v1)
- Export/download the **committed** image state only.
- Crop must be **applied** before it affects export.
- Support `PNG` and `JPEG` (+ JPEG quality).

## Implementation tasks

### 1) Add export UI controls in the right panel
- [x] Decide final UI placement in `src/ReactImageEditor.tsx` right-side panel header (near Crop / Reset Crop)
- [x] Add local state for export settings
  - [x] `exportFormat`: `"png" | "jpeg"`
  - [x] `jpegQuality`: number (0–1 or 0–100, pick one and normalize)
  - [x] `isDownloading`: boolean
  - [x] `exportError`: string | null
- [x] Add **Download** button
  - [x] Hook to `handleDownload()`
  - [x] Disabled when `!imageRef.current` or `isDownloading`
- [x] Add **Format** control
  - [x] Use existing UI patterns/components (`src/components/ui/select.tsx` if already used elsewhere)
  - [x] When switching formats, keep JPEG quality state but hide slider when PNG
- [x] Add **JPEG Quality** control
  - [x] Only render when `exportFormat === "jpeg"`
  - [x] Clamp value (e.g. min 0.1 max 1, default 0.92)
- [x] Add loading/error UX
  - [x] Button label/state while downloading
  - [x] Render error text (or wire a toast if the app already has a pattern)

### 2) Enforce product rule: “apply crop before export”
- [x] Decide UX: disable Download in crop mode (recommended by PRD)
- [x] Implement enforcement
  - [x] Disable Download when `cropMode === true`
  - [x] Add helper text near button: “Apply crop to download”
- [x] Ensure export always uses committed `imageRef.current`
  - [x] Do not use `cropRect` or crop overlay state for export

### 3) Implement export pipeline
- [x] Implement `handleDownload()` in `src/ReactImageEditor.tsx`
  - [x] Guard: `if (!imageRef.current) return;`
  - [x] Guard: `if (cropMode) return;` (or surface message)
  - [x] Set `isDownloading` true; clear prior error
- [x] Build offscreen canvas
  - [x] Determine output size: use committed image pixel size (`imageRef.current.width/height`)
  - [x] Draw image with rotation using existing `drawImageWithRotation(...)`
    - [x] Use zoom=1 and compute centered offset so rotated image is fully visible
    - [x] If keeping same output size, ensure rotation doesn’t clip (decided: use rotated bounding box canvas)
- [x] Convert to blob
  - [x] PNG: `canvasToBlob(offscreen, "image/png")`
  - [x] JPEG: `canvasToBlob(offscreen, "image/jpeg", quality)`
  - [x] Handle `blob === null` (set error and stop)
- [x] Trigger download
  - [x] Create object URL `URL.createObjectURL(blob)`
  - [x] Create `<a>` element, set `href`, `download` filename, and click
  - [x] Always `URL.revokeObjectURL(url)` after click (finally)
- [x] Reset `isDownloading` in `finally`

### 4) Refactor (optional but recommended)
- [x] Identify shared parts between crop-apply baking and export baking in `src/ReactImageEditor.tsx`
- [x] Extract helpers (either keep file-local or move to `src/lib/export.ts`)
  - [x] `canvasToBlob(canvas, mimeType, quality?)`
  - [x] `triggerDownload(blob, filename)`
  - [x] `renderCommittedImageToOffscreenCanvas(image, rotation, background)`
- [x] Update crop-apply path to call shared helpers (avoid duplicate logic)

### 5) Add tests (Vitest)
- [ ] Add new test file `src/__tests__/ReactImageEditor.export-download.test.tsx`
- [ ] Mock/stub browser APIs
  - [ ] `HTMLCanvasElement.prototype.getContext`
  - [ ] `HTMLCanvasElement.prototype.toBlob`
  - [ ] `URL.createObjectURL` and `URL.revokeObjectURL`
  - [ ] `HTMLAnchorElement.prototype.click` (or mock `document.createElement("a")`)
- [ ] Add PNG test
  - [ ] Render editor with image loaded
  - [ ] Click Download
  - [ ] Assert `toBlob` called with `"image/png"`
  - [ ] Assert anchor click invoked
- [ ] Add JPEG test
  - [ ] Change format to JPEG
  - [ ] Set quality to a known value
  - [ ] Click Download
  - [ ] Assert `toBlob` called with `"image/jpeg"` and expected quality
- [ ] Add crop-mode enforcement test
  - [ ] Toggle Crop mode
  - [ ] Assert Download disabled / message visible

### 6) Manual QA checklist
- [ ] Download original image (no crop applied)
- [ ] Apply crop, then download
- [ ] Rotate, then download
- [ ] JPEG quality sanity check (compare file sizes)
- [ ] Verify download URLs are revoked (no leaks)

## Acceptance criteria
- Users can download PNG/JPEG.
- Export includes rotation and applied crop.
- Export ignores zoom/pan.
- Export is blocked (or clearly messaged) in crop mode until crop is applied.
- Automated tests cover PNG and JPEG flows.
