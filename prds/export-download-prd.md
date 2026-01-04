# Export/Download PRD

## Context
The editor supports zoom, pan, crop, and rotation. Users can apply a crop which “bakes” the result into a new image (currently via an offscreen canvas and `toBlob`). However, there is no way to export the edited image as a file.

`ROADMAP.md` calls out "Add Image Export/Download" as high priority to complete the workflow.

## Goal
Add an **Export/Download** capability so users can save the edited image as **PNG** or **JPEG**.

## Key product decision
- **Crop must be applied before export**.
  - Export/download uses the current *committed* image state.
  - If the user is in crop mode and has adjusted the crop rect but has not clicked **Apply**, export does **not** include those pending crop changes.

## Non-goals (v1)
- Undo/redo and edit history
- RAW input/output
- EXIF/ICC preservation
- Export of “project state” (non-destructive save)
- Watermarking, batching, presets

## User stories
1. As a user, I can click **Download** to save the current edited image.
2. As a user, I can choose **PNG** or **JPEG** output.
3. As a user, I can control **JPEG quality**.
4. As a user, I get a sensible default filename.

## UX requirements
### UI placement
- Add controls in the right-side panel (same panel as Crop/Reset Crop), near the top so it’s discoverable.

### Controls
- A **Download** button.
- A **Format** selector: `PNG` | `JPEG`.
- If `JPEG` is selected: a **Quality** slider (0–100 or 0–1 UI mapped to 0–1 value).

### States
- Download is **disabled** if no image is loaded.
- While generating a blob, show a **loading** state (disable button; label “Preparing…” or “Downloading…”).
- If export fails (e.g., `toBlob` returns `null`), show a user-friendly message (toast, alert, or inline message depending on existing UI patterns).

### Behavior in crop mode
- If `cropMode === true`, keep the control visible but reflect the decision:
  - Either disable Download with a tooltip/message “Apply crop to download”, or allow download of the committed state.
  - Recommended v1: **disable** with clear message to avoid confusion.

## Export behavior
### What is exported
- The **committed image state**:
  - If no crop has ever been applied: export the original image with the current rotation baked.
  - If crop has been applied: export the baked image with the current rotation baked.
- Zoom and pan are **view-only** and must not affect export output.

### Output formats
- PNG: `image/png`
- JPEG: `image/jpeg` with `quality` parameter (0–1)

### Filename
- Default: `edited-image`.
- Extension:
  - PNG: `.png`
  - JPEG: `.jpg`
- If/when we have access to original file name (e.g. upload), use `<originalBaseName>-edited.<ext>`.

## Technical design
### High-level approach
1. Render the committed image into an offscreen canvas at **pixel-perfect output size**.
2. Convert canvas → Blob via `toBlob`.
3. Trigger a download in the browser using an `<a download>` link and an object URL.

### Reuse existing baking logic
The crop “Apply” flow already:
- Creates an offscreen canvas
- Draws the image (with rotation)
- Converts to a PNG blob
- Creates an object URL and swaps `imageRef` to a baked image

Export should reuse the same rendering primitives (ideally extracting shared helpers) to avoid drift between “what you see after apply” and “what you download”.

### Proposed helper APIs (internal)
- `renderCommittedImageToCanvas(options) => HTMLCanvasElement`
  - Inputs:
    - `image: HTMLImageElement`
    - `rotationDegrees: number`
    - Optional output size overrides (future)
  - Output:
    - canvas sized to the (possibly rotated/cropped) output.

- `canvasToBlob(canvas, { mimeType, quality? }) => Promise<Blob>`

- `triggerDownload(blob, { filename })`
  - Creates object URL
  - Creates temporary `<a>` element
  - `.click()`
  - Revokes object URL

Note: keep the implementation in `src/ReactImageEditor.tsx` initially unless the code becomes unwieldy; then extract to a small `src/lib/export.ts` module.

### Error handling
- If `canvas.getContext("2d")` is null: fail gracefully.
- If `toBlob` returns `null`: show error.
- Tainted canvas (CORS) may throw on export; surface a clear message.

### Performance
- Export is user-initiated and can be slower; correctness > speed.
- Use one offscreen canvas per export; release object URLs after download.

## Testing plan (Vitest)
Add tests similar to the existing crop+rotation baking test:
- PNG export:
  - clicking Download calls `toBlob` with `image/png`
  - triggers `URL.createObjectURL`
  - triggers anchor click
- JPEG export:
  - `toBlob` called with `image/jpeg` and expected quality

Mocking patterns:
- Spy on `HTMLCanvasElement.prototype.getContext`
- Spy on `HTMLCanvasElement.prototype.toBlob`
- Spy on `URL.createObjectURL`/`URL.revokeObjectURL`
- Stub anchor click behavior by mocking `document.createElement("a")` or spying on `HTMLAnchorElement.prototype.click`

## Acceptance criteria
- A user can download the edited image as PNG or JPEG.
- Downloaded output reflects committed edits (applied crop + rotation).
- Download does not depend on zoom/pan.
- Object URLs used for download are revoked.
- Tests cover PNG and JPEG export.

## Implementation plan (engineering)
1. Add export UI state (format, quality, loading, error).
2. Implement download handler:
   - guard: ensure image loaded
   - guard: if crop mode active, enforce “apply crop first” policy (disable or show message)
   - build offscreen canvas
   - `toBlob` to desired format
   - trigger download
3. Refactor crop apply code to reuse shared baking helper(s) (optional but recommended).
4. Add tests for export.
5. Manual QA:
   - original image download
   - after apply-crop download
   - rotation download
   - JPEG quality sanity

## Open questions
- Should Download be disabled during crop mode (recommended), or allowed to export committed state even while crop mode is open?
- Do we want a “Download original” secondary action (likely later)?
